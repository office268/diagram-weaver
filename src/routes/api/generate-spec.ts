import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DOC_TYPE_KEYS, type DocTypeKey } from "@/lib/doc-types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runOrchestrator } from "@/lib/agents/orchestrator.server";

const BodySchema = z.object({
  prompt: z.string().min(5).max(5000),
  previousSpec: z.record(z.string(), z.any()).optional(),
  reviewerNotes: z.array(z.string()).max(50).optional(),
  docType: z.enum(DOC_TYPE_KEYS).optional(),
  projectId: z.string().uuid().optional(),
  // Accepted for client-compatibility; orchestrator picks its own per-agent models.
  model: z.string().max(100).optional(),
});

const BASE_CREDITS = 3; // 5 agent calls + review (worker prices)

export const Route = createFileRoute("/api/generate-spec")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── Auth
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
        const userId = userData.user.id;

        // ── Body
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

        // ── Credits (base charge)
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

        // ── Run orchestrator (non-streaming: client only consumes final JSON)
        try {
          const result = await runOrchestrator(
            {
              userPrompt: body.prompt,
              docType: (body.docType ?? "spec_overview") as DocTypeKey,
              userId,
              projectId: body.projectId ?? null,
              apiKey: key,
              previousSpec: body.previousSpec,
              reviewerNotes: body.reviewerNotes,
              emit: () => {
                /* progress markers unused by client; swallowed to avoid stream timeouts */
              },
            },
            {
              canSpendIterationCredit: async () => {
                const { data: nb, error: e } = await supabaseAdmin.rpc(
                  "consume_credits",
                  {
                    _user_id: userId,
                    _amount: 1,
                    _description: "איטרציית שיפור multi-agent",
                  },
                );
                if (e) {
                  console.error("[generate-spec] iter credit:", e);
                  return false;
                }
                return nb !== null;
              },
            },
          );

          console.log(
            `[generate-spec] done iterations=${result.iterations} skipped=${result.iterationsSkippedNoCredits} rag=${result.ragChunkCount} score=${result.review?.score ?? "n/a"}`,
          );

          return new Response(JSON.stringify(result.spec), {
            status: 200,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[generate-spec] error:", err);
          let friendly = msg;
          let status = 500;
          if (msg.includes("429")) {
            friendly = "הגעת למגבלת קצב.";
            status = 429;
          } else if (msg.includes("402")) {
            friendly = "אזלו קרדיטי ה-AI.";
            status = 402;
          }
          return new Response(friendly, { status });
        }

      },
    },
  },
});
