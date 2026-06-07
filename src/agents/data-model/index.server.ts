import { generateText } from "ai";
import { z } from "zod";
import type { AgentContext, DataModelOutput, RequirementsOutput } from "@/agents/shared/types";
import { AGENT_MODELS, AGENT_TEMPERATURES } from "@/agents/shared/constants";
import { extractJson } from "@/lib/spec-output-schema";
import {
  buildRagBlock,
  buildThinkingInstruction,
  buildSelfCritiqueInstruction,
  JSON_ONLY_INSTRUCTION,
} from "@/agents/shared/prompt-helpers";
import { DATA_MODEL_SYSTEM } from "./system";
import type { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { UsageTracker } from "@/lib/ai-usage.server";

const OutputSchema = z.object({
  data_model: z.object({
    description: z.string().default(""),
    diagram: z.string().default(""),
  }),
});

const THINKING = buildThinkingInstruction([
  "מה הישויות המרכזיות במערכת?",
  "מה הקשרים בין הישויות?",
  "אילו שדות הכרחיים לכל ישות?",
  "אילו NFRs קיימים ואיך הם משפיעים על עיצוב הסכמה?",
  "האם נדרשים soft delete, audit fields, או הפרדת נתונים רגישים?",
]);

const SELF_CRITIQUE = buildSelfCritiqueInstruction([
  "כל ישות בדיאגרמה מוצדקת על ידי דרישה?",
  "מזהי ישויות: ASCII בלבד?",
  "הדיאגרמה erDiagram תקנית?",
  "NFRs של ביצועים/אבטחה/היסטוריה באים לידי ביטוי בתיאור?",
]);

function buildPrompt(ctx: AgentContext, reqs: RequirementsOutput): string {
  const parts: string[] = [];
  if (ctx.knowledgeBlock) parts.push(ctx.knowledgeBlock);
  if (ctx.ragContext) parts.push(buildRagBlock(ctx.ragContext));
  parts.push(THINKING);
  parts.push("## דרישות פונקציונליות\n" + JSON.stringify(reqs.functional_requirements, null, 2));

  if (reqs.non_functional_requirements?.length) {
    parts.push(
      "## דרישות אי-פונקציונליות (NFR) — תרגם להחלטות עיצוב\n" +
        JSON.stringify(reqs.non_functional_requirements, null, 2),
    );
  }

  parts.push("## בקשת המשתמש\n" + ctx.userPrompt);
  parts.push(`
סכמת JSON לפלט:
{ "data_model": { "description": string, "diagram": string } }
description: תיאור טקסטואלי של מודל הנתונים בעברית, כולל הסבר על החלטות עיצוב שנובעות מה-NFRs.
diagram: קוד erDiagram תקני, ASCII entity names.
${JSON_ONLY_INSTRUCTION}`);
  parts.push(SELF_CRITIQUE);
  return parts.join("\n\n");
}

export async function runDataModelAgent(
  ctx: AgentContext,
  reqs: RequirementsOutput,
  gateway: ReturnType<typeof createLovableAiGatewayProvider>,
  tracker?: UsageTracker,
): Promise<DataModelOutput> {
  const model = ctx.model ?? AGENT_MODELS.dataModel;
  const { text, usage } = await generateText({
    model: gateway(model),
    system: DATA_MODEL_SYSTEM,
    prompt: buildPrompt(ctx, reqs),
    maxOutputTokens: 6000,
    temperature: AGENT_TEMPERATURES.dataModel,
  });
  tracker?.track(model, usage);
  try {
    return OutputSchema.parse(JSON.parse(extractJson(text)));
  } catch {
    const { text: text2, usage: usage2 } = await generateText({
      model: gateway(model),
      system: DATA_MODEL_SYSTEM,
      prompt: buildPrompt(ctx, reqs) + "\n\nהחזר JSON תקני בלבד, ללא ```json fences. אל תקצר.",
      maxOutputTokens: 8000,
      temperature: 0,
    });
    tracker?.track(model, usage2);
    return OutputSchema.parse(JSON.parse(extractJson(text2)));
  }
}
