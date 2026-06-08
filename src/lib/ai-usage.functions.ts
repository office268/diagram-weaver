import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  user_email: string | null;
}

export const listAiUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    const client = isAdmin ? supabaseAdmin : supabase;
    let q = client
      .from("ai_usage_events")
      .select(
        "id, created_at, spec_document_id, doc_title, doc_type, word_count, model, purpose, prompt_tokens, completion_tokens, total_tokens, cost_usd, user_id",
      )
      .order("created_at", { ascending: false });
    if (!isAdmin) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<
      Omit<AiUsageRow, "current_title" | "is_deleted" | "user_email"> & {
        user_id: string;
      }
    >;

    const ids = Array.from(
      new Set(rows.map((r) => r.spec_document_id).filter(Boolean)),
    );
    let existing = new Map<string, string | null>();
    if (ids.length > 0) {
      const { data: docs } = await supabaseAdmin
        .from("spec_documents")
        .select("id, title")
        .in("id", ids);
      existing = new Map((docs ?? []).map((d) => [d.id, d.title ?? null]));
    }

    const emails = new Map<string, string | null>();
    if (isAdmin) {
      const userIds = Array.from(
        new Set(rows.map((r) => r.user_id).filter(Boolean)),
      );
      await Promise.all(
        userIds.map(async (uid) => {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
          emails.set(uid, u?.user?.email ?? null);
        }),
      );
    }

    const out: AiUsageRow[] = rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      spec_document_id: r.spec_document_id,
      doc_title: r.doc_title,
      doc_type: r.doc_type,
      word_count: r.word_count,
      model: r.model,
      purpose: r.purpose,
      prompt_tokens: r.prompt_tokens,
      completion_tokens: r.completion_tokens,
      total_tokens: r.total_tokens,
      cost_usd: r.cost_usd,
      current_title: existing.get(r.spec_document_id) ?? null,
      is_deleted: !existing.has(r.spec_document_id),
      user_email: isAdmin ? emails.get(r.user_id) ?? null : null,
    }));
    return { rows: out, isAdmin };
  });
