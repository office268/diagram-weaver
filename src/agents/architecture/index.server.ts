// ============================================================
// src/agents/architecture/index.server.ts
// מודול server-only — index.server.ts
// מורץ רק בצד השרת (TanStack Start)
// ============================================================
import { z } from "zod";
import type { AgentContext, ArchitectureOutput, RequirementsOutput } from "@/agents/shared/types";
import { AGENT_MODELS, AGENT_TEMPERATURES, AGENT_MAX_OUTPUT_TOKENS } from "@/agents/shared/constants";
import { generateWithRetry } from "@/agents/shared/generate-with-retry.server";
import {
  buildRagBlock,
  buildThinkingInstruction,
  buildSelfCritiqueInstruction,
  JSON_ONLY_INSTRUCTION,
} from "@/agents/shared/prompt-helpers";
import { ARCHITECTURE_SYSTEM } from "./system";
import type { createLovableAiGatewayProvider } from "@/lib/ai/gateway.server";
import type { UsageTracker } from "@/lib/ai/usage.server";

const OutputSchema = z.object({
  architecture: z.object({
    description: z.string().default(""),
    diagram: z.string().default(""),
  }),
});

const THINKING = buildThinkingInstruction([
  "מה הרכיבים המרכזיים של המערכת?",
  "אילו שירותים חיצוניים נדרשים?",
  "איך הנתונים זורמים בין הרכיבים?",
]);

const SELF_CRITIQUE = buildSelfCritiqueInstruction([
  "כל רכיב בדיאגרמה מוצדק על ידי דרישה?",
  "מזהי צמתים: ASCII קצר בלבד?",
  "הדיאגרמה מציגה את הרכיבים המרכזיים ואת הקשרים ביניהם?",
]);

function buildPrompt(ctx: AgentContext, reqs: RequirementsOutput): string {
  const parts: string[] = [];
  if (ctx.knowledgeBlock) parts.push(ctx.knowledgeBlock);
  if (ctx.ragContext) parts.push(buildRagBlock(ctx.ragContext));
  parts.push(THINKING);
  parts.push("## דרישות המערכת\n" + JSON.stringify(reqs, null, 2));
  parts.push("## בקשת המשתמש\n" + ctx.userPrompt);
  parts.push(`
סכמת JSON לפלט:
{ "architecture": { "description": string, "diagram": string } }
description: תיאור טקסטואלי מפורט של הארכיטקטורה בעברית.
diagram: קוד Mermaid תקני (flowchart TD), ASCII node IDs.
${JSON_ONLY_INSTRUCTION}`);
  parts.push(SELF_CRITIQUE);
  return parts.join("\n\n");
}

export async function runArchitectureAgent(
  ctx: AgentContext,
  reqs: RequirementsOutput,
  gateway: ReturnType<typeof createLovableAiGatewayProvider>,
  tracker?: UsageTracker,
): Promise<ArchitectureOutput> {
  const model = ctx.model ?? AGENT_MODELS.architecture;
  return (await generateWithRetry(
    {
      gateway,
      model,
      system: ARCHITECTURE_SYSTEM,
      prompt: buildPrompt(ctx, reqs),
      maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS.architecture,
      temperature: AGENT_TEMPERATURES.architecture,
    },
    OutputSchema,
    tracker,
  )) as ArchitectureOutput;
}
