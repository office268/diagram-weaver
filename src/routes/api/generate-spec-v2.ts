import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DOC_TYPE_KEYS } from "@/lib/doc-types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
        // Auth
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

        // Consume 1 credit atomically
        const { data: newBalance, error: creditErr } = await supabaseAdmin.rpc(
          "consume_credit",
          { _user_id: userId, _doc_id: undefined as unknown as string },
        );
        if (creditErr) {
          console.error("[generate-spec-v2] consume_credit error:", creditErr);
          return new Response("שגיאת קרדיטים", { status: 500 });
        }
        if (newBalance === null) {
          return new Response(
            "אזלו הקרדיטים שלך. בקר בדף המחירים כדי להוסיף קרדיטים או להתחיל מנוי.",
            { status: 402 },
          );
        }

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

              const result = await runOrchestrator({
                userPrompt: body.prompt,
                docType: body.docType ?? "spec_overview",
                userId,
                projectId: body.projectId ?? null,
                lovableApiKey: key,
                previousSpec: body.previousSpec,
                reviewerNotes: body.reviewerNotes,
              });

              console.log(
                `[generate-spec-v2] done score=${result.finalScore} iterations=${result.iterations}`,
              );

              enqueue(JSON.stringify(result.spec));
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error("[generate-spec-v2] error:", err);
              let friendly = msg;
              if (msg.includes("429")) friendly = "הגעת למגבלת קצב.";
              else if (msg.includes("402")) friendly = "אזלו קרדיטי ה-AI.";
              enqueue(`\n__STREAM_ERROR__:${friendly}`);
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
