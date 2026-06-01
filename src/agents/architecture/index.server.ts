import { generateText } from "ai";
import { z } from "zod";
import type { AgentContext, ArchitectureOutput, RequirementsOutput } from "@/agents/shared/types";
import { AGENT_MODELS, AGENT_TEMPERATURES } from "@/agents/shared/constants";
import { extractJson } from "@/lib/spec-output-schema";
import {
  buildRagBlock,
  buildThinkingInstruction,
  buildSelfCritiqueInstruction,
  JSON_ONLY_INSTRUCTION,
} from "@/agents/shared/prompt-helpers";
import { ARCHITECTURE_SYSTEM } from "./system";
import type { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

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
): Promise<ArchitectureOutput> {
  const { text } = await generateText({
    model: gateway(AGENT_MODELS.architecture),
    system: ARCHITECTURE_SYSTEM,
    prompt: buildPrompt(ctx, reqs),
    maxOutputTokens: 3000,
    temperature: AGENT_TEMPERATURES.architecture,
  });
  try {
    return OutputSchema.parse(JSON.parse(extractJson(text)));
  } catch {
    const { text: text2 } = await generateText({
      model: gateway(AGENT_MODELS.architecture),
      system: ARCHITECTURE_SYSTEM,
      prompt: buildPrompt(ctx, reqs) + "\n\nהחזר JSON תקני בלבד.",
      maxOutputTokens: 3000,
      temperature: 0,
    });
    return OutputSchema.parse(JSON.parse(extractJson(text2)));
  }
}
