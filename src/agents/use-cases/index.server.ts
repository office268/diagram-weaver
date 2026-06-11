// ============================================================
// src/agents/use-cases/index.server.ts
// מודול server-only — index.server.ts
// מורץ רק בצד השרת (TanStack Start)
// ============================================================
import { z } from "zod";
import type { AgentContext, UseCasesOutput, RequirementsOutput } from "@/agents/shared/types";
import { AGENT_MODELS, AGENT_TEMPERATURES, AGENT_MAX_OUTPUT_TOKENS } from "@/agents/shared/constants";
import { generateWithRetry } from "@/agents/shared/generate-with-retry.server";
import {
  buildRagBlock,
  buildThinkingInstruction,
  buildSelfCritiqueInstruction,
  JSON_ONLY_INSTRUCTION,
} from "@/agents/shared/prompt-helpers";
import { USE_CASES_SYSTEM } from "./system";
import type { createLovableAiGatewayProvider } from "@/lib/ai/gateway.server";
import type { UsageTracker } from "@/lib/ai/usage.server";

const PersonaSchema = z.object({
  id: z.string().default(""),
  name: z.string().default(""),
  description: z.string().default(""),
});
const UseCaseSchema = z.object({
  id: z.string().default(""),
  title: z.string().default(""),
  description: z.string().default(""),
  diagram: z.string().default(""),
});
const OutputSchema = z.object({
  overview: z.string().default(""),
  personas: z.array(PersonaSchema).default([]),
  use_cases: z.array(UseCaseSchema).default([]),
});

const THINKING = buildThinkingInstruction([
  "מי הם המשתמשים הראשיים של המערכת?",
  "מה הפעולות הקריטיות שהם מבצעים?",
  "אילו תרחישים מייצגים את השימוש הנפוץ ביותר?",
]);

const SELF_CRITIQUE = buildSelfCritiqueInstruction([
  "יש לפחות 2 personas ו-2 use cases?",
  "כל use case: ברור מי עושה מה ומה התוצאה?",
  "שדה diagram ריק (יימולא מאוחר יותר)?",
]);

function buildPrompt(ctx: AgentContext, reqs: RequirementsOutput): string {
  const parts: string[] = [];
  if (ctx.knowledgeBlock) parts.push(ctx.knowledgeBlock);
  if (ctx.ragContext) parts.push(buildRagBlock(ctx.ragContext));
  parts.push(THINKING);
  parts.push("## דרישות המערכת\n" + JSON.stringify(reqs.functional_requirements, null, 2));
  parts.push("## בקשת המשתמש\n" + ctx.userPrompt);
  parts.push(`
סכמת JSON לפלט:
{
  "overview": string,
  "personas": [{ "id": string, "name": string, "description": string }],
  "use_cases": [{ "id": string, "title": string, "description": string, "diagram": "" }]
}
overview: סקירה כללית של המערכת בעברית (פסקה אחת).
השאר את שדה diagram ריק ("") — יימולא בשלב הבא.
מינימום: 2 personas, 2 use cases.
${JSON_ONLY_INSTRUCTION}`);
  parts.push(SELF_CRITIQUE);
  return parts.join("\n\n");
}

export async function runUseCasesAgent(
  ctx: AgentContext,
  reqs: RequirementsOutput,
  gateway: ReturnType<typeof createLovableAiGatewayProvider>,
  tracker?: UsageTracker,
): Promise<UseCasesOutput> {
  const model = ctx.model ?? AGENT_MODELS.useCases;
  return generateWithRetry(
    {
      gateway,
      model,
      system: USE_CASES_SYSTEM,
      prompt: buildPrompt(ctx, reqs),
      maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS.useCases,
      temperature: AGENT_TEMPERATURES.useCases,
    },
    OutputSchema,
    tracker,
  );
}
