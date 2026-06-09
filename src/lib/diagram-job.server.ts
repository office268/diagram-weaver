/**
 * Async diagram-job runner — step-based.
 *
 * The runner executes ONE pipeline step per invocation and persists the
 * partial result back to `diagram_jobs`. If more work remains, it sets
 * `status='processing'` with `next_run_at=now()` so the cron worker
 * (`/api/public/hooks/process-diagram-jobs`) picks the same job up
 * within ~30s for the next step. This keeps every Worker request well
 * under the runtime budget even when the full pipeline takes minutes.
 *
 * Activity-swimlane pipeline stages:
 *   null         → extract  (Extractor)         → stage='building'
 *   'building'   → build    (Builder)           → stage='validating', writes first SVG + chat msg
 *   'validating' → validate (Validator)         → 'fixing' OR finalize
 *   'fixing'     → fix      (Fixer)             → stage='validating'
 *
 * RF-JSON kinds run as a single step (one LLM call, no iteration).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createUsageTracker, logAiUsage } from "@/lib/ai-usage.server";
import {
  ActivityDiagramGenerationError,
  validateActivitySvg,
  type ProcessMap,
} from "@/lib/activity-diagram-pipeline.server";
import { OUTPUT_TYPES, type DiagramOutputKey } from "@/lib/output-types";
import { DEFAULT_AGENT_MODEL } from "@/agents/shared/constants";

/** Single-step timeout — must stay well under the Worker request budget. */
const STEP_TIMEOUT_MS = 180 * 1000;
const RF_JSON_LEASE_MS = 3.5 * 60 * 1000;
const MAX_FIX_ITERATIONS = 2;

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

function leaseUntil(timeoutMs: number): string {
  return new Date(Date.now() + timeoutMs).toISOString();
}

function getErrorMessage(err: unknown): string {
  return err instanceof ActivityDiagramGenerationError
    ? err.message
    : err instanceof Error
      ? err.message
      : String(err);
}

export interface RunDiagramJobParams {
  jobId: string;
  threadId: string;
  userId: string;
  kind: DiagramOutputKey;
  prompt: string;
  lovableApiKey: string;
  modelOverride?: string;
  priorHistory: Array<{ role: "user" | "assistant"; content: string }>;
  isFirstMessage: boolean;
}

interface JobRow {
  id: string;
  user_id: string;
  thread_id: string;
  kind: string;
  prompt: string;
  model_override: string | null;
  stage: string | null;
  process_map_json: ProcessMap | null;
  current_svg: string | null;
  current_violations: string[] | null;
  iteration: number;
  current_message_id: string | null;
  diagram_id: string | null;
  cancel_requested?: boolean | null;
}

const CANCELED_MESSAGE = "התהליך בוטל על ידי המשתמש";

async function isJobCanceled(jobId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("diagram_jobs")
    .select("cancel_requested")
    .eq("id", jobId)
    .maybeSingle();
  return Boolean((data as { cancel_requested?: boolean } | null)?.cancel_requested);
}

function footer(stage: string, iteration: number): string {
  if (stage === "building" || stage === "validating") {
    return iteration === 0
      ? "_⏳ תרשים ראשוני מוכן, בודק..._"
      : `_⏳ בודק שיפור ${iteration}/${MAX_FIX_ITERATIONS}..._`;
  }
  if (stage === "fixing") {
    return `_⏳ משפר תרשים (שיפור ${iteration + 1}/${MAX_FIX_ITERATIONS})..._`;
  }
  return "_⏳ עדיין בעבודה..._";
}

function buildMessageContent(label: string, svg: string, footerLine: string | null): string {
  const base = `הנה ${label}:\n\n\`\`\`svg\n${svg}\n\`\`\``;
  return footerLine ? `${base}\n\n${footerLine}` : base;
}

function buildRfJsonPendingContent(label: string): string {
  return `מכין ${label}...\n\n_⏳ עדיין בעבודה..._`;
}

function buildRfJsonMessageContent(
  label: string,
  json: string,
  footerLine: string | null = null,
): string {
  const base = `הנה ${label}:\n\n\`\`\`rf-json\n${json}\n\`\`\``;
  return footerLine ? `${base}\n\n${footerLine}` : base;
}

/** Compatibility wrapper: full-pipeline entrypoint used to be `runDiagramJob`.
 *  Now it just runs ONE step. Kept for the existing process-diagram-jobs caller. */
export async function runDiagramJob(params: RunDiagramJobParams): Promise<void> {
  await runDiagramJobStep(params);
}

export async function runDiagramJobStep(params: RunDiagramJobParams): Promise<void> {
  const { jobId, kind } = params;

  // Load the latest job row (cron already locked it via claim_diagram_job).
  const { data: job, error: loadErr } = await supabaseAdmin
    .from("diagram_jobs")
    .select(
      "id,user_id,thread_id,kind,prompt,model_override,stage,process_map_json,current_svg,current_violations,iteration,current_message_id,diagram_id,cancel_requested",
    )
    .eq("id", jobId)
    .single();
  if (loadErr || !job) {
    console.error("[diagram-job] failed to load job:", loadErr);
    return;
  }

  // Honor cancel requests from the UI before doing any model work.
  if ((job as JobRow).cancel_requested) {
    console.info("[diagram-job] cancel requested, finalizing", { jobId });
    await finalizeFailure(params, job as JobRow, CANCELED_MESSAGE);
    return;
  }

  try {
    if (kind === "diagram_activity") {
      await runActivityStep(job as JobRow, params);
    } else {
      // RF-JSON & friends — still a single LLM call, but with an immediate
      // progress message persisted before generation starts.
      await runSingleShotJob(job as JobRow, params);
    }
  } catch (err) {
    const msg = getErrorMessage(err);
    console.error("[diagram-job] step failed:", err);
    // If the user requested cancellation while the step was running, prefer
    // the friendly cancel message over the underlying timeout/abort error.
    const finalMsg = (await isJobCanceled(jobId)) ? CANCELED_MESSAGE : msg;
    await finalizeFailure(params, job as JobRow, finalMsg);
  }
}

// ── Activity-swimlane: per-stage execution ─────────────────────────────────

async function runActivityStep(job: JobRow, params: RunDiagramJobParams): Promise<void> {
  const { lovableApiKey, modelOverride } = params;
  const modelName = modelOverride ?? DEFAULT_AGENT_MODEL;
  const gateway = createLovableAiGatewayProvider(lovableApiKey);
  const model = gateway(modelName);
  const tracker = createUsageTracker();
  const def = OUTPUT_TYPES[params.kind];

  const stage = job.stage ?? "extracting";

  // EXTRACTOR ───────────────────────────────────────────────────────────────
  if (stage === "extracting") {
    const { runExtractorAgent } = await import(
      "@/agents/diagrams/activity-swimlane.server"
    );
    const processMap = await withTimeout(
      runExtractorAgent(model, params.prompt, tracker, modelName),
      STEP_TIMEOUT_MS,
      "extractor step",
    );
    await supabaseAdmin
      .from("diagram_jobs")
      .update({
        status: "processing",
        stage: "building",
        process_map_json: processMap as never,
        next_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    await trackUsage(params, job, tracker, "success", "diagram", "extractor");
    return;
  }

  // BUILDER ─────────────────────────────────────────────────────────────────
  if (stage === "building") {
    if (!job.process_map_json) throw new Error("missing process_map_json before building");
    const { runBuilderAgent } = await import(
      "@/agents/diagrams/activity-swimlane.server"
    );
    const svg = await withTimeout(
      runBuilderAgent(model, job.process_map_json, params.prompt, tracker, modelName),
      STEP_TIMEOUT_MS,
      "builder step",
    );

    // Create diagrams row + chat message immediately so the user sees the
    // first draft right after the builder finishes.
    const title = params.prompt.slice(0, 80) || def.label;
    const { data: diagRow, error: diagErr } = await supabaseAdmin
      .from("diagrams")
      .insert({
        user_id: params.userId,
        thread_id: params.threadId,
        kind: params.kind,
        title,
        prompt: params.prompt,
        mermaid_code: svg,
      })
      .select()
      .single();
    if (diagErr) throw new Error(diagErr.message);

    const content = buildMessageContent(def.label, svg, footer("validating", 0));
    const { data: msgRow, error: msgErr } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        thread_id: params.threadId,
        user_id: params.userId,
        role: "assistant",
        content,
        artifact_kind: "diagram",
        artifact_id: diagRow.id,
      })
      .select("id")
      .single();
    if (msgErr) throw new Error(msgErr.message);

    if (params.isFirstMessage) {
      await supabaseAdmin
        .from("chat_threads")
        .update({ title: title.slice(0, 100) })
        .eq("id", params.threadId);
    } else {
      await supabaseAdmin
        .from("chat_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", params.threadId);
    }

    await supabaseAdmin
      .from("diagram_jobs")
      .update({
        status: "processing",
        stage: "validating",
        current_svg: svg,
        iteration: 0,
        diagram_id: diagRow.id,
        current_message_id: msgRow.id,
        next_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    await trackUsage(params, { ...job, diagram_id: diagRow.id }, tracker, "success", "diagram", "builder");
    return;
  }

  // VALIDATOR ───────────────────────────────────────────────────────────────
  if (stage === "validating") {
    if (!job.current_svg) throw new Error("missing current_svg before validating");
    const { runValidatorAgent } = await import(
      "@/agents/diagrams/activity-swimlane.server"
    );
    const { violations } = await withTimeout(
      runValidatorAgent(model, job.current_svg, params.prompt, tracker, modelName),
      STEP_TIMEOUT_MS,
      "validator step",
    );

    // Finalize if clean OR we've exhausted fix budget.
    if (violations.length === 0 || job.iteration >= MAX_FIX_ITERATIONS) {
      await finalizeSuccess(params, job, job.current_svg, job.iteration);
      return;
    }

    // Schedule fix step.
    if (job.current_message_id) {
      const content = buildMessageContent(def.label, job.current_svg, footer("fixing", job.iteration));
      await supabaseAdmin.from("chat_messages").update({ content }).eq("id", job.current_message_id);
    }

    await supabaseAdmin
      .from("diagram_jobs")
      .update({
        status: "processing",
        stage: "fixing",
        current_violations: violations,
        next_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    await trackUsage(params, job, tracker, "success", "diagram", "validator");
    return;
  }

  // FIXER ───────────────────────────────────────────────────────────────────
  if (stage === "fixing") {
    if (!job.current_svg) throw new Error("missing current_svg before fixing");
    const violations = job.current_violations ?? [];
    const { runFixerAgent } = await import(
      "@/agents/diagrams/activity-swimlane.server"
    );
    const fixed = await withTimeout(
      runFixerAgent(model, job.current_svg, violations, params.prompt, tracker, modelName),
      STEP_TIMEOUT_MS,
      "fixer step",
    );

    // Keep the fix only if it didn't increase structural violations.
    const nextSvg =
      validateActivitySvg(fixed).length <= validateActivitySvg(job.current_svg).length
        ? fixed
        : job.current_svg;
    const nextIteration = job.iteration + 1;

    if (job.diagram_id) {
      await supabaseAdmin
        .from("diagrams")
        .update({ mermaid_code: nextSvg })
        .eq("id", job.diagram_id);
    }
    if (job.current_message_id) {
      const content = buildMessageContent(def.label, nextSvg, footer("validating", nextIteration));
      await supabaseAdmin.from("chat_messages").update({ content }).eq("id", job.current_message_id);
    }

    await supabaseAdmin
      .from("diagram_jobs")
      .update({
        status: "processing",
        stage: "validating",
        current_svg: nextSvg,
        iteration: nextIteration,
        current_violations: null,
        next_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    // Track this fix step's tokens.
    await trackUsage(params, job, tracker, "success", "diagram", "in_progress");
    return;
  }

  throw new Error(`unknown activity stage: ${stage}`);
}

async function finalizeSuccess(
  params: RunDiagramJobParams,
  job: JobRow,
  svg: string,
  iterations: number,
): Promise<void> {
  const def = OUTPUT_TYPES[params.kind];

  // Strip "still working" footer from the chat message.
  if (job.current_message_id) {
    const content = buildMessageContent(def.label, svg, null);
    await supabaseAdmin
      .from("chat_messages")
      .update({ content })
      .eq("id", job.current_message_id);
  }
  if (job.diagram_id) {
    await supabaseAdmin
      .from("diagrams")
      .update({ mermaid_code: svg })
      .eq("id", job.diagram_id);
  }

  await supabaseAdmin
    .from("diagram_jobs")
    .update({
      status: "done",
      stage: "done",
      iterations,
      next_run_at: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  try {
    // Final usage logging (this step's tokens only — earlier steps already logged in-progress).
    await logAiUsage({
      userId: params.userId,
      diagramId: job.diagram_id ?? undefined,
      artifactKind: params.kind,
      status: "success",
      model: params.modelOverride ?? "agent",
      purpose: "diagram",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      docTitle: params.prompt.slice(0, 120) || def.label,
      docType: params.kind,
      wordCount: 0,
    });
  } catch (e) {
    console.error("[diagram-job] final logAiUsage failed:", e);
  }
}

async function finalizeFailure(
  params: RunDiagramJobParams,
  job: JobRow,
  errMsg: string,
): Promise<void> {
  const def = OUTPUT_TYPES[params.kind];
  const isCanceled = errMsg === CANCELED_MESSAGE;
  const placeholderMsg = isCanceled
    ? `יצירת ${def.label} בוטלה.`
    : `אירעה שגיאה ביצירת ${def.label}. אפשר לנסות שוב.\n\nפרטי שגיאה: ${errMsg}`;

  // If we have a partial SVG already in chat, keep it visible (just strip footer) instead of
  // appending a generic error message that overwrites the user's only artifact.
  if (job.current_svg && job.current_message_id) {
    const content = buildMessageContent(def.label, job.current_svg, null);
    await supabaseAdmin
      .from("chat_messages")
      .update({ content })
      .eq("id", job.current_message_id);
    // Append a small follow-up note so the user knows refinement didn't complete.
    try {
      await supabaseAdmin.from("chat_messages").insert({
        thread_id: params.threadId,
        user_id: params.userId,
        role: "assistant",
        content: isCanceled
          ? `שיפור התרשים הופסק לבקשתך. השארתי את הגרסה האחרונה.`
          : `שלב שיפור התרשים נכשל ולכן השארתי את הגרסה האחרונה. אפשר לנסות שוב.\n\nפרטי שגיאה: ${errMsg}`,
      });
    } catch (e) {
      console.error("[diagram-job] failure follow-up insert failed:", e);
    }
  } else if (job.current_message_id) {
    try {
      await supabaseAdmin
        .from("chat_messages")
        .update({ content: placeholderMsg })
        .eq("id", job.current_message_id);
    } catch (e) {
      console.error("[diagram-job] failure placeholder update failed:", e);
    }
  } else {
    try {
      await supabaseAdmin.from("chat_messages").insert({
        thread_id: params.threadId,
        user_id: params.userId,
        role: "assistant",
        content: placeholderMsg,
      });
    } catch (e) {
      console.error("[diagram-job] failure assistant message insert failed:", e);
    }
  }

  try {
    await logAiUsage({
      userId: params.userId,
      diagramId: job.diagram_id ?? undefined,
      artifactKind: params.kind,
      status: "failed",
      model: params.modelOverride ?? "agent",
      purpose: "diagram",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      docTitle: params.prompt.slice(0, 120) || def.label,
      docType: params.kind,
      wordCount: 0,
      errorMessage: errMsg,
    });
  } catch (e) {
    console.error("[diagram-job] failure logAiUsage failed:", e);
  }

  await supabaseAdmin
    .from("diagram_jobs")
    .update({
      status: "failed",
      error_message: errMsg,
      next_run_at: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}

async function trackUsage(
  params: RunDiagramJobParams,
  job: JobRow,
  tracker: ReturnType<typeof createUsageTracker>,
  status: "success" | "failed",
  purpose: "diagram",
  marker: string,
): Promise<void> {
  try {
    const totals = tracker.totals();
    if (totals.totalTokens === 0) return;
    const def = OUTPUT_TYPES[params.kind];
    await logAiUsage({
      userId: params.userId,
      diagramId: job.diagram_id ?? undefined,
      artifactKind: params.kind,
      status,
      model: params.modelOverride ?? "agent",
      purpose,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      totalTokens: totals.totalTokens,
      costUsd: totals.costUsd,
      docTitle: `${params.prompt.slice(0, 100) || def.label} [${marker}]`,
      docType: params.kind,
      wordCount: 0,
    });
  } catch (e) {
    console.error("[diagram-job] usage track failed:", e);
  }
}

// ── Non-activity (RF-JSON) single-shot path ────────────────────────────────

async function runSingleShotJob(job: JobRow, params: RunDiagramJobParams): Promise<void> {
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
  let currentMessageId = job.current_message_id;

  console.info("[diagram-job] RF-JSON start", {
    jobId,
    threadId,
    kind,
    stage: job.stage ?? "generating",
    hasCurrentMessage: Boolean(currentMessageId),
    modelOverride: modelOverride ?? null,
  });

  if (!currentMessageId) {
    const { data: msgRow, error: msgErr } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        thread_id: threadId,
        user_id: userId,
        role: "assistant",
        content: buildRfJsonPendingContent(def.label),
      })
      .select("id")
      .single();
    if (msgErr) throw new Error(msgErr.message);
    currentMessageId = msgRow.id;
  }

  await supabaseAdmin
    .from("diagram_jobs")
    .update({
      status: "processing",
      stage: "generating",
      current_message_id: currentMessageId,
      next_run_at: leaseUntil(RF_JSON_LEASE_MS),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  let json: string;
  try {
    const { runRfJsonDiagramAgent } = await import("@/agents/diagrams/rf-json.server");
    const result = await withTimeout(
      runRfJsonDiagramAgent({
        kind: kind as Exclude<DiagramOutputKey, "diagram_activity">,
        userPrompt: prompt,
        history: priorHistory,
        lovableApiKey,
        modelOverride,
        tracker,
      }),
      STEP_TIMEOUT_MS,
      "diagram generation",
    );
    json = result.json;
    console.info("[diagram-job] RF-JSON generated", {
      jobId,
      kind,
      chars: json.length,
    });
  } catch (err) {
    const msg = getErrorMessage(err);
    console.error("[diagram-job] RF-JSON generation failed", {
      jobId,
      kind,
      message: msg,
    });
    const finalMsg = (await isJobCanceled(jobId)) ? CANCELED_MESSAGE : msg;
    await finalizeFailure(
      params,
      {
        ...job,
        current_message_id: currentMessageId,
        stage: "generating",
      },
      finalMsg,
    );
    return;
  }

  // User may have requested cancellation while the LLM was running. Do not
  // persist a diagram in that case; finalize as canceled and bail out.
  if (await isJobCanceled(jobId)) {
    console.info("[diagram-job] RF-JSON canceled after generation", { jobId });
    await finalizeFailure(
      params,
      { ...job, current_message_id: currentMessageId, stage: "generating" },
      CANCELED_MESSAGE,
    );
    return;
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
      mermaid_code: json,
    })
    .select()
    .single();
  if (diagErr) throw new Error(diagErr.message);

  console.info("[diagram-job] RF-JSON diagram saved", {
    jobId,
    kind,
    diagramId: diagRow.id,
  });

  const content = buildRfJsonMessageContent(def.label, json);
  if (currentMessageId) {
    const { error: msgUpdateErr } = await supabaseAdmin
      .from("chat_messages")
      .update({
        content,
        artifact_kind: "diagram",
        artifact_id: diagRow.id,
      })
      .eq("id", currentMessageId);
    if (msgUpdateErr) throw new Error(msgUpdateErr.message);
  }

  if (isFirstMessage) {
    await supabaseAdmin.from("chat_threads").update({ title: title.slice(0, 100) }).eq("id", threadId);
  } else {
    await supabaseAdmin
      .from("chat_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId);
  }

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
  } catch (e) {
    console.error("[diagram-job] success logAiUsage failed:", e);
  }

  await supabaseAdmin
    .from("diagram_jobs")
    .update({
      status: "done",
      stage: "done",
      current_message_id: currentMessageId,
      diagram_id: diagRow.id,
      next_run_at: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  console.info("[diagram-job] RF-JSON done", {
    jobId,
    kind,
    diagramId: diagRow.id,
    currentMessageId,
  });
}
