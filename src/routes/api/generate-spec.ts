import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import {
  DEFAULT_MODEL,
  DEFAULT_SYSTEM_INSTRUCTION,
  JSON_OUTPUT_INSTRUCTION,
} from "@/lib/ai-spec-defaults.server";
import { getDocTypeSystemInstruction } from "@/lib/doc-types.server";
import { DOC_TYPE_KEYS } from "@/lib/doc-types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BodySchema = z.object({
  prompt: z.string().min(5).max(5000),
  previousSpec: z.record(z.string(), z.any()).optional(),
  reviewerNotes: z.array(z.string()).max(50).optional(),
  docType: z.enum(DOC_TYPE_KEYS).optional(),
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
        const baseSystem = row?.system_instruction ?? DEFAULT_SYSTEM_INSTRUCTION;
        const docTypeInstruction = getDocTypeSystemInstruction(body.docType);
        const system = `${baseSystem}\n\n${docTypeInstruction}`;
        const model = DEFAULT_MODEL;

        try {
          const gateway = createLovableAiGatewayProvider(key);

          const isRevision =
            !!body.previousSpec &&
            Array.isArray(body.reviewerNotes) &&
            body.reviewerNotes.length > 0;

          const userPrompt = isRevision
            ? [
                "פרומפט מקורי של המשתמש:",
                body.prompt,
                "",
                "להלן מסמך אפיון קודם שיצרת (JSON):",
                JSON.stringify(body.previousSpec),
                "",
                "הערות מבקר איכות לשיפור:",
                ...body.reviewerNotes!.map((n, i) => `${i + 1}. ${n}`),
                "",
                "צור גרסה משופרת של מסמך האפיון שמטפלת בכל ההערות, שומרת ומחזקת את החוזקות הקיימות, ומחזירה JSON תקני באותה סכמה בדיוק.",
              ].join("\n")
            : body.prompt;

          const result = streamText({
            model: gateway(body.model),
            prompt: userPrompt,
            system: system + "\n" + JSON_OUTPUT_INSTRUCTION,
            maxOutputTokens: 8000,
            onError: ({ error }) => {
              const detail =
                error instanceof Error
                  ? `${error.name}: ${error.message}${error.cause ? ` | cause: ${JSON.stringify(error.cause)}` : ""}`
                  : JSON.stringify(error);
              console.error(
                `[generate-spec] streamText onError (${body.model}): ${detail}`,
              );
            },
          });

          const encoder = new TextEncoder();
          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              let closed = false;
              const safeEnqueue = (bytes: Uint8Array) => {
                if (closed) return;
                try {
                  controller.enqueue(bytes);
                } catch (e) {
                  console.error(
                    `[generate-spec] enqueue failed (${body.model}):`,
                    e,
                  );
                }
              };
              const safeClose = () => {
                if (closed) return;
                closed = true;
                try {
                  controller.close();
                } catch {
                  /* already closed */
                }
              };

              try {
                for await (const chunk of result.textStream) {
                  safeEnqueue(encoder.encode(chunk));
                }

                // After stream completes, verify it actually finished normally.
                try {
                  const finishReason = await result.finishReason;
                  const usage = await result.usage;
                  console.log(
                    `[generate-spec] done (${body.model}) finishReason=${finishReason} usage=${JSON.stringify(usage)}`,
                  );
                  if (finishReason && finishReason !== "stop") {
                    const reasonMsg =
                      finishReason === "length"
                        ? "המודל הגיע למגבלת אורך הפלט והתשובה נחתכה"
                        : `המודל סיים בסטטוס לא תקין: ${finishReason}`;
                    safeEnqueue(
                      encoder.encode(`\n__STREAM_ERROR__:${reasonMsg}`),
                    );
                  }
                } catch (metaErr) {
                  console.error(
                    `[generate-spec] meta read failed (${body.model}):`,
                    metaErr,
                  );
                }

                safeClose();
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(
                  `[generate-spec] stream iteration error (${body.model}): ${msg}`,
                );
                safeEnqueue(encoder.encode(`\n__STREAM_ERROR__:${msg}`));
                safeClose();
              }
            },
          });

          return new Response(stream, {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
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
