import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { DEFAULT_MODEL } from "@/lib/ai-spec-defaults.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractJson } from "@/lib/spec-output-schema";

const BodySchema = z.object({
  prompt: z.string().min(1).max(5000),
  spec: z.record(z.string(), z.any()),
});

const ReviewParseSchema = z.object({
  score: z.coerce.number(),
  notes: z
    .array(
      z.union([
        z.string(),
        z.object({
          text: z.string(),
          importance: z.coerce.number().optional(),
        }),
      ]),
    )
    .default([]),
});

const REVIEWER_SYSTEM = [
  "אתה מבקר איכות בכיר של מסמכי אפיון מערכת.",
  "קיבלת את הפרומפט המקורי של המשתמש ואת מסמך האפיון שהופק (JSON).",
  "תפקידך: לדרג את המסמך בציון שלם בין 1 ל-10 על בסיס: שלמות, עקביות, רמת פירוט, בהירות, וכיסוי הפרומפט.",
  "כתוב עד 8 הערות שיפור — קצרות, קונקרטיות, מעשיות, בעברית.",
  "לכל הערה הוסף דירוג חשיבות שלם בין 1 (שולי) ל-10 (קריטי לתיקון).",
  "אם המסמך מצוין באמת — החזר רשימת notes ריקה.",
  "",
  "פורמט הפלט — חובה:",
  'החזר אך ורק אובייקט JSON תקני יחיד במבנה: { "score": <מספר שלם 1-10>, "notes": [ { "text": <מחרוזת בעברית>, "importance": <מספר שלם 1-10> } ] }.',
  "ללא טקסט נוסף לפני או אחרי, ללא הסברים, וללא עטיפה ב-```json``` או בכל סימן markdown.",
].join("\n");

export const Route = createFileRoute("/api/review-spec")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7).trim()
          : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { data: userData, error: userErr } =
          await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("LOVABLE_API_KEY missing", { status: 500 });

        try {
          const gateway = createLovableAiGatewayProvider(key);
          const userPrompt = [
            "פרומפט מקורי של המשתמש:",
            body.prompt,
            "",
            "מסמך האפיון שהופק (JSON):",
            JSON.stringify(body.spec),
          ].join("\n");

          const { text } = await generateText({
            model: gateway(DEFAULT_MODEL),
            system: REVIEWER_SYSTEM,
            prompt: userPrompt,
            maxOutputTokens: 2000,
          });

          try {
            const raw = JSON.parse(extractJson(text));
            const parsed = ReviewParseSchema.parse(raw);
            const score = Math.max(1, Math.min(10, Math.round(parsed.score)));
            const notes = parsed.notes
              .map((n, i) => {
                if (typeof n === "string") {
                  const t = n.trim();
                  if (!t) return null;
                  return { id: `n-${i + 1}`, text: t.slice(0, 500), importance: 5 };
                }
                const t = (n.text ?? "").trim();
                if (!t) return null;
                const importance =
                  typeof n.importance === "number" && isFinite(n.importance)
                    ? Math.max(1, Math.min(10, Math.round(n.importance)))
                    : 5;
                return { id: `n-${i + 1}`, text: t.slice(0, 500), importance };
              })
              .filter((n): n is { id: string; text: string; importance: number } => n !== null)
              .slice(0, 20);
            return Response.json({ score, notes });
          } catch (parseErr) {
            console.error("[review-spec] parse failed:", parseErr, "raw:", text);
            return Response.json({ score: null, notes: [] });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[review-spec] failed:", e);
          let status = 500;
          let friendly = msg;
          if (msg.includes("429")) {
            status = 429;
            friendly = "הגעת למגבלת קצב.";
          } else if (msg.includes("402")) {
            status = 402;
            friendly = "אזלו קרדיטי ה-AI.";
          }
          return new Response(friendly, { status });
        }
      },
    },
  },
});
