// ============================================================
// src/agents/diagrams/index.server.ts
// מודול server-only — index.server.ts
// מורץ רק בצד השרת (TanStack Start)
// ============================================================
// Diagrams agent — unified pipeline.
// Produces React-Flow JSON for every diagram in the spec by delegating to
// the same agent used by the chat ("runRfJsonDiagramAgent"). No Mermaid
// is generated here — single pipeline, single quality bar.

import type {
  AgentContext,
  DiagramsOutput,
  UseCasesOutput,
  ArchitectureOutput,
  DataModelOutput,
} from "@/agents/shared/types";
import type { UsageTracker } from "@/lib/ai-usage.server";
import { runRfJsonDiagramAgent } from "./rf-json.server";

interface RunInput {
  ctx: AgentContext;
  useCases: UseCasesOutput;
  architecture: ArchitectureOutput;
  dataModel: DataModelOutput;
  lovableApiKey: string;
  tracker?: UsageTracker;
}

/**
 * Build a per-use-case prompt for a sequence diagram.
 */
function useCasePrompt(uc: UseCasesOutput["use_cases"][number]): string {
  return [
    "צור תרשים Sequence עבור התרחיש הבא:",
    `כותרת: ${uc.title}`,
    "תיאור:",
    uc.description,
    "",
    "כלול את כל ה-lifelines (משתמשים/רכיבים) הרלוונטיים ואת סדר ההודעות ביניהם.",
  ].join("\n");
}

function architecturePrompt(ctx: AgentContext, arch: ArchitectureOutput): string {
  return [
    "צור תרשים זרימה (Flow) עבור הארכיטקטורה הבאה:",
    arch.architecture.description,
    "",
    "הקשר העל של הבקשה:",
    ctx.userPrompt,
  ].join("\n");
}

function dataModelPrompt(ctx: AgentContext, dm: DataModelOutput): string {
  return [
    "צור תרשים ERD עבור מודל הנתונים הבא:",
    dm.data_model.description,
    "",
    "הקשר העל של הבקשה:",
    ctx.userPrompt,
  ].join("\n");
}

/**
 * Run the diagrams stage. Uses the unified RF-JSON diagram agent for every
 * diagram. Failures on individual diagrams are tolerated — the spec is
 * assembled with whatever succeeded.
 */
export async function runDiagramsAgent(input: RunInput): Promise<DiagramsOutput> {
  const { ctx, useCases, architecture, dataModel, lovableApiKey, tracker } = input;

  const safe = async <T>(label: string, p: Promise<T>): Promise<T | null> => {
    try {
      return await p;
    } catch (err) {
      console.warn(
        `[diagrams-agent] ${label} failed:`,
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  };

  // Run all diagrams in parallel — each call is independent.
  const useCasePromises = useCases.use_cases.map((uc) =>
    safe(
      `sequence:${uc.id}`,
      runRfJsonDiagramAgent({
        kind: "diagram_sequence",
        userPrompt: useCasePrompt(uc),
        history: [],
        lovableApiKey,
        modelOverride: ctx.model,
        tracker,
      }),
    ).then((r) => (r ? { id: uc.id, diagram: r.json } : null)),
  );

  const archPromise = safe(
    "architecture",
    runRfJsonDiagramAgent({
      kind: "diagram_flow",
      userPrompt: architecturePrompt(ctx, architecture),
      history: [],
      lovableApiKey,
      modelOverride: ctx.model,
      tracker,
    }),
  );

  const dmPromise = safe(
    "data-model",
    runRfJsonDiagramAgent({
      kind: "diagram_erd",
      userPrompt: dataModelPrompt(ctx, dataModel),
      history: [],
      lovableApiKey,
      modelOverride: ctx.model,
      tracker,
    }),
  );

  const [useCaseResults, archResult, dmResult] = await Promise.all([
    Promise.all(useCasePromises),
    archPromise,
    dmPromise,
  ]);

  return {
    use_case_diagrams: useCaseResults.filter((x): x is { id: string; diagram: string } => !!x),
    architecture_diagram: archResult?.json,
    data_model_diagram: dmResult?.json,
  };
}
