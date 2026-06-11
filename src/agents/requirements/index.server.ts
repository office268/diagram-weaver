// ============================================================
// src/agents/requirements/index.server.ts
// מודול server-only — index.server.ts
// מורץ רק בצד השרת (TanStack Start)
// ============================================================
import { z } from "zod";
import type { AgentContext, RequirementsOutput } from "@/agents/shared/types";
import { AGENT_MODELS, AGENT_TEMPERATURES, AGENT_MAX_OUTPUT_TOKENS } from "@/agents/shared/constants";
import { generateWithRetry } from "@/agents/shared/generate-with-retry.server";
import { REQUIREMENTS_SYSTEM } from "./system";
import { buildRequirementsPrompt } from "./prompt";
import type { createLovableAiGatewayProvider } from "@/lib/ai/gateway.server";
import type { UsageTracker } from "@/lib/ai/usage.server";

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
  tracker?: UsageTracker,
): Promise<RequirementsOutput> {
  const model = ctx.model ?? AGENT_MODELS.requirements;
  return generateWithRetry(
    {
      gateway,
      model,
      system: REQUIREMENTS_SYSTEM,
      prompt: buildRequirementsPrompt(ctx),
      maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS.requirements,
      temperature: AGENT_TEMPERATURES.requirements,
      retryPromptSuffix: "\n\nחשוב: החזר JSON תקני בלבד, ללא טקסט נוסף.",
    },
    OutputSchema,
    tracker,
  );
}
