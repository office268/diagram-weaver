import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEFAULT_AGENT_MODEL, ALLOWED_AGENT_MODELS } from "@/agents/shared/constants";

/**
 * Loads the admin-configured AI model for agents. Falls back to the default
 * if the row is missing or the stored value is not in the whitelist.
 */
export async function loadAgentModelOverride(): Promise<string> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from("ai_model_setting")
      .select("model")
      .eq("id", "singleton")
      .maybeSingle();
    const candidate = (data?.model as string | undefined) ?? DEFAULT_AGENT_MODEL;
    return (ALLOWED_AGENT_MODELS as readonly string[]).includes(candidate)
      ? candidate
      : DEFAULT_AGENT_MODEL;
  } catch {
    return DEFAULT_AGENT_MODEL;
  }
}

/**
 * Returns the effective model for a specific chat thread. If the thread has
 * a per-thread `model_override` that is in the whitelist, returns it.
 * Otherwise falls back to the admin global default.
 */
export async function loadEffectiveModelForThread(threadId: string): Promise<string> {
  try {
    const { data } = await (supabaseAdmin as any)
      .from("chat_threads")
      .select("model_override")
      .eq("id", threadId)
      .maybeSingle();
    const candidate = (data?.model_override as string | null | undefined) ?? null;
    if (candidate && (ALLOWED_AGENT_MODELS as readonly string[]).includes(candidate)) {
      return candidate;
    }
  } catch {
    /* fall through to admin default */
  }
  return loadAgentModelOverride();
}
