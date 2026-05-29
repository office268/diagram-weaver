import { createFileRoute } from "@tanstack/react-router";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { COMPARISON_MODELS } from "@/lib/ai-spec-defaults";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BodySchema = z.object({
  prompt: z.string().min(1).max(5000),
  spec: z.record(z.string(), z.any()),
});

const ReviewSchema = z.object({
  score: z.number().int().min(1).max(10),
  notes: z.array(z.string().min(1).max(500)).max(20),
});

const REVIEWER_SYSTEM = [
  "אתה מבקר איכות בכיר של מסמכי אפיון מערכת.",
  "קיבלת את הפרומפט המקורי של המשתמש ואת מסמך האפיון שהופק (JSON).",
  "תפקידך: לדרג את המסמך בציון שלם בין 1 ל-10 על בסיס: שלמות, עקביות, רמת פירוט, בהירות, וכיסוי הפרומפט.",
  "כתוב עד 8 הערות שיפור — קצרות, קונקרטיות, מעשיות, בעברית.",
  "אם המסמך מצוין באמת — החזר רשימת הערות ריקה.",
  "החזר אך ורק את האובייקט במבנה שביקשנו, ללא טקסט נוסף.",
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

          const { experimental_output } = await generateText({
            model: gateway(COMPARISON_MODELS[0]),
            system: REVIEWER_SYSTEM,
            prompt: userPrompt,
            maxOutputTokens: 2000,
            experimental_output: Output.object({ schema: ReviewSchema }),
          });

          return Response.json(experimental_output);
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
