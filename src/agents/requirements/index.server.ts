import { generateText } from "ai";
import { z } from "zod";
import type { AgentContext, RequirementsOutput } from "@/agents/shared/types";
import { AGENT_MODELS, AGENT_TEMPERATURES } from "@/agents/shared/constants";
import { extractJson } from "@/lib/spec-output-schema";
import { REQUIREMENTS_SYSTEM } from "./system";
import { buildRequirementsPrompt } from "./prompt";
import type { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const ItemSchema = z.object({ id: z.string().default(""), text: z.string().default("") });
const ReqSchema = z.object({
  id: z.string().default(""),
  title: z.string().default(""),
  description: z.string().default(""),
});

const OutputSchema = z.object({
  goals: z.array(ItemSchema).default([]),
  functional_requirements: z.array(ReqSchema).default([]),
  non_functional_requirements: z.array(ReqSchema).default([]),
  assumptions: z.array(ItemSchema).default([]),
  risks: z.array(ItemSchema).default([]),
});

export async function runRequirementsAgent(
  ctx: AgentContext,
  gateway: ReturnType<typeof createLovableAiGatewayProvider>,
): Promise<RequirementsOutput> {
  const { text } = await generateText({
    model: gateway(AGENT_MODELS.requirements),
    system: REQUIREMENTS_SYSTEM,
    prompt: buildRequirementsPrompt(ctx),
    maxOutputTokens: 4000,
    temperature: AGENT_TEMPERATURES.requirements,
  });

  try {
    const parsed = OutputSchema.parse(JSON.parse(extractJson(text)));
    return parsed;
  } catch (err) {
    console.error("[requirements-agent] parse failed, retrying:", err);
    // Retry once with explicit correction instruction
    const { text: text2 } = await generateText({
      model: gateway(AGENT_MODELS.requirements),
      system: REQUIREMENTS_SYSTEM,
      prompt: buildRequirementsPrompt(ctx) + "\n\nחשוב: החזר JSON תקני בלבד, ללא טקסט נוסף.",
      maxOutputTokens: 4000,
      temperature: 0,
    });
    return OutputSchema.parse(JSON.parse(extractJson(text2)));
  }
}
