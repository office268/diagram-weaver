/**
 * Async diagram-job runner.
 *
 * Executes the full diagram generation pipeline (Extractor → Builder →
 * Validator → Fixer for activity, or RF-JSON for others) OUT OF BAND of
 * the original HTTP request. The orchestrating handler creates a
 * `diagram_jobs` row, returns a quick response with the job id, and calls
 * `waitUntil(runDiagramJob({...}))` so the Worker keeps the pipeline
 * alive even after the client connection closes.
 *
 * The runner is fully self-contained: it logs AI usage, saves the
 * resulting `diagrams` row, appends the assistant chat message, and
 * updates the `diagram_jobs` status row in every outcome path. The
 * caller is NOT responsible for any of those side effects.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createUsageTracker, logAiUsage } from "@/lib/ai-usage.server";
import { ActivityDiagramGenerationError } from "@/lib/activity-diagram-pipeline.server";
import { OUTPUT_TYPES, type DiagramOutputKey } from "@/lib/output-types";

const DIAGRAM_JOB_TIMEOUT_MS = 4 * 60 * 1000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export interface RunDiagramJobParams {
  jobId: string;
  threadId: string;
  userId: string;
  kind: DiagramOutputKey;
  prompt: string;
  lovableApiKey: string;
  modelOverride?: string;
  /** Prior chat messages (chronological) — used as history for RF-JSON diagrams. */
  priorHistory: Array<{ role: "user" | "assistant"; content: string }>;
  /** Whether this is the first message in the thread (drives title update). */
  isFirstMessage: boolean;
}

export async function runDiagramJob(params: RunDiagramJobParams): Promise<void> {
  const {
    jobId,
    threadId,
    userId,
    kind,
    prompt,
    lovableApiKey,
    modelOverride,
    priorHistory,
    isFirstMessage,
  } = params;

  const def = OUTPUT_TYPES[kind];
  const tracker = createUsageTracker();
  let usageLogged = false;

  // Mark as processing
  await supabaseAdmin
    .from("diagram_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", jobId);

  const flushFailure = async (errMsg: string): Promise<void> => {
    if (!usageLogged) {
      try {
        const totals = tracker.totals();
        await logAiUsage({
          userId,
          artifactKind: kind,
          status: "failed",
          model: modelOverride ?? "agent",
          purpose: "diagram",
          inputTokens: totals.inputTokens,
          outputTokens: totals.outputTokens,
          totalTokens: totals.totalTokens,
          costUsd: totals.costUsd,
          docTitle: prompt.slice(0, 120) || def.label,
          docType: kind,
          wordCount: 0,
          errorMessage: errMsg,
        });
        usageLogged = true;
      } catch (e) {
        console.error("[diagram-job] failure logAiUsage failed:", e);
      }
    }
    try {
      await supabaseAdmin.from("chat_messages").insert({
        thread_id: threadId,
        user_id: userId,
        role: "assistant",
        content: `אירעה שגיאה ביצירת ${def.label}. אפשר לנסות שוב.\n\nפרטי שגיאה: ${errMsg}`,
      });
    } catch (e) {
      console.error("[diagram-job] failure assistant message insert failed:", e);
    }
    await supabaseAdmin
      .from("diagram_jobs")
      .update({
        status: "failed",
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  };

  try {
    let diagramCode: string;
    let assistantFence: "svg" | "rf-json";
    let iterations: number | undefined;

    if (kind === "diagram_activity") {
      const { runActivitySwimlaneOrchestrator } = await import(
        "@/agents/diagrams/activity-swimlane.server"
      );
      const { svg, iterations: it } = await withTimeout(
        runActivitySwimlaneOrchestrator({
          userPrompt: prompt,
          lovableApiKey,
          modelOverride,
          tracker,
        }),
        DIAGRAM_JOB_TIMEOUT_MS,
        "activity diagram generation",
      );
      diagramCode = svg;
      assistantFence = "svg";
      iterations = it;
    } else {
      const { runRfJsonDiagramAgent } = await import(
        "@/agents/diagrams/rf-json.server"
      );
      const { json } = await withTimeout(
        runRfJsonDiagramAgent({
          kind: kind as Exclude<DiagramOutputKey, "diagram_activity">,
          userPrompt: prompt,
          history: priorHistory,
          lovableApiKey,
          modelOverride,
          tracker,
        }),
        DIAGRAM_JOB_TIMEOUT_MS,
        "diagram generation",
      );
      diagramCode = json;
      assistantFence = "rf-json";
    }

    const title = prompt.slice(0, 80) || def.label;

    const { data: diagRow, error: diagErr } = await supabaseAdmin
      .from("diagrams")
      .insert({
        user_id: userId,
        thread_id: threadId,
        kind,
        title,
        prompt,
        mermaid_code: diagramCode,
      })
      .select()
      .single();
    if (diagErr) throw new Error(diagErr.message);

    try {
      const totals = tracker.totals();
      await logAiUsage({
        userId,
        diagramId: diagRow.id,
        artifactKind: kind,
        status: "success",
        model: modelOverride ?? "agent",
        purpose: "diagram",
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        totalTokens: totals.totalTokens,
        costUsd: totals.costUsd,
        docTitle: title,
        docType: kind,
        wordCount: 0,
      });
      usageLogged = true;
    } catch (e) {
      console.error("[diagram-job] success logAiUsage failed:", e);
    }

    const assistantContent =
      `הנה ${def.label}:\n\n\`\`\`${assistantFence}\n${diagramCode}\n\`\`\``;
    await supabaseAdmin.from("chat_messages").insert({
      thread_id: threadId,
      user_id: userId,
      role: "assistant",
      content: assistantContent,
      artifact_kind: "diagram",
      artifact_id: diagRow.id,
    });

    if (isFirstMessage) {
      await supabaseAdmin
        .from("chat_threads")
        .update({ title: title.slice(0, 100) })
        .eq("id", threadId);
    } else {
      await supabaseAdmin
        .from("chat_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", threadId);
    }

    await supabaseAdmin
      .from("diagram_jobs")
      .update({
        status: "done",
        diagram_id: diagRow.id,
        iterations: iterations ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (err) {
    const msg =
      err instanceof ActivityDiagramGenerationError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    console.error("[diagram-job] failed:", err);
    await flushFailure(msg);
  }
}
