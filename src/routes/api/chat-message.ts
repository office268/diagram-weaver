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

function looksLikePlantUml(code: string): boolean {
  const t = code.trimStart();
  return (
    /^activityDiagram\b/i.test(t) ||
    /^@startuml\b/i.test(t) ||
    /^start\b/im.test(t.split("\n").slice(0, 3).join("\n")) ||
    /^\s*:[^;\n]+;/m.test(t)
  );
}

// Mermaid breaks when a quoted label like ["מהעו"ד"] contains an unescaped " —
// the inner quote closes the label early and the parser fails. Replace inner
// quotes inside bracket-quoted labels with #quot; (Mermaid renders it as ").
function sanitizeMermaidLabels(code: string): string {
  return code.replace(
    /(\[\[?"|\(\(?"|\{"|>")([\s\S]*?)("\]\]?|"\)\)?|"\}|"\])/g,
    (_m, open: string, inner: string, close: string) => {
      const safe = inner.replace(/"/g, "#quot;");
      return open + safe + close;
    },
  );
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

        // Stream response with heartbeat to avoid proxy timeouts (Cloudflare 504 after ~100s).
        // Protocol: heartbeat spaces while working, then "\n__RESULT__\n{json}" or "\n__ERROR__\n{message}".
        const encoder = new TextEncoder();
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
              if (def.category === "document") {
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
              } else {
                // Diagram path
                const provider = createLovableAiGatewayProvider(apiKey);
                const model = provider("google/gemini-2.5-flash");

                const hint = (def as { mermaidHint?: string }).mermaidHint ?? "";
                const activityInstructions =
                  outputType === "diagram_activity"
                    ? `עצב כ-Swimlane diagram לפי ההנחיות הבאות:\n` +
                      `1. כיוון: flowchart RL (ימין לשמאל)\n` +
                      `2. כל שחקן/actor = subgraph נפרד. שם השחקן חייב להיות תיאורי וספציפי לתהליך המבוקש.\n` +
                      `3. כל node חייב לתאר פעולה ספציפית מהתהליך — אסור להשתמש במילים גנריות כמו "פעולה" או "שלב".\n` +
                      `4. השתמש ב-{תנאי?} לנקודות החלטה עם ענפי |כן|/|לא|.\n` +
                      `5. חבר nodes בין subgraphs בחצים לתיאור מעבר אחריות בין שחקנים.\n` +
                      `6. בתוך כל subgraph הוסף \`direction TB\` כך שהזרימה תהיה מלמעלה למטה בתוך הסווימליין.\n` +
                      `7. הגדר את ה-subgraph של הגורם המתחיל בתהליך ראשון בקוד — הוא יופיע בצד הימני.\n` +
                      `8. הוסף אקטור התחלה \`S(["👤"])\` ומסיים \`DONE(["סיום"])\` בסווימליין המתאים.\n` +
                      `9. בסוף הקוד הוסף style לכל subgraph: \`fill:#ffffff,stroke:#4444dd,stroke-dasharray:5 5\` לקו מקווקו.\n\n` +
                      `דוגמה לתהליך אישור בקשת חופשה:\n` +
                      `\`\`\`mermaid\n` +
                      `flowchart RL\n` +
                      `  subgraph EMP["עובד"]\n` +
                      `    direction TB\n` +
                      `    S(["👤"]) --> A["מילוי / עדכון טופס בקשת חופשה"]\n` +
                      `    A --> B["שליחת טופס למנהל"]\n` +
                      `    G2["הצגת אישור לעובד"] --> DONE(["סיום"])\n` +
                      `  end\n` +
                      `  subgraph MGR["מנהל ישיר"]\n` +
                      `    direction TB\n` +
                      `    C["בוחן זמינות הצוות"] --> DEC{{"מאשר?"}}\n` +
                      `    DEC -->|כן| E["חתימה על הבקשה"]\n` +
                      `    DEC -->|לא| F["כתיבת הערות"]\n` +
                      `  end\n` +
                      `  subgraph HR["משאבי אנוש"]\n` +
                      `    direction TB\n` +
                      `    G["עדכון מערכת נוכחות"] --> H["שליחת אישור לעובד"]\n` +
                      `  end\n` +
                      `  B --> C\n` +
                      `  F --> A\n` +
                      `  E --> G\n` +
                      `  H --> G2\n` +
                      `  style EMP fill:#ffffff,stroke:#4444dd,stroke-dasharray:5 5\n` +
                      `  style MGR fill:#ffffff,stroke:#4444dd,stroke-dasharray:5 5\n` +
                      `  style HR fill:#ffffff,stroke:#4444dd,stroke-dasharray:5 5\n` +
                      `\`\`\`\n\n` +
                      `כעת צור תרשים דומה עבור התהליך שתואר, עם תוכן ספציפי לבקשה. `
                    : `עבור תרשים Activity / זרימת תהליך — השתמש ב-\`${hint || "flowchart TD"}\` עם החלטות \`{תנאי?}\` ופעולות \`[פעולה]\`. `;

                const system =
                  `אתה מומחה לבניית תרשימי Mermaid עבור אנליסטים. ` +
                  `סוג התרשים המבוקש: ${def.label}. ` +
                  `החזר אך ורק קוד Mermaid תקני בתוך בלוק \`\`\`mermaid ... \`\`\`. ללא הסברים נוספים. ` +
                  (hint
                    ? `השורה הראשונה של הקוד חייבת להיות בדיוק: ${hint}. `
                    : "") +
                  `חשוב מאוד: ב-Mermaid אין \`activityDiagram\`. ` +
                  `אסור להתחיל ב-\`activityDiagram\`, \`@startuml\`, \`start\`, או \`:label;\` — זה תחביר PlantUML ולא תקף ב-Mermaid. ` +
                  activityInstructions +
                  `שמור על שמות באנגלית למזהי צמתים, אך תוויות בעברית מותרות בתוך גרשיים: ["טקסט"]. ` +
                  `חשוב: אל תשתמש בגרש כפול (") בתוך תווית — זה שובר את הפרסר. במקום \`עו"ד\` כתוב \`עוה״ד\` (עם גרשיים עבריים ״) או \`עורך דין\` במלואו.`;

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

                let mermaid = extractMermaid(text);
                if (looksLikePlantUml(mermaid)) {
                  const { text: text2 } = await generateText({
                    model,
                    system:
                      system +
                      `\n\nהפלט הקודם השתמש בתחביר PlantUML פסול. החזר שוב, הפעם אך ורק Mermaid תקני המתחיל ב-${hint || "flowchart TD"}.`,
                    messages: history,
                    temperature: 0,
                  });
                  const retry = extractMermaid(text2);
                  if (!looksLikePlantUml(retry)) mermaid = retry;
                }

                mermaid = sanitizeMermaidLabels(mermaid);

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

                enqueue("\n__RESULT__\n" + JSON.stringify({
                  ok: true,
                  artifact: { kind: "diagram", id: diagRow.id, mermaid, title },
                }));
              }
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
