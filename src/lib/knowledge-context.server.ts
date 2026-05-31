import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Loads the user's business_knowledge and the (optional) project's
 * business_knowledge, then renders a Hebrew context block to prepend to
 * the user prompt sent to the model. Returns "" if nothing is set.
 */
export async function loadKnowledgeContextBlock(
  userId: string,
  projectId?: string | null,
): Promise<string> {
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
  if (!parts.length) return "";
  parts.push("", "---", "");
  return parts.join("\n");
}
