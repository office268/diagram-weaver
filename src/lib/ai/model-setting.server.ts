// ============================================================
// src/lib/ai/model-setting.server.ts
// מודול server-only — model-setting.server.ts
// מורץ רק בצד השרת (TanStack Start)
// ============================================================
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEFAULT_AGENT_MODEL, ALLOWED_AGENT_MODELS } from "@/agents/shared/constants";

// Local types for tables not in the generated Supabase schema
interface AiModelRow { model: string }
interface ChatThreadRow { model_override: string | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = supabaseAdmin as any;

/** Loads the admin-configured AI model for agents; falls back to the default. */
export async function loadAgentModelOverride(): Promise<string> {
  try {
    const { data } = await adminDb
      .from("ai_model_setting")
      .select("model")
      .eq("id", "singleton")
      .maybeSingle() as { data: AiModelRow | null };
    const candidate = data?.model ?? DEFAULT_AGENT_MODEL;
    return (ALLOWED_AGENT_MODELS as readonly string[]).includes(candidate)
      ? candidate
      : DEFAULT_AGENT_MODEL;
  } catch {
    return DEFAULT_AGENT_MODEL;
  }
}

/** Returns the effective model for a thread; falls back to the admin global default. */
export async function loadEffectiveModelForThread(threadId: string): Promise<string> {
  try {
    const { data } = await adminDb
      .from("chat_threads")
      .select("model_override")
      .eq("id", threadId)
      .maybeSingle() as { data: ChatThreadRow | null };
    const candidate = data?.model_override ?? null;
    if (candidate && (ALLOWED_AGENT_MODELS as readonly string[]).includes(candidate)) {
      return candidate;
    }
  } catch {
    /* fall through to admin default */
  }
  return loadAgentModelOverride();
}
