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
/** Count words in a jsonb spec content blob (or any value). */
export function countWordsInContent(content: unknown): number {
  if (content == null) return 0;
  const collect = (v: unknown): string => {
    if (v == null) return "";
    if (typeof v === "string") return v + " ";
    if (typeof v === "number" || typeof v === "boolean") return String(v) + " ";
    if (Array.isArray(v)) return v.map(collect).join(" ");
    if (typeof v === "object")
      return Object.values(v as Record<string, unknown>).map(collect).join(" ");
    return "";
  };
  const text = collect(content).trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/** Fetch title/type/word_count snapshot for a spec document at log time. */
export async function fetchDocSnapshot(specDocumentId: string): Promise<{
  doc_title: string | null;
  doc_type: string | null;
  word_count: number;
}> {
  try {
    const { data } = await supabaseAdmin
      .from("spec_documents")
      .select("title, doc_type, content")
      .eq("id", specDocumentId)
      .maybeSingle();
    if (!data) return { doc_title: null, doc_type: null, word_count: 0 };
    return {
      doc_title: data.title ?? null,
      doc_type: data.doc_type ?? null,
      word_count: countWordsInContent(data.content),
    };
  } catch {
    return { doc_title: null, doc_type: null, word_count: 0 };
  }
}

export async function logAiUsage(params: {
  userId: string;
  specDocumentId?: string;
  diagramId?: string;
  artifactKind?: string; // 'spec_document' (default) or diagram kind
  model: string;
  purpose: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd?: number;
  docTitle?: string | null;
  docType?: string | null;
  wordCount?: number;
  status?: "success" | "failed";
  errorMessage?: string | null;
}): Promise<void> {
  try {
    const cost =
      params.costUsd ??
      calcCostUsd(params.model, params.inputTokens, params.outputTokens);

    const artifactKind = params.artifactKind ?? "spec_document";
    const status = params.status ?? "success";
    let docTitle = params.docTitle ?? null;
    let docType = params.docType ?? null;
    let wordCount = params.wordCount ?? 0;

    if (
      artifactKind === "spec_document" &&
      status === "success" &&
      params.specDocumentId &&
      (params.docTitle === undefined || params.wordCount === undefined)
    ) {
      const snap = await fetchDocSnapshot(params.specDocumentId);
      if (params.docTitle === undefined) docTitle = snap.doc_title;
      if (params.docType === undefined) docType = snap.doc_type;
      if (params.wordCount === undefined) wordCount = snap.word_count;
    }

    const isSpec = artifactKind === "spec_document";
    const { error } = await supabaseAdmin.from("ai_usage_events").insert({
      user_id: params.userId,
      spec_document_id:
        isSpec && status === "success" ? params.specDocumentId ?? null : null,
      diagram_id:
        !isSpec && status === "success" ? params.diagramId ?? null : null,
      artifact_kind: artifactKind,
      status,
      error_message: params.errorMessage ? params.errorMessage.slice(0, 500) : null,
      model: params.model,
      purpose: params.purpose,
      prompt_tokens: params.inputTokens,
      completion_tokens: params.outputTokens,
      total_tokens: params.totalTokens,
      cost_usd: cost,
      doc_title: docTitle,
      doc_type: docType,
      word_count: wordCount,
    });
    if (error) console.error("[ai-usage] insert failed:", error.message);
  } catch (e) {
    console.error("[ai-usage] exception:", e);
  }
}
