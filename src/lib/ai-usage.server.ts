import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calcCostUsd } from "./ai-pricing";

export interface UsageLike {
  // AI SDK v5+ field names
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  // Legacy fallback
  promptTokens?: number;
  completionTokens?: number;
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
}

function normalize(u: UsageLike | undefined | null): {
  input: number;
  output: number;
  total: number;
} {
  const input = u?.inputTokens ?? u?.promptTokens ?? 0;
  const output = u?.outputTokens ?? u?.completionTokens ?? 0;
  const total = u?.totalTokens ?? input + output;
  return { input, output, total };
}

/** Per-orchestrator-run accumulator. Thread-safe within a single call chain. */
export interface UsageTracker {
  track(model: string, usage: UsageLike | undefined | null): void;
  totals(): UsageTotals;
}

export function createUsageTracker(): UsageTracker {
  let input = 0;
  let output = 0;
  let total = 0;
  let cost = 0;
  return {
    track(model, usage) {
      const n = normalize(usage);
      input += n.input;
      output += n.output;
      total += n.total;
      cost += calcCostUsd(model, n.input, n.output);
    },
    totals() {
      return {
        inputTokens: input,
        outputTokens: output,
        totalTokens: total,
        costUsd: cost,
      };
    },
  };
}

/** Persist a single usage row. Swallows errors — usage logging must never break the request. */
export async function logAiUsage(params: {
  userId: string;
  specDocumentId: string;
  model: string;
  purpose: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd?: number;
}): Promise<void> {
  try {
    const cost =
      params.costUsd ??
      calcCostUsd(params.model, params.inputTokens, params.outputTokens);
    const { error } = await supabaseAdmin.from("ai_usage_events").insert({
      user_id: params.userId,
      spec_document_id: params.specDocumentId,
      model: params.model,
      purpose: params.purpose,
      prompt_tokens: params.inputTokens,
      completion_tokens: params.outputTokens,
      total_tokens: params.totalTokens,
      cost_usd: cost,
    });
    if (error) console.error("[ai-usage] insert failed:", error.message);
  } catch (e) {
    console.error("[ai-usage] exception:", e);
  }
}
