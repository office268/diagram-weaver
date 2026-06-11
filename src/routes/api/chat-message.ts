// ============================================================
// src/routes/api/chat-message.ts
// HTTP endpoint (server route) — chat-message.ts
// נקודת קצה ציבורית/פנימית עבור TanStack Start
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateText } from "ai";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireBearerAuth } from "@/lib/api/auth.server";
import { sanitizeUserPrompt } from "@/lib/api/sanitize";
import { createLovableAiGatewayProvider } from "@/lib/ai/gateway.server";
import { runOrchestrator } from "@/agents/orchestrator/index.server";
import {
  OUTPUT_TYPES,
  type DiagramOutputKey,
  type DocumentOutputKey,
  type OutputKey,
} from "@/lib/doc-types/output-types";
import type { DocTypeKey } from "@/lib/doc-types/types";
import type { SpecOutput } from "@/lib/spec/output-schema";

const BodySchema = z.object({
  threadId: z.string().uuid(),
  message: z.string().min(1).max(5000),
  mode: z.enum(["auto", "plan", "build"]).optional().default("auto"),
});



export const Route = createFileRoute("/api/chat-message")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authResult = await requireBearerAuth(request);
        if (!authResult.ok) return authResult.response;
        const { userId } = authResult;

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("LOVABLE_API_KEY missing", { status: 500 });

        // Load thread & verify ownership
        const { data: thread, error: threadErr } = await supabaseAdmin
          .from("chat_threads")
          .select("*")
          .eq("id", body.threadId)
          .eq("user_id", userId)
          .maybeSingle();
        if (threadErr) return new Response(threadErr.message, { status: 500 });
        if (!thread) return new Response("Thread not found", { status: 404 });

        const outputType = thread.output_type as OutputKey;
        const def = OUTPUT_TYPES[outputType];
        if (!def) return new Response("Invalid output type", { status: 400 });

        // Load prior messages for context
        const { data: priorMsgs } = await supabaseAdmin
          .from("chat_messages")
          .select("*")
          .eq("thread_id", body.threadId)
          .order("created_at", { ascending: true });
        const prior = priorMsgs ?? [];

        const cleanUserMsg = sanitizeUserPrompt(body.message);

        // Insert user message
        const { error: insertUserErr } = await supabaseAdmin.from("chat_messages").insert({
          thread_id: body.threadId,
          user_id: userId,
          role: "user",
          content: cleanUserMsg,
        });
        if (insertUserErr) return new Response(insertUserErr.message, { status: 500 });

        // Plan mode: respond with clarifying questions / outline only, no artifact
        if (body.mode === "plan") {
          try {
            const provider = createLovableAiGatewayProvider(apiKey);
            const { loadEffectiveModelForThread } = await import("@/lib/ai/model-setting.server");
            const model = provider(await loadEffectiveModelForThread(body.threadId));
            const planSystem =
              `אתה אנליסט מערכות מנוסה שעוזר ללקוח לחדד את הבקשה לפני יצירת ${def.label}. ` +
              `אל תייצר את המסמך/תרשים עצמו. במקום זה: ` +
              `1) זהה מידע חסר וקריטי, ושאל עד 5 שאלות הבהרה ממוקדות. ` +
              `2) הצע מבנה/תוכן עניינים ראשוני ל-${def.label} בנקודות קצרות. ` +
              `3) ציין הנחות שאתה לוקח. ` +
              `כתוב בעברית, תמציתי עם כותרות בולד ו-bullet points. בסוף ההודעה הזמן את המשתמש לעבור למצב Build כשמוכן.`;
            const history: { role: "user" | "assistant"; content: string }[] = prior.map(
              (m) => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.content,
              }),
            );
            history.push({ role: "user", content: cleanUserMsg });

            const { text } = await generateText({
              model,
              system: planSystem,
              messages: history,
              temperature: 0.5,
            });

            await supabaseAdmin.from("chat_messages").insert({
              thread_id: body.threadId,
              user_id: userId,
              role: "assistant",
              content: text.trim() || "לא הופקה תשובה.",
            });

            await supabaseAdmin
              .from("chat_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", body.threadId);

            return Response.json({ ok: true, mode: "plan" });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[chat-message] plan error:", err);
            await supabaseAdmin.from("chat_messages").insert({
              thread_id: body.threadId,
              user_id: userId,
              role: "assistant",
              content: `אירעה שגיאה: ${msg}`,
            });
            return new Response(msg, { status: 500 });
          }
        }

        // ── Diagram path: enqueue a job; pg_cron worker picks it up ──
        // The HTTP request returns immediately with the jobId. A pg_cron
        // task polls /api/public/hooks/process-diagram-jobs every few
        // seconds and runs the heavy AI pipeline out of band. The client
        // polls `diagram_jobs.status` for completion.
        if (def.category === "diagram") {
          const { loadEffectiveModelForThread } = await import("@/lib/ai/model-setting.server");
          const modelOverride = await loadEffectiveModelForThread(body.threadId);
          const diagramKind = outputType as DiagramOutputKey;

          const { data: jobRow, error: jobErr } = await supabaseAdmin
            .from("diagram_jobs")
            .insert({
              user_id: userId,
              thread_id: body.threadId,
              kind: diagramKind,
              prompt: cleanUserMsg,
              status: "pending",
              model_override: modelOverride ?? null,
            })
            .select()
            .single();
          if (jobErr) return new Response(jobErr.message, { status: 500 });

          if (diagramKind !== "diagram_activity") {
            const { data: pendingMsg, error: pendingErr } = await supabaseAdmin
              .from("chat_messages")
              .insert({
                thread_id: body.threadId,
                user_id: userId,
                role: "assistant",
                content: `מכין ${def.label}...\n\n_⏳ עדיין בעבודה..._`,
              })
              .select("id")
              .single();

            if (!pendingErr && pendingMsg?.id) {
              await supabaseAdmin
                .from("diagram_jobs")
                .update({ current_message_id: pendingMsg.id })
                .eq("id", jobRow.id);
            }
          }

          return Response.json({ ok: true, async: true, jobId: jobRow.id });
        }

        // ── Document (spec) path: keep the existing streaming flow ──
        const encoder = new TextEncoder();

        const { createUsageTracker, logAiUsage } = await import("@/lib/ai/usage.server");
        const docTracker = createUsageTracker();
        void docTracker; // reserved for future partial-usage logging on doc path
        let usageLogged = false;
        const { loadEffectiveModelForThread } = await import("@/lib/ai/model-setting.server");
        const modelOverride = await loadEffectiveModelForThread(body.threadId);

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let closed = false;
            const enqueue = (s: string) => {
              if (closed) return;
              try { controller.enqueue(encoder.encode(s)); } catch { closed = true; }
            };
            const close = () => {
              if (closed) return;
              closed = true;
              try { controller.close(); } catch { /* ignore */ }
            };
            const heartbeat = setInterval(() => enqueue(" "), 10_000);

            try {
              const lastAssistantArtifact = [...prior]
                .reverse()
                .find((m) => m.role === "assistant" && m.artifact_kind === "spec_document");

              let previousSpec: SpecOutput | undefined;
              if (lastAssistantArtifact?.artifact_id) {
                const { data: prevSpec } = await supabaseAdmin
                  .from("spec_documents")
                  .select("content")
                  .eq("id", lastAssistantArtifact.artifact_id)
                  .maybeSingle();
                if (prevSpec?.content) previousSpec = prevSpec.content as SpecOutput;
              }

              const combinedPrompt = [
                ...prior.filter((m) => m.role === "user").map((m) => m.content),
                cleanUserMsg,
              ].join("\n\n---\n\n");

              const result = await runOrchestrator({
                userPrompt: combinedPrompt,
                docType: (outputType as DocumentOutputKey) as DocTypeKey,
                userId,
                projectId: (thread as { project_id?: string | null }).project_id ?? null,
                lovableApiKey: apiKey,
                previousSpec,
                reviewerNotes: previousSpec ? [cleanUserMsg] : undefined,
                modelOverride,
              });

              const title = result.spec.title || def.label;
              const { data: specRow, error: specErr } = await supabaseAdmin
                .from("spec_documents")
                .insert({
                  user_id: userId,
                  title: `${title} — ${def.label}`,
                  prompt: combinedPrompt,
                  content: result.spec,
                  doc_type: outputType,
                  review_score: result.review.score,
                  review_notes: result.review.notes,
                  variant: previousSpec ? "revised" : "original",
                  project_id: (thread as { project_id?: string | null }).project_id ?? null,
                } as never)
                .select()
                .single();
              if (specErr) throw new Error(specErr.message);


              try {
                await logAiUsage({
                  userId,
                  specDocumentId: specRow.id,
                  model: "multi-agent",
                  purpose: previousSpec ? "regenerate" : "generate",
                  inputTokens: result.usage.inputTokens,
                  outputTokens: result.usage.outputTokens,
                  totalTokens: result.usage.totalTokens,
                  costUsd: result.usage.costUsd,
                });
                usageLogged = true;
              } catch (e) {
                console.error("[chat-message] logAiUsage failed:", e);
              }

              const assistantContent =
                `נוצר ${def.label} — **${title}**.\n\n` +
                `ציון ביקורת: ${result.review.score}/10 · איטרציות: ${result.iterations}`;

              await supabaseAdmin.from("chat_messages").insert({
                thread_id: body.threadId,
                user_id: userId,
                role: "assistant",
                content: assistantContent,
                artifact_kind: "spec_document",
                artifact_id: specRow.id,
              });

              if (prior.length === 0) {
                await supabaseAdmin
                  .from("chat_threads")
                  .update({ title: title.slice(0, 100) })
                  .eq("id", body.threadId);
              } else {
                await supabaseAdmin
                  .from("chat_threads")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", body.threadId);
              }

              enqueue("\n__RESULT__\n" + JSON.stringify({
                ok: true,
                artifact: { kind: "spec_document", id: specRow.id, title },
              }));
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error("[chat-message] error:", err);
              try {
                await supabaseAdmin.from("chat_messages").insert({
                  thread_id: body.threadId,
                  user_id: userId,
                  role: "assistant",
                  content: `אירעה שגיאה ביצירת ${def.label}. אפשר לנסות שוב.\n\nפרטי שגיאה: ${msg}`,
                });
              } catch (e) { console.warn("[chat-message] failed to persist error message:", e); }
              enqueue("\n__ERROR__\n" + msg);
            } finally {
              clearInterval(heartbeat);
              void usageLogged;
              close();
            }
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
