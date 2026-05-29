import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import {
  COMPARISON_MODELS,
  DEFAULT_SYSTEM_INSTRUCTION,
  JSON_OUTPUT_INSTRUCTION,
} from "@/lib/ai-spec-defaults";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BodySchema = z.object({
  prompt: z.string().min(5).max(5000),
  model: z.enum(COMPARISON_MODELS),
});

export const Route = createFileRoute("/api/generate-spec")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7).trim()
          : "";
        if (!token) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data: userData, error: userErr } =
          await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = userData.user.id;

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("LOVABLE_API_KEY missing", { status: 500 });
        }

        const { data: row } = await supabaseAdmin
          .from("ai_settings")
          .select("system_instruction")
          .eq("user_id", userId)
          .maybeSingle();
        const system = row?.system_instruction ?? DEFAULT_SYSTEM_INSTRUCTION;

        try {
          const gateway = createLovableAiGatewayProvider(key);
          const result = streamText({
            model: gateway(body.model),
            system: system + "\n" + JSON_OUTPUT_INSTRUCTION,
            prompt: body.prompt,
            onError: ({ error }) => {
              console.error(`[generate-spec] streamText error (${body.model}):`, error);
            },
          });
          return result.toTextStreamResponse({
            onError: (error) => {
              const msg = error instanceof Error ? error.message : String(error);
              console.error(`[generate-spec] stream error (${body.model}): ${msg}`);
              return `__STREAM_ERROR__:${msg}`;
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[generate-spec] thrown (${body.model}):`, e);
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
