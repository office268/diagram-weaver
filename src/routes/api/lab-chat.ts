// ============================================================
// src/routes/api/lab-chat.ts
// HTTP endpoint (server route) — lab-chat.ts
// נקודת קצה ציבורית/פנימית עבור TanStack Start
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateText } from "ai";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "@/lib/ai/gateway.server";

const BodySchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(20000),
});

const MODEL = "google/gemini-2.5-pro";

const SYSTEM_PROMPT =
  "אתה אנליסט מערכות מנוסה. כתוב בעברית, ב-Markdown טבעי. " +
  "אם חסר לך מידע משמעותי כדי להתקדם, סיים את התשובה ברשימת שאלות " +
  "כך שכל שורה מתחילה ב-`?? ` ואחריה השאלה. אל תוסיף שום טקסט אחרי השאלות.";

function parseQuestions(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("?? ")) {
      const q = line.slice(3).trim();
      if (q) out.push(q);
    }
  }
  return out;
}

export const Route = createFileRoute("/api/lab-chat")({
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

        // Verify session ownership
        const { data: session } = await supabaseAdmin
          .from("lab_sessions")
          .select("id, user_id, latest_output_md")
          .eq("id", body.sessionId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!session) return new Response("Session not found", { status: 404 });

        // Load context: docs + answered questions + previous output
        const [docsRes, qsRes, msgsRes] = await Promise.all([
          supabaseAdmin
            .from("lab_documents")
            .select("file_name, extracted_text")
            .eq("session_id", body.sessionId)
            .order("created_at", { ascending: true }),
          supabaseAdmin
            .from("lab_questions")
            .select("question, answer")
            .eq("session_id", body.sessionId)
            .not("answer", "is", null)
            .order("created_at", { ascending: true }),
          supabaseAdmin
            .from("lab_messages")
            .select("role, content")
            .eq("session_id", body.sessionId)
            .order("created_at", { ascending: true }),
        ]);

        const docs = docsRes.data ?? [];
        const qas = qsRes.data ?? [];
        const history = msgsRes.data ?? [];
        const docsWithText = docs.filter((d) => (d.extracted_text ?? "").trim());

        // Save user message
        await supabaseAdmin.from("lab_messages").insert({
          session_id: body.sessionId,
          user_id: userId,
          role: "user",
          content: body.message,
        });

        // Build context blocks
        const contextParts: string[] = [];
        if (docsWithText.length > 0) {
          contextParts.push(
            "## מסמכים שהועלו\n\n" +
              docsWithText
                .map(
                  (d, i) =>
                    `### [${i + 1}] ${d.file_name}\n\n${(d.extracted_text ?? "").slice(0, 30000)}`,
                )
                .join("\n\n---\n\n"),
          );
        }
        if (qas.length > 0) {
          contextParts.push(
            "## שאלות-תשובות קודמות\n\n" +
              qas.map((q) => `- **ש:** ${q.question}\n  **ת:** ${q.answer}`).join("\n"),
          );
        }
        if (session.latest_output_md) {
          contextParts.push("## תוצר אחרון\n\n" + session.latest_output_md);
        }

        const messages: { role: "user" | "assistant"; content: string }[] = [];
        if (contextParts.length > 0) {
          messages.push({ role: "user", content: contextParts.join("\n\n---\n\n") });
          messages.push({ role: "assistant", content: "קיבלתי. ממתין להוראה." });
        }
        for (const m of history) {
          messages.push({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          });
        }
        messages.push({ role: "user", content: body.message });

        try {
          const provider = createLovableAiGatewayProvider(apiKey);
          const { text } = await generateText({
            model: provider(MODEL),
            system: SYSTEM_PROMPT,
            messages,
          });

          const reply = (text ?? "").trim() || "(לא הופקה תשובה)";

          await supabaseAdmin.from("lab_messages").insert({
            session_id: body.sessionId,
            user_id: userId,
            role: "assistant",
            content: reply,
          });

          await supabaseAdmin
            .from("lab_sessions")
            .update({ latest_output_md: reply, updated_at: new Date().toISOString() })
            .eq("id", body.sessionId);

          // Parse and save new questions
          const newQuestions = parseQuestions(reply);
          if (newQuestions.length > 0) {
            // Avoid duplicating existing unanswered questions
            const { data: existing } = await supabaseAdmin
              .from("lab_questions")
              .select("question")
              .eq("session_id", body.sessionId)
              .is("answer", null);
            const existingSet = new Set((existing ?? []).map((q) => q.question.trim()));
            const toInsert = newQuestions
              .filter((q) => !existingSet.has(q.trim()))
              .map((q) => ({
                session_id: body.sessionId,
                user_id: userId,
                question: q,
              }));
            if (toInsert.length > 0) {
              await supabaseAdmin.from("lab_questions").insert(toInsert);
            }
          }

          return Response.json({ ok: true, reply, newQuestions });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[lab-chat] error:", err);
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
