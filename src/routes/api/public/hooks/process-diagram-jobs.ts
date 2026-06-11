// ============================================================
// src/routes/api/public/hooks/process-diagram-jobs.ts
// HTTP endpoint (server route) — process-diagram-jobs.ts
// נקודת קצה ציבורית/פנימית עבור TanStack Start
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runDiagramJob } from "@/lib/diagrams/job.server";
import type { DiagramOutputKey } from "@/lib/output-types";

const RESET_STUCK_MINUTES = 3;

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
          const { data: resetCount, error: resetErr } = await supabaseAdmin.rpc(
            "reset_stuck_diagram_jobs",
            { _stale_minutes: RESET_STUCK_MINUTES },
          );
          if (resetErr) throw resetErr;
          if ((resetCount ?? 0) > 0) {
            console.warn("[process-diagram-jobs] reset stuck jobs", {
              resetCount,
              staleMinutes: RESET_STUCK_MINUTES,
            });
          }
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
        if (!claimed || typeof claimed !== "object" || !(claimed as { id?: string }).id) {
          // claim_diagram_job() returns an all-NULL row (not null) when there
          // is no pending work, so we must guard on the actual id field.
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

        console.info("[process-diagram-jobs] claimed job", {
          jobId: job.id,
          threadId: job.thread_id,
          kind: job.kind,
          hasModelOverride: Boolean(job.model_override),
        });


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
          console.info("[process-diagram-jobs] completed job", {
            jobId: job.id,
            kind: job.kind,
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
