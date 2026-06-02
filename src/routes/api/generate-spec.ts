import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DOC_TYPE_KEYS, type DocTypeKey } from "@/lib/doc-types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7).trim()
          : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { data: userData, error: userErr } =
          await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user)
          return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("LOVABLE_API_KEY missing", { status: 500 });

        const { data: newBalance, error: creditErr } = await supabaseAdmin.rpc(
          "consume_credits",
          {
            _user_id: userId,
            _amount: BASE_CREDITS,
            _description: "יצירת מסמך אפיון (multi-agent)",
          },
        );
        if (creditErr) {
          console.error("[generate-spec] consume_credits error:", creditErr);
          return new Response("שגיאת קרדיטים", { status: 500 });
        }
        if (newBalance === null) {
          return new Response(
            `אזלו הקרדיטים שלך (דרושים ${BASE_CREDITS}). הוסף קרדיטים בדף המחירים.`,
            { status: 402 },
          );
        }

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
              const result = await runOrchestrator({
                userPrompt: sanitizePrompt(body.prompt),
                docType: (body.docType ?? "spec_overview") as DocTypeKey,
                userId,
                projectId: body.projectId ?? null,
                lovableApiKey: key,
                previousSpec: body.previousSpec,
                reviewerNotes: body.reviewerNotes,
              });

              console.log(
                `[generate-spec] done score=${result.finalScore} iterations=${result.iterations}`,
              );

              // Stream contract: <spec JSON>\n__REVIEW__\n<review JSON>
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
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error("[generate-spec] error:", err);
              let friendly = msg;
              if (msg.includes("429")) friendly = "הגעת למגבלת קצב.";
              else if (msg.includes("402")) friendly = "אזלו קרדיטי ה-AI.";
              safeEnqueue(`\n__STREAM_ERROR__:${friendly}`);
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
