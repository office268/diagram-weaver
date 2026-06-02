import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AiUsageRow {
  id: string;
  created_at: string;
  spec_document_id: string;
  doc_title: string | null;
  doc_type: string | null;
  word_count: number;
  model: string;
  purpose: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  current_title: string | null;
  is_deleted: boolean;
}

export const listAiUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("ai_usage_events")
      .select(
        "id, created_at, spec_document_id, doc_title, doc_type, word_count, model, purpose, prompt_tokens, completion_tokens, total_tokens, cost_usd",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<
      Omit<AiUsageRow, "current_title" | "is_deleted">
    >;

    const ids = Array.from(
      new Set(rows.map((r) => r.spec_document_id).filter(Boolean)),
    );
    let existing = new Map<string, string | null>();
    if (ids.length > 0) {
      const { data: docs } = await supabase
        .from("spec_documents")
        .select("id, title")
        .in("id", ids);
      existing = new Map((docs ?? []).map((d) => [d.id, d.title ?? null]));
    }

    const out: AiUsageRow[] = rows.map((r) => ({
      ...r,
      current_title: existing.get(r.spec_document_id) ?? null,
      is_deleted: !existing.has(r.spec_document_id),
    }));
    return { rows: out };
  });
