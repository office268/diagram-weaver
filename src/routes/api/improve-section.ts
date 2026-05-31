import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { DEFAULT_MODEL } from "@/lib/ai-spec-defaults.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractJson } from "@/lib/spec-output-schema";

const BodySchema = z.object({
  sectionKey: z.string().min(1).max(100),
  sectionLabel: z.string().min(1).max(200),
  sectionValue: z.any(),
  instruction: z.string().min(1).max(2000),
  contextPrompt: z.string().max(5000).optional(),
  docType: z.string().max(100).optional(),
  valueShape: z.enum(["string", "array", "object"]),
});

const SYSTEM = [
  "אתה עוזר AI מומחה בכתיבת מסמכי אפיון מערכת.",
  "קיבלת סעיף בודד ממסמך אפיון קיים והנחיה לשיפור.",
  "תפקידך: להחזיר את הסעיף המשופר באותו מבנה JSON בדיוק.",
  "שמור על שדות, מזהים (id) ומבנה. אל תוסיף שדות חדשים שלא קיימים במקור.",
  "כתוב בעברית, קצר וקונקרטי.",
  "",
  "פורמט הפלט — חובה:",
  "אם הערך המקורי הוא מחרוזת — החזר JSON: { \"value\": \"...\" }.",
  "אם הערך המקורי הוא מערך — החזר JSON: { \"value\": [ ... ] } עם אותו מבנה לכל פריט.",
  "אם הערך המקורי הוא אובייקט — החזר JSON: { \"value\": { ... } } עם אותם שדות.",
  "החזר אך ורק JSON תקני יחיד. ללא טקסט נוסף, ללא ```json```.",
].join("\n");

export const Route = createFileRoute("/api/improve-section")({
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
            body.contextPrompt
              ? `הקשר המסמך (פרומפט מקורי): ${body.contextPrompt}`
              : "",
            body.docType ? `סוג מסמך: ${body.docType}` : "",
            `שם הסעיף: ${body.sectionLabel} (key: ${body.sectionKey})`,
            `מבנה הערך: ${body.valueShape}`,
            "",
            "הערך הנוכחי (JSON):",
            JSON.stringify(body.sectionValue, null, 2),
            "",
            "הנחיית המשתמש לשיפור הסעיף:",
            body.instruction,
          ]
            .filter(Boolean)
            .join("\n");

          const { text } = await generateText({
            model: gateway(DEFAULT_MODEL),
            system: SYSTEM,
            prompt: userPrompt,
            maxOutputTokens: 4000,
          });

          let parsed: unknown;
          try {
            parsed = JSON.parse(extractJson(text));
          } catch {
            return new Response("המודל לא החזיר JSON תקני", { status: 502 });
          }
          const value =
            parsed && typeof parsed === "object" && "value" in parsed
              ? (parsed as { value: unknown }).value
              : parsed;

          return Response.json({ value });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[improve-section] failed:", e);
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
