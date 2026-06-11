// ============================================================
// src/routes/api/generate-spec.ts
// HTTP endpoint (server route) — generate-spec.ts
// נקודת קצה ציבורית/פנימית עבור TanStack Start
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DOC_TYPE_KEYS, type DocTypeKey } from "@/lib/doc-types";
import { requireBearerAuth, translateAiError } from "@/lib/api/auth.server";
import { runOrchestrator } from "@/agents/orchestrator/index.server";

const BodySchema = z.object({
  prompt: z.string().min(5).max(5000),
  previousSpec: z.record(z.string(), z.any()).optional(),
  reviewerNotes: z.array(z.string()).max(50).optional(),
  docType: z.enum(DOC_TYPE_KEYS).optional(),
  projectId: z.string().uuid().optional(),
  model: z.string().max(100).optional(),
});

const BASE_CREDITS = 3;

function sanitizePrompt(raw: string): string {
  return raw
    .replace(/\bignore\b.{0,60}\b(instructions?|system|rules?)\b/gi, "")
    .replace(/\bsystem\s*:/gi, "")
    .replace(/<\/?s(?:ystem|cript)[^>]*>/gi, "")
    .slice(0, 5000)
    .trim();
}

export const Route = createFileRoute("/api/generate-spec")({
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
        void BASE_CREDITS;


        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let closed = false;
            const safeEnqueue = (s: string) => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(s));
              } catch {
                closed = true;
              }
            };
            const safeClose = () => {
              if (closed) return;
              closed = true;
              try { controller.close(); } catch { /* already closed */ }
            };

            // Heartbeat every 10s to keep edge proxies from timing out.
            const heartbeat = setInterval(() => safeEnqueue(" "), 10_000);

            try {
              const { loadAgentModelOverride } = await import("@/lib/ai-model-setting.server");
              const modelOverride = await loadAgentModelOverride();

              const result = await runOrchestrator({
                userPrompt: sanitizePrompt(body.prompt),
                docType: (body.docType ?? "spec_overview") as DocTypeKey,
                userId,
                projectId: body.projectId ?? null,
                lovableApiKey: key,
                previousSpec: body.previousSpec,
                reviewerNotes: body.reviewerNotes,
                modelOverride,
              });

              console.log(
                `[generate-spec] done score=${result.finalScore} iterations=${result.iterations}`,
              );

              // Stream contract: <spec JSON>\n__REVIEW__\n<review JSON>\n__USAGE__\n<usage JSON>
              safeEnqueue(JSON.stringify(result.spec));
              safeEnqueue("\n__REVIEW__\n");

              const notes = result.review.notes
                .map((n) => ({
                  id: n.id,
                  text: n.text.trim().slice(0, 500),
                  importance: n.importance,
                }))
                .filter((n) => n.text.length > 0);
              safeEnqueue(JSON.stringify({ score: result.review.score, notes }));
              safeEnqueue("\n__USAGE__\n");
              safeEnqueue(JSON.stringify(result.usage));
            } catch (err) {
              console.error("[generate-spec] error:", err);
              const { message } = translateAiError(err);
              safeEnqueue(`\n__STREAM_ERROR__:${message}`);
            } finally {
              clearInterval(heartbeat);
              safeClose();
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
