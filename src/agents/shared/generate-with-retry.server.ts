// ============================================================
// src/agents/shared/generate-with-retry.server.ts
// משאבים משותפים לכל הסוכנים — generate-with-retry.server.ts
// מורץ רק בצד השרת (TanStack Start)
// ============================================================
import { generateText } from "ai";
import { z } from "zod";
import { extractJson } from "@/lib/spec/output-schema";
import type { createLovableAiGatewayProvider } from "@/lib/ai/gateway.server";
import type { UsageTracker } from "@/lib/ai/usage.server";
import { AGENT_MAX_OUTPUT_TOKENS } from "./constants";

const DEFAULT_RETRY_SUFFIX =
  "\n\nהחזר JSON תקני בלבד, ללא ```json fences. אל תקצר.";

/**
 * Call an LLM, parse the JSON output against `schema`, and retry once with
 * temperature=0 if parsing fails. All agents share this pattern.
 */
export async function generateWithRetry<T>(
  params: {
    gateway: ReturnType<typeof createLovableAiGatewayProvider>;
    model: string;
    system: string;
    prompt: string;
    maxOutputTokens: number;
    temperature: number;
    retryPromptSuffix?: string;
  },
  schema: z.ZodType<T>,
  tracker?: UsageTracker,
): Promise<T> {
  const { gateway, model, system, prompt, maxOutputTokens, temperature } = params;
  const retryPromptSuffix = params.retryPromptSuffix ?? DEFAULT_RETRY_SUFFIX;

  const { text, usage } = await generateText({
    model: gateway(model),
    system,
    prompt,
    maxOutputTokens,
    temperature,
  });
  tracker?.track(model, usage);

  try {
    return schema.parse(JSON.parse(extractJson(text)));
  } catch {
    const { text: text2, usage: usage2 } = await generateText({
      model: gateway(model),
      system,
      prompt: prompt + retryPromptSuffix,
      maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS.retryBoost,
      temperature: 0,
    });
    tracker?.track(model, usage2);
    return schema.parse(JSON.parse(extractJson(text2)));
  }
}
