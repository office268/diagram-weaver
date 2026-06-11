// ============================================================
// src/lib/ai/model-setting.functions.ts
// Server function (createServerFn) — ai-model-setting.functions.ts
// נקודת RPC מהלקוח לשרת
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALLOWED_AGENT_MODELS, DEFAULT_AGENT_MODEL } from "@/agents/shared/constants";

export const getAvailableAgentModels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("ai_model_setting" as never)
      .select("model")
      .eq("id", "singleton")
      .maybeSingle();
    const row = data as { model?: string } | null;
    const adminDefault = row?.model && (ALLOWED_AGENT_MODELS as readonly string[]).includes(row.model)
      ? row.model
      : DEFAULT_AGENT_MODEL;
    return {
      allowed: ALLOWED_AGENT_MODELS as readonly string[],
      adminDefault,
    };
  });


export const getAiModelSetting = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("ai_model_setting" as never)
      .select("model, updated_at")
      .eq("id", "singleton")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as { model?: string; updated_at?: string } | null;
    return {
      model: row?.model ?? DEFAULT_AGENT_MODEL,
      updated_at: row?.updated_at ?? null,
      allowed: ALLOWED_AGENT_MODELS as readonly string[],
      default: DEFAULT_AGENT_MODEL,
    };
  });

export const updateAiModelSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        model: z.enum(ALLOWED_AGENT_MODELS as unknown as [string, ...string[]]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Admin check
    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Forbidden: admin only");

    const { error } = await supabase
      .from("ai_model_setting" as never)
      .upsert(
        {
          id: "singleton",
          model: data.model,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, model: data.model };
  });
