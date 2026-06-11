// ============================================================
// src/lib/ai/pricing.ts
// ספריית עזר (lib) — ai-pricing.ts
// ============================================================
// Pricing per 1M tokens, USD. Values approximated from public list prices.
// Unknown models → cost = 0 (we still record tokens).
export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Google Gemini
  "google/gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 10.0 },
  "google/gemini-2.5-flash": { inputPer1M: 0.3, outputPer1M: 2.5 },
  "google/gemini-2.5-flash-lite": { inputPer1M: 0.1, outputPer1M: 0.4 },
  "google/gemini-3-flash-preview": { inputPer1M: 0.3, outputPer1M: 2.5 },
  "google/gemini-3.5-flash": { inputPer1M: 0.3, outputPer1M: 2.5 },
  "google/gemini-3.1-pro-preview": { inputPer1M: 1.25, outputPer1M: 10.0 },
  "google/gemini-3.1-flash-lite-preview": { inputPer1M: 0.1, outputPer1M: 0.4 },
  // OpenAI GPT-5 family
  "openai/gpt-5": { inputPer1M: 1.25, outputPer1M: 10.0 },
  "openai/gpt-5-mini": { inputPer1M: 0.25, outputPer1M: 2.0 },
  "openai/gpt-5-nano": { inputPer1M: 0.05, outputPer1M: 0.4 },
  "openai/gpt-5.2": { inputPer1M: 1.25, outputPer1M: 10.0 },
  "openai/gpt-5.4": { inputPer1M: 1.25, outputPer1M: 10.0 },
  "openai/gpt-5.4-mini": { inputPer1M: 0.25, outputPer1M: 2.0 },
  "openai/gpt-5.4-nano": { inputPer1M: 0.05, outputPer1M: 0.4 },
  "openai/gpt-5.4-pro": { inputPer1M: 5.0, outputPer1M: 20.0 },
  "openai/gpt-5.5": { inputPer1M: 1.5, outputPer1M: 12.0 },
  "openai/gpt-5.5-pro": { inputPer1M: 5.0, outputPer1M: 20.0 },
};

export function calcCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = MODEL_PRICING[model];
  if (!p) return 0;
  return (
    (inputTokens / 1_000_000) * p.inputPer1M +
    (outputTokens / 1_000_000) * p.outputPer1M
  );
}
