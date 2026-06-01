// Server-only: Multi-agent orchestrator.
// Runs specialized agents in a staged pipeline with selective revision.

import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { loadKnowledgeContextBlock } from "@/lib/knowledge-context.server";
import { resolveSystemInstruction } from "@/lib/doc-type-instructions.server";
import type { DocTypeKey } from "@/lib/doc-types";
import type { SpecOutput } from "@/lib/spec-output-schema";
import { retrieveContext } from "./rag.server";
import {
  ArchitectureAgentSchema,
  DataModelAgentSchema,
  RequirementsAgentSchema,
  ReviewAgentSchema,
  TitleAgentSchema,
  UseCasesAgentSchema,
  type ArchitectureOutput,
  type DataModelOutput,
  type RequirementsOutput,
  type ReviewAgentOutput,
  type StageKey,
  type UseCasesOutput,
} from "./schemas";

const WORKER_MODEL = "google/gemini-3-flash-preview";
const REVIEWER_MODEL = "google/gemini-2.5-pro";

export const SCORE_THRESHOLD = 8;
export const MAX_ITERATIONS = 2;

const COMMON_RULES = [
  "כתוב בעברית מקצועית וברורה.",
  "כל פריט ברשימה חייב לקבל id ייחודי קצר (למשל req-1, p-1, uc-1).",
  "אל תעטוף קוד Mermaid ב-``` ואל תוסיף סימני markdown סביב הפלט.",
  "תוויות צמתים ב-Mermaid יכולות להיות בעברית, אבל מזהי הצמתים (USER, ORDER) חייבים להיות ASCII קצר.",
].join("\n");

export type ProgressEmitter = (line: string) => void;

interface RunParams {
  userPrompt: string;
  docType: DocTypeKey;
  userId: string;
  projectId: string | null;
  apiKey: string;
  previousSpec?: Record<string, unknown>;
  reviewerNotes?: string[];
  emit: ProgressEmitter;
}

export interface OrchestratorResult {
  spec: SpecOutput;
  review: ReviewAgentOutput | null;
  iterations: number;
  iterationsRequested: number;
  iterationsSkippedNoCredits: number;
  ragChunkCount: number;
}

function emitStage(emit: ProgressEmitter, stage: StageKey, phase: "start" | "done") {
  emit(`__STAGE__:${stage}:${phase}\n`);
}

interface AgentCtx {
  prompt: string; // contextual user prompt (with RAG + knowledge prepended)
  docInstruction: string;
  isRevision: boolean;
  reviewerNotes: string[];
  previousSpec?: Record<string, unknown>;
}

function buildAgentPrompt(
  ctx: AgentCtx,
  agentLabel: string,
  agentSpecificInstruction: string,
  previousSection?: unknown,
) {
  const lines: string[] = [];
  lines.push(`אתה האג'נט המומחה ל${agentLabel}.`);
  lines.push(agentSpecificInstruction);
  lines.push("");
  lines.push(COMMON_RULES);
  lines.push("");
  lines.push(ctx.prompt);
  if (ctx.isRevision && ctx.reviewerNotes.length > 0) {
    lines.push("");
    lines.push("## הערות שיפור ממבקר איכות (חובה לטפל בהן):");
    ctx.reviewerNotes.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
  }
  if (previousSection !== undefined) {
    lines.push("");
    lines.push("## הסעיף הקודם שלך (JSON) — שפר אותו, אל תתחיל מאפס:");
    lines.push(JSON.stringify(previousSection, null, 2));
  }
  return lines.join("\n");
}

async function runStructured<S extends z.ZodTypeAny>(
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
  schema: S,
  maxOutputTokens: number,
): Promise<z.output<S>> {
  const gateway = createLovableAiGatewayProvider(apiKey);
  const { output } = await generateText({
    model: gateway(model),
    system,
    prompt,
    maxOutputTokens,
    output: Output.object({ schema }),
  });
  // The AI SDK's inferred type uses the schema's INPUT type (where .default
  // makes fields optional); the runtime value is the OUTPUT type with all
  // defaults applied. Re-parse to satisfy TypeScript and guarantee shape.
  return schema.parse(output) as z.output<S>;
}

// ─── Agents ──────────────────────────────────────────────────────────────────

async function runRequirementsAgent(
  ctx: AgentCtx,
  apiKey: string,
): Promise<RequirementsOutput> {
  const instruction = [
    "תפקידך: לייצר את סעיפי הדרישות והבסיס למסמך:",
    "overview (פסקה ברורה), goals (לפחות 3), personas (לפחות 2),",
    "functional_requirements (לפחות 5), non_functional_requirements (לפחות 3 — ביצועים/אבטחה/נגישות וכו'),",
    "assumptions (לפחות 3 — דברים שלא צוינו אך הנחת), risks (לפחות 3).",
  ].join("\n");
  const prompt = buildAgentPrompt(
    ctx,
    "דרישות והגדרת מערכת",
    instruction,
    ctx.previousSpec
      ? {
          overview: ctx.previousSpec.overview,
          goals: ctx.previousSpec.goals,
          personas: ctx.previousSpec.personas,
          functional_requirements: ctx.previousSpec.functional_requirements,
          non_functional_requirements: ctx.previousSpec.non_functional_requirements,
          assumptions: ctx.previousSpec.assumptions,
          risks: ctx.previousSpec.risks,
        }
      : undefined,
  );
  return runStructured(
    apiKey,
    WORKER_MODEL,
    ctx.docInstruction,
    prompt,
    RequirementsAgentSchema,
    4000,
  );
}

async function runArchitectureAgent(
  ctx: AgentCtx,
  requirements: RequirementsOutput,
  apiKey: string,
): Promise<ArchitectureOutput> {
  const instruction = [
    "תפקידך: לייצר את סעיף ה-ארכיטקטורה.",
    "description: פסקה אחת או שתיים שמתארות את הרכיבים המרכזיים, השכבות, ואינטגרציות.",
    "diagram: תרשים Mermaid מסוג graph TD או flowchart TD שמדגים את הרכיבים והקשרים. חובה.",
  ].join("\n");
  const prompt = buildAgentPrompt(
    ctx,
    "ארכיטקטורת מערכת",
    instruction,
    ctx.previousSpec?.architecture,
  );
  const enriched = `${prompt}\n\n## הדרישות שגובשו (לקריאה בלבד):\n${JSON.stringify(
    {
      functional_requirements: requirements.functional_requirements,
      non_functional_requirements: requirements.non_functional_requirements,
    },
    null,
    2,
  )}`;
  return runStructured(
    apiKey,
    WORKER_MODEL,
    ctx.docInstruction,
    enriched,
    ArchitectureAgentSchema,
    2500,
  );
}

async function runDataModelAgent(
  ctx: AgentCtx,
  requirements: RequirementsOutput,
  apiKey: string,
): Promise<DataModelOutput> {
  const instruction = [
    "תפקידך: לייצר את סעיף ה-מודל נתונים.",
    "description: תיאור הישויות העיקריות, השדות החשובים, והקשרים.",
    "diagram: תרשים Mermaid מסוג erDiagram. חובה.",
  ].join("\n");
  const prompt = buildAgentPrompt(
    ctx,
    "מודל נתונים",
    instruction,
    ctx.previousSpec?.data_model,
  );
  const enriched = `${prompt}\n\n## הדרישות שגובשו (לקריאה בלבד):\n${JSON.stringify(
    requirements.functional_requirements,
    null,
    2,
  )}`;
  return runStructured(
    apiKey,
    WORKER_MODEL,
    ctx.docInstruction,
    enriched,
    DataModelAgentSchema,
    2500,
  );
}

async function runUseCasesAgent(
  ctx: AgentCtx,
  requirements: RequirementsOutput,
  apiKey: string,
): Promise<UseCasesOutput> {
  const instruction = [
    "תפקידך: לייצר תרחישי שימוש (use_cases). לפחות 3.",
    "כל תרחיש: title, description (זרימת השלבים בעברית), diagram (Mermaid sequenceDiagram — אופציונלי, אך מומלץ לתרחישים מורכבים; השאר '' אם לא רלוונטי).",
  ].join("\n");
  const prompt = buildAgentPrompt(
    ctx,
    "תרחישי שימוש",
    instruction,
    ctx.previousSpec?.use_cases,
  );
  const enriched = `${prompt}\n\n## הפרסונות והדרישות (לקריאה בלבד):\n${JSON.stringify(
    {
      personas: requirements.personas,
      functional_requirements: requirements.functional_requirements,
    },
    null,
    2,
  )}`;
  return runStructured(
    apiKey,
    WORKER_MODEL,
    ctx.docInstruction,
    enriched,
    UseCasesAgentSchema,
    4000,
  );
}

async function runTitleAgent(
  userPrompt: string,
  requirements: RequirementsOutput,
  apiKey: string,
): Promise<string> {
  try {
    const out = await runStructured(
      apiKey,
      WORKER_MODEL,
      "אתה כותב כותרות תמציתיות למסמכי אפיון מערכת בעברית.",
      `המשתמש ביקש:\n${userPrompt}\n\nסקירה כללית של המסמך:\n${requirements.overview}\n\nכתוב כותרת קצרה (3-7 מילים) למסמך.`,
      TitleAgentSchema,
      200,
    );
    return out.title?.trim() || "מסמך אפיון";
  } catch {
    return "מסמך אפיון";
  }
}

async function runReviewAgent(
  spec: SpecOutput,
  userPrompt: string,
  apiKey: string,
): Promise<ReviewAgentOutput> {
  const system = [
    "אתה מבקר איכות בכיר של מסמכי אפיון מערכת.",
    "דרג את המסמך בציון שלם 1-10 על שלמות, עקביות, פירוט, בהירות, וכיסוי הפרומפט.",
    "כתוב עד 8 הערות שיפור — קצרות, קונקרטיות, בעברית.",
    "לכל הערה הוסף importance שלם 1-10, וגם target — לאיזה אג'נט היא שייכת:",
    "requirements (overview/goals/personas/דרישות/הנחות/סיכונים), architecture (ארכיטקטורה),",
    "data_model (מודל נתונים), use_cases (תרחישים), general (אחר).",
    "אם המסמך מצוין באמת — החזר notes ריק.",
  ].join("\n");
  const prompt = [
    "## הפרומפט המקורי של המשתמש:",
    userPrompt,
    "",
    "## מסמך האפיון להערכה (JSON):",
    JSON.stringify(spec, null, 2),
  ].join("\n");

  return runStructured(apiKey, REVIEWER_MODEL, system, prompt, ReviewAgentSchema, 2500);
}

// ─── Assembly ────────────────────────────────────────────────────────────────

function assemble(
  title: string,
  requirements: RequirementsOutput,
  architecture: ArchitectureOutput,
  dataModel: DataModelOutput,
  useCases: UseCasesOutput,
): SpecOutput {
  return {
    title,
    overview: requirements.overview,
    goals: requirements.goals,
    personas: requirements.personas,
    functional_requirements: requirements.functional_requirements,
    non_functional_requirements: requirements.non_functional_requirements,
    assumptions: requirements.assumptions,
    use_cases: useCases.use_cases,
    architecture,
    data_model: dataModel,
    risks: requirements.risks,
  };
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export async function runOrchestrator(
  params: RunParams,
  options: {
    scoreThreshold?: number;
    maxIterations?: number;
    canSpendIterationCredit: () => Promise<boolean>;
  },
): Promise<OrchestratorResult> {
  const {
    userPrompt,
    docType,
    userId,
    projectId,
    apiKey,
    previousSpec,
    reviewerNotes,
    emit,
  } = params;
  const scoreThreshold = options.scoreThreshold ?? SCORE_THRESHOLD;
  const maxIterations = options.maxIterations ?? MAX_ITERATIONS;

  emitStage(emit, "context", "start");
  const [knowledgeBlock, docInstruction, ragResult] = await Promise.all([
    loadKnowledgeContextBlock(userId, projectId),
    resolveSystemInstruction(docType),
    retrieveContext({ query: userPrompt, userId, projectId, apiKey }),
  ]);
  emitStage(emit, "context", "done");

  const contextualPrompt = `${ragResult.contextBlock}${knowledgeBlock}## הפרומפט של המשתמש:\n${userPrompt}`;

  const initialIsRevision =
    !!previousSpec &&
    Array.isArray(reviewerNotes) &&
    reviewerNotes.length > 0;

  const baseCtx: AgentCtx = {
    prompt: contextualPrompt,
    docInstruction,
    isRevision: initialIsRevision,
    reviewerNotes: reviewerNotes ?? [],
    previousSpec,
  };

  emitStage(emit, "requirements", "start");
  const requirements = await runRequirementsAgent(baseCtx, apiKey);
  emitStage(emit, "requirements", "done");

  emitStage(emit, "architecture", "start");
  emitStage(emit, "data_model", "start");
  const [architecture, dataModel] = await Promise.all([
    runArchitectureAgent(baseCtx, requirements, apiKey),
    runDataModelAgent(baseCtx, requirements, apiKey),
  ]);
  emitStage(emit, "architecture", "done");
  emitStage(emit, "data_model", "done");

  emitStage(emit, "use_cases", "start");
  emitStage(emit, "title", "start");
  const [useCases, title] = await Promise.all([
    runUseCasesAgent(baseCtx, requirements, apiKey),
    runTitleAgent(userPrompt, requirements, apiKey),
  ]);
  emitStage(emit, "use_cases", "done");
  emitStage(emit, "title", "done");

  let currentSpec = assemble(title, requirements, architecture, dataModel, useCases);
  let currentReq = requirements;
  let currentArch = architecture;
  let currentData = dataModel;
  let currentUC = useCases;

  emitStage(emit, "review", "start");
  let currentReview: ReviewAgentOutput | null = null;
  try {
    currentReview = await runReviewAgent(currentSpec, userPrompt, apiKey);
  } catch (e) {
    console.error("[orchestrator] review failed (non-fatal):", e);
  }
  emitStage(emit, "review", "done");

  let iterations = 1;
  let iterationsRequested = 0;
  let iterationsSkipped = 0;

  while (
    currentReview &&
    currentReview.score < scoreThreshold &&
    iterations < maxIterations &&
    currentReview.notes.length > 0
  ) {
    iterationsRequested++;
    const allowed = await options.canSpendIterationCredit();
    if (!allowed) {
      iterationsSkipped++;
      emit(`__INFO__:iteration_skipped:no_credits\n`);
      break;
    }

    emitStage(emit, "iterate", "start");

    const targets = new Set(currentReview.notes.map((n) => n.target));
    const notesByTarget = (t: string) =>
      currentReview!.notes
        .filter((n) => n.target === t || (t === "requirements" && n.target === "general"))
        .map((n) => n.text);

    const reqCtx: AgentCtx = {
      ...baseCtx,
      previousSpec: currentSpec as unknown as Record<string, unknown>,
      isRevision: true,
      reviewerNotes: notesByTarget("requirements"),
    };

    if (targets.has("requirements") || targets.has("general")) {
      currentReq = await runRequirementsAgent(reqCtx, apiKey);
    }
    const archCtx = { ...reqCtx, reviewerNotes: notesByTarget("architecture") };
    const dataCtx = { ...reqCtx, reviewerNotes: notesByTarget("data_model") };
    const ucCtx = { ...reqCtx, reviewerNotes: notesByTarget("use_cases") };

    const tasks: Promise<unknown>[] = [];
    if (targets.has("architecture")) {
      tasks.push(
        runArchitectureAgent(archCtx, currentReq, apiKey).then((r) => {
          currentArch = r;
        }),
      );
    }
    if (targets.has("data_model")) {
      tasks.push(
        runDataModelAgent(dataCtx, currentReq, apiKey).then((r) => {
          currentData = r;
        }),
      );
    }
    if (targets.has("use_cases")) {
      tasks.push(
        runUseCasesAgent(ucCtx, currentReq, apiKey).then((r) => {
          currentUC = r;
        }),
      );
    }
    await Promise.all(tasks);

    currentSpec = assemble(title, currentReq, currentArch, currentData, currentUC);
    emitStage(emit, "iterate", "done");

    emitStage(emit, "review", "start");
    try {
      currentReview = await runReviewAgent(currentSpec, userPrompt, apiKey);
    } catch (e) {
      console.error("[orchestrator] iter-review failed:", e);
      break;
    }
    emitStage(emit, "review", "done");
    iterations++;
  }

  return {
    spec: currentSpec,
    review: currentReview,
    iterations,
    iterationsRequested,
    iterationsSkippedNoCredits: iterationsSkipped,
    ragChunkCount: ragResult.chunkCount,
  };
}
