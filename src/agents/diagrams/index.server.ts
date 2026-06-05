import { generateText } from "ai";
import { z } from "zod";
import type { AgentContext, DiagramsOutput, UseCasesOutput } from "@/agents/shared/types";
import type { ArchitectureOutput } from "@/agents/shared/types";
import type { DataModelOutput } from "@/agents/shared/types";
import { AGENT_MODELS, AGENT_TEMPERATURES } from "@/agents/shared/constants";
import { extractJson } from "@/lib/spec-output-schema";
import {
  buildSelfCritiqueInstruction,
  JSON_ONLY_INSTRUCTION,
} from "@/agents/shared/prompt-helpers";
import { DIAGRAMS_SYSTEM } from "./system";
import type { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { UsageTracker } from "@/lib/ai-usage.server";

const OutputSchema = z.object({
  use_case_diagrams: z
    .array(z.object({ id: z.string(), diagram: z.string() }))
    .default([]),
  architecture_diagram: z.string().optional(),
  data_model_diagram: z.string().optional(),
});

const SELF_CRITIQUE = buildSelfCritiqueInstruction([
  "כל מזהה צומת (node ID): ASCII בלבד?",
  "אין עטיפת ``` סביב הקוד?",
  "sequenceDiagram מתחיל במילה sequenceDiagram?",
  "erDiagram מתחיל במילה erDiagram?",
]);

function buildPrompt(
  ctx: AgentContext,
  useCases: UseCasesOutput,
  arch: ArchitectureOutput,
  dm: DataModelOutput,
): string {
  const useCasesList = useCases.use_cases
    .map((uc) => `id: ${uc.id}\nכותרת: ${uc.title}\nתיאור: ${uc.description}`)
    .join("\n\n");

  return [
    "## בקשת המשתמש\n" + ctx.userPrompt,
    "## תרחישי שימוש לדיאגרמות",
    useCasesList,
    "## תיאור ארכיטקטורה\n" + arch.architecture.description,
    "## תיאור מודל נתונים\n" + dm.data_model.description,
    `
יצור דיאגרמות Mermaid עבור:
1. כל תרחיש שימוש: sequenceDiagram שמציג את זרימת הפעולות
2. ארכיטקטורה: flowchart TD (רק אם הדיאגרמה הקיימת חסרה או קצרה מ-100 תווים)
3. מודל נתונים: erDiagram (רק אם הדיאגרמה הקיימת חסרה או קצרה מ-100 תווים)

סכמת JSON לפלט:
{
  "use_case_diagrams": [{ "id": string, "diagram": string }],
  "architecture_diagram": string,
  "data_model_diagram": string
}
${JSON_ONLY_INSTRUCTION}`,
    SELF_CRITIQUE,
    `ארכיטקטורה קיימת (${arch.architecture.diagram.length} תווים): ${arch.architecture.diagram.slice(0, 50)}...`,
    `מודל נתונים קיים (${dm.data_model.diagram.length} תווים): ${dm.data_model.diagram.slice(0, 50)}...`,
  ].join("\n\n");
}

export async function runDiagramsAgent(
  ctx: AgentContext,
  useCases: UseCasesOutput,
  arch: ArchitectureOutput,
  dm: DataModelOutput,
  gateway: ReturnType<typeof createLovableAiGatewayProvider>,
  tracker?: UsageTracker,
): Promise<DiagramsOutput> {
  const model = ctx.model ?? AGENT_MODELS.diagrams;
  const { text, usage } = await generateText({
    model: gateway(model),
    system: DIAGRAMS_SYSTEM,
    prompt: buildPrompt(ctx, useCases, arch, dm),
    maxOutputTokens: 4000,
    temperature: AGENT_TEMPERATURES.diagrams,
  });
  tracker?.track(model, usage);
  try {
    return OutputSchema.parse(JSON.parse(extractJson(text)));
  } catch {
    const { text: text2, usage: usage2 } = await generateText({
      model: gateway(model),
      system: DIAGRAMS_SYSTEM,
      prompt: buildPrompt(ctx, useCases, arch, dm) + "\n\nהחזר JSON תקני בלבד.",
      maxOutputTokens: 4000,
      temperature: 0,
    });
    tracker?.track(model, usage2);
    return OutputSchema.parse(JSON.parse(extractJson(text2)));
  }
}
