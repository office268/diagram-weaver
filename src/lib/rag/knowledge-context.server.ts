// ============================================================
// src/lib/rag/knowledge-context.server.ts
// מודול server-only — knowledge-context.server.ts
// מורץ רק בצד השרת (TanStack Start)
// ============================================================
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// In-memory cache with 60s TTL — avoids redundant DB queries per generation call
const _cache = new Map<string, { value: string; expires: number }>();

export async function loadKnowledgeContextBlock(
  userId: string,
  projectId?: string | null,
): Promise<string> {
  const key = `${userId}:${projectId ?? ""}`;
  const cached = _cache.get(key);
  if (cached && Date.now() < cached.expires) return cached.value;

  const [userRes, projectRes] = await Promise.all([
    supabaseAdmin
      .from("ai_settings")
      .select("business_knowledge")
      .eq("user_id", userId)
      .maybeSingle(),
    projectId
      ? supabaseAdmin
          .from("projects")
          .select("business_knowledge")
          .eq("id", projectId)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as { data: null; error: null }),
  ]);

  const userKnowledge = (
    (userRes.data as { business_knowledge?: string } | null)?.business_knowledge ?? ""
  ).trim();
  const projectKnowledge = (
    (projectRes.data as { business_knowledge?: string } | null)?.business_knowledge ?? ""
  ).trim();

  const parts: string[] = [];
  if (userKnowledge) {
    parts.push("## ידע ארגוני / עסקי של המשתמש", userKnowledge);
  }
  if (projectKnowledge) {
    if (parts.length) parts.push("");
    parts.push("## ידע על הפרויקט", projectKnowledge);
  }
  if (!parts.length) {
    _cache.set(key, { value: "", expires: Date.now() + 60_000 });
    return "";
  }
  parts.push("", "---", "");
  const value = parts.join("\n");
  _cache.set(key, { value, expires: Date.now() + 60_000 });
  return value;
}
