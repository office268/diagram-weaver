// ============================================================
// src/routes/api/generate-spec-v2.ts
// HTTP endpoint (server route) — generate-spec-v2.ts
// נקודת קצה ציבורית/פנימית עבור TanStack Start
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DOC_TYPE_KEYS } from "@/lib/doc-types";
import { requireBearerAuth, translateAiError } from "@/lib/api/auth.server";
import { runOrchestrator } from "@/agents/orchestrator/index.server";

const BodySchema = z.object({
  prompt: z.string().min(5).max(5000),
  previousSpec: z.record(z.string(), z.any()).optional(),
  reviewerNotes: z.array(z.string()).max(50).optional(),
  docType: z.enum(DOC_TYPE_KEYS).optional(),
  projectId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/generate-spec-v2")({
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

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("LOVABLE_API_KEY missing", { status: 500 });

        // Credit check temporarily disabled — allow generation regardless of balance.


        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let closed = false;
            const enqueue = (s: string) => {
              if (closed) return;
              try { controller.enqueue(encoder.encode(s)); } catch {}
            };
            const close = () => {
              if (closed) return;
              closed = true;
              try { controller.close(); } catch {}
            };

            try {
              // Stream progress tokens so the UI knows work is happening
              enqueue("__PROGRESS__:start\n");

              const { loadAgentModelOverride } = await import("@/lib/ai-model-setting.server");
              const modelOverride = await loadAgentModelOverride();
              const result = await runOrchestrator({
                userPrompt: body.prompt,
                docType: body.docType ?? "spec_overview",
                userId,
                projectId: body.projectId ?? null,
                lovableApiKey: key,
                previousSpec: body.previousSpec,
                reviewerNotes: body.reviewerNotes,
                modelOverride,
              });

              console.log(
                `[generate-spec-v2] done score=${result.finalScore} iterations=${result.iterations}`,
              );

              enqueue(JSON.stringify(result.spec));
            } catch (err) {
              console.error("[generate-spec-v2] error:", err);
              const { message } = translateAiError(err);
              enqueue(`\n__STREAM_ERROR__:${message}`);
            }

            close();
          },
        });

        return new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
