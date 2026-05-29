import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_SYSTEM_INSTRUCTION } from "./ai-spec-defaults";

export const getAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("ai_settings")
      .select("system_instruction")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      system_instruction: data?.system_instruction ?? DEFAULT_SYSTEM_INSTRUCTION,
      is_default: !data,
      default_system_instruction: DEFAULT_SYSTEM_INSTRUCTION,
    };
  });

export const updateAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ system_instruction: z.string().min(10).max(20000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ai_settings")
      .upsert(
        { user_id: userId, system_instruction: data.system_instruction },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("ai_settings").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
