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

function extractMermaid(text: string): string {
  const fence = text.match(/```(?:mermaid)?\s*\n([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  return text.trim();
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
            const model = provider("google/gemini-2.5-flash");
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


        try {
          if (def.category === "document") {
            // Build refinement context from prior assistant artifact (latest)
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

            // Combine all prior user messages + new one as the prompt
            const combinedPrompt = [
              ...prior.filter((m) => m.role === "user").map((m) => m.content),
              cleanUserMsg,
            ].join("\n\n---\n\n");

            const { loadAgentModelOverride } = await import("@/lib/ai-model-setting.server");
            const modelOverride = await loadAgentModelOverride();
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

            // Log AI usage for this spec document
            try {
              const { logAiUsage } = await import("@/lib/ai-usage.server");
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

            // Update thread title if first
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

            return Response.json({
              ok: true,
              artifact: { kind: "spec_document", id: specRow.id, title },
            });
          }

          // Diagram path
          const diagDef = def as typeof def & { mermaidHint: string };
          const provider = createLovableAiGatewayProvider(apiKey);
          const model = provider("google/gemini-2.5-flash");

          const activitySwimlanesInstructions =
            outputType === "diagram_activity"
              ? `עצב כ-Swimlane diagram לפי ההנחיות הבאות:\n` +
                `1. כיוון: flowchart RL (ימין לשמאל)\n` +
                `2. כל שחקן/actor = subgraph נפרד. שם השחקן חייב להיות תיאורי וספציפי לתהליך המבוקש.\n` +
                `3. כל node חייב לתאר פעולה ספציפית מהתהליך — אסור להשתמש במילים גנריות כמו "פעולה" או "שלב".\n` +
                `4. השתמש ב-{{תנאי?}} לנקודות החלטה. הענפים יכולים להיות |כן|/|לא| או כל תיוג תיאורי כגון |אישור|/|בירור|/|סירוב|.\n` +
                `5. חבר nodes בין subgraphs בחצים לתיאור מעבר אחריות בין שחקנים.\n` +
                `6. בתוך כל subgraph הוסף \`direction TB\` כך שהזרימה תהיה מלמעלה למטה בתוך הסווימליין.\n` +
                `7. הגדר את ה-subgraph של הגורם המתחיל בתהליך ראשון בקוד — הוא יופיע בצד הימני.\n` +
                `8. הוסף אקטור התחלה \`S(["👤"])\` ומסיים \`DONE(("סיום"))\` (עיגול) בסווימליין המתאים.\n` +
                `9. כשמספר נתיבים מתמזגים לתוצאה אחת (join/sync), השתמש ב-node מיזוג מפורש, למשל \`MERGE["הצגת תשובה לעובד"]\`, שאליו מצביעים כל הנתיבים לפני ה-DONE.\n` +
                `10. בסוף הקוד הוסף style לכל subgraph: \`fill:#ffffff,stroke:#4444dd,stroke-dasharray:5 5\` לקו מקווקו.\n\n` +
                `דוגמה לתהליך אישור בקשת חופשה:\n` +
                `\`\`\`mermaid\n` +
                `flowchart RL\n` +
                `  subgraph EMP["עובד"]\n` +
                `    direction TB\n` +
                `    S(["👤"]) --> A["מילוי / עדכון טופס בקשת חופשה"]\n` +
                `    A --> B["שליחת טופס למנהל"]\n` +
                `    MERGE["הצגת תשובה לעובד"] --> DONE(("סיום"))\n` +
                `  end\n` +
                `  subgraph MGR["מנהל ישיר"]\n` +
                `    direction TB\n` +
                `    C["בחינת הבקשה"] --> DEC{{"תשובה?"}}\n` +
                `    DEC -->|בירור| F["בירור"]\n` +
                `    DEC -->|אישור| E["אישור"]\n` +
                `    DEC -->|סירוב| G["סירוב"]\n` +
                `  end\n` +
                `  subgraph HR["משאבי אנוש"]\n` +
                `    direction TB\n` +
                `    H["עדכון מערכת נוכחות"]\n` +
                `  end\n` +
                `  B --> C\n` +
                `  F --> A\n` +
                `  E --> H\n` +
                `  G --> MERGE\n` +
                `  H --> MERGE\n` +
                `  style EMP fill:#ffffff,stroke:#4444dd,stroke-dasharray:5 5\n` +
                `  style MGR fill:#ffffff,stroke:#4444dd,stroke-dasharray:5 5\n` +
                `  style HR fill:#ffffff,stroke:#4444dd,stroke-dasharray:5 5\n` +
                `\`\`\`\n\n` +
                `כעת צור תרשים דומה עבור התהליך שתואר, עם תוכן ספציפי לבקשה. `
              : "";

          const system =
            `אתה מומחה לבניית תרשימי Mermaid עבור אנליסטים. ` +
            `סוג התרשים המבוקש: ${def.label}. ` +
            `החזר אך ורק קוד Mermaid תקני בתוך בלוק \`\`\`mermaid ... \`\`\`. ללא הסברים נוספים. ` +
            `התחל בכותרת המתאימה (${def.mermaidHint ?? ""}). ` +
            `שמור על שמות באנגלית למזהי צמתים, אך תוויות בעברית מותרות בתוך גרשיים: ["טקסט"]. ` +
            `חשוב: אל תשתמש בגרש כפול (") בתוך תווית — זה שובר את הפרסר. ` +
            activitySwimlanesInstructions;

          const history: { role: "user" | "assistant"; content: string }[] = prior.map(
            (m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            }),
          );
          history.push({ role: "user", content: cleanUserMsg });

          const { text } = await generateText({
            model,
            system,
            messages: history,
            temperature: 0.3,
          });

          const mermaid = extractMermaid(text);
          const title = cleanUserMsg.slice(0, 80) || def.label;

          const { data: diagRow, error: diagErr } = await supabaseAdmin
            .from("diagrams")
            .insert({
              user_id: userId,
              thread_id: body.threadId,
              kind: outputType,
              title,
              prompt: cleanUserMsg,
              mermaid_code: mermaid,
            })
            .select()
            .single();
          if (diagErr) throw new Error(diagErr.message);

          const assistantContent =
            `הנה ${def.label}:\n\n\`\`\`mermaid\n${mermaid}\n\`\`\``;

          await supabaseAdmin.from("chat_messages").insert({
            thread_id: body.threadId,
            user_id: userId,
            role: "assistant",
            content: assistantContent,
            artifact_kind: "diagram",
            artifact_id: diagRow.id,
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

          return Response.json({
            ok: true,
            artifact: { kind: "diagram", id: diagRow.id, mermaid, title },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[chat-message] error:", err);

          // Credit refund skipped — credit consumption is currently disabled.

          await supabaseAdmin.from("chat_messages").insert({
            thread_id: body.threadId,
            user_id: userId,
            role: "assistant",
            content: `אירעה שגיאה ביצירת ${def.label}. אפשר לנסות שוב.\n\nפרטי שגיאה: ${msg}`,
          });
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
