import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runDiagramJob } from "@/lib/diagram-job.server";
import type { DiagramOutputKey } from "@/lib/output-types";

/**
 * Cron-driven queue worker for diagram jobs.
 *
 * Called by pg_cron. Authenticates via the Supabase publishable key in the
 * `apikey` header. Atomically claims one pending job via
 * `claim_diagram_job()` (FOR UPDATE SKIP LOCKED), then runs the existing
 * `runDiagramJob` pipeline. Returns immediately when there is nothing to do.
 */
export const Route = createFileRoute("/api/public/hooks/process-diagram-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const lovableApiKey = process.env.LOVABLE_API_KEY;
        if (!lovableApiKey) {
          return new Response("LOVABLE_API_KEY missing", { status: 500 });
        }

        // Best-effort: free up jobs that look stuck before claiming the next one.
        try {
          await supabaseAdmin.rpc("reset_stuck_diagram_jobs", { _stale_minutes: 5 });
        } catch (e) {
          console.error("[process-diagram-jobs] reset_stuck failed:", e);
        }

        const { data: claimed, error: claimErr } = await supabaseAdmin.rpc(
          "claim_diagram_job",
        );
        if (claimErr) {
          console.error("[process-diagram-jobs] claim failed:", claimErr);
          return new Response(claimErr.message, { status: 500 });
        }
        if (!claimed) {
          return Response.json({ processed: false });
        }

        const job = claimed as {
          id: string;
          user_id: string;
          thread_id: string;
          kind: string;
          prompt: string;
          model_override: string | null;
        };

        // Load prior chat history for RF-JSON kinds.
        const { data: priorMsgs } = await supabaseAdmin
          .from("chat_messages")
          .select("role, content, created_at")
          .eq("thread_id", job.thread_id)
          .order("created_at", { ascending: true });
        const prior = priorMsgs ?? [];
        const priorHistory = prior
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: m.content,
          }));
        // The user message for this job is already in chat_messages, so
        // "first message" is true only when no messages exist beyond it.
        const isFirstMessage = prior.filter((m) => m.role === "user").length <= 1;

        try {
          await runDiagramJob({
            jobId: job.id,
            threadId: job.thread_id,
            userId: job.user_id,
            kind: job.kind as DiagramOutputKey,
            prompt: job.prompt,
            lovableApiKey,
            modelOverride: job.model_override ?? undefined,
            priorHistory,
            isFirstMessage,
          });
          return Response.json({ processed: true, jobId: job.id });
        } catch (err) {
          // runDiagramJob already handles its own failure persistence,
          // but guard against unexpected throws so cron sees a clean 200.
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[process-diagram-jobs] runDiagramJob threw:", err);
          await supabaseAdmin
            .from("diagram_jobs")
            .update({
              status: "failed",
              error_message: msg,
              completed_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          return Response.json({ processed: true, jobId: job.id, error: msg });
        }
      },
    },
  },
});
