import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateText } from "ai";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { runOrchestrator } from "@/agents/orchestrator/index.server";
import {
  OUTPUT_TYPES,
  type DiagramOutputKey,
  type DocumentOutputKey,
  type OutputKey,
} from "@/lib/output-types";
import type { DocTypeKey } from "@/lib/doc-types";
import type { SpecOutput } from "@/lib/spec-output-schema";
import { waitUntil } from "@/lib/cf-context.server";
import { runDiagramJob } from "@/lib/diagram-job.server";

const BodySchema = z.object({
  threadId: z.string().uuid(),
  message: z.string().min(1).max(5000),
  mode: z.enum(["auto", "plan", "build"]).optional().default("auto"),
});

const BASE_CREDITS = 3;
const PLAN_CREDITS = 1;

function sanitize(s: string): string {
  return s
    .replace(/\bignore\b.{0,60}\b(instructions?|system|rules?)\b/gi, "")
    .replace(/\bsystem\s*:/gi, "")
    .slice(0, 5000)
    .trim();
}


export const Route = createFileRoute("/api/chat-message")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

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

        const cleanUserMsg = sanitize(body.message);

        // Insert user message
        const { error: insertUserErr } = await supabaseAdmin.from("chat_messages").insert({
          thread_id: body.threadId,
          user_id: userId,
          role: "user",
          content: cleanUserMsg,
        });
        if (insertUserErr) return new Response(insertUserErr.message, { status: 500 });

        // Credit check temporarily disabled — allow creation regardless of balance.
        const creditsToCharge = body.mode === "plan" ? PLAN_CREDITS : BASE_CREDITS;
        void creditsToCharge;


        // Plan mode: respond with clarifying questions / outline only, no artifact
        if (body.mode === "plan") {
          try {
            const provider = createLovableAiGatewayProvider(apiKey);
            const { loadAgentModelOverride: loadPlanModel } = await import("@/lib/ai-model-setting.server");
            const model = provider(await loadPlanModel());
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

        // ── Diagram path: create an async job and return immediately ──
        // The heavy pipeline runs via `waitUntil` so a dropped HTTP connection
        // does not kill the generation. The client polls `diagram_jobs` for
        // completion and refreshes the chat when the job is done/failed.
        if (def.category === "diagram") {
          const { loadAgentModelOverride } = await import("@/lib/ai-model-setting.server");
          const modelOverride = await loadAgentModelOverride();
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

          const priorHistory = prior.map((m) => ({
            role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: m.content,
          }));

          // Fire-and-forget — Cloudflare keeps the Worker alive via waitUntil
          // until the pipeline finishes writing its results.
          waitUntil(
            runDiagramJob({
              jobId: jobRow.id,
              threadId: body.threadId,
              userId,
              kind: diagramKind,
              prompt: cleanUserMsg,
              lovableApiKey: apiKey,
              modelOverride: modelOverride ?? undefined,
              priorHistory,
              isFirstMessage: prior.length === 0,
            }),
          );

          return Response.json({ ok: true, async: true, jobId: jobRow.id });
        }

        // ── Document (spec) path: keep the existing streaming flow ──
        const encoder = new TextEncoder();

        const { createUsageTracker, logAiUsage } = await import("@/lib/ai-usage.server");
        const docTracker = createUsageTracker();
        void docTracker; // reserved for future partial-usage logging on doc path
        let usageLogged = false;
        const { loadAgentModelOverride } = await import("@/lib/ai-model-setting.server");
        const modelOverride = await loadAgentModelOverride();

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
                projectId: null,
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
                })
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
              } catch { /* swallow */ }
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
