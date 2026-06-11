// ============================================================
// src/lib/ai-settings.functions.ts
// Server function (createServerFn) — ai-settings.functions.ts
// נקודת RPC מהלקוח לשרת
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("ai_settings")
      .select("system_instruction, business_knowledge")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      system_instruction: data?.system_instruction ?? "",
      business_knowledge: (data as { business_knowledge?: string } | null)?.business_knowledge ?? "",
      is_default: !data,
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

export const updateBusinessKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ business_knowledge: z.string().max(10000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Upsert, but we need a system_instruction value to satisfy NOT NULL.
    // Fetch existing first.
    const { data: existing } = await supabase
      .from("ai_settings")
      .select("system_instruction")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("ai_settings")
        .update({ business_knowledge: data.business_knowledge } as never)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("ai_settings")
        .insert({
          user_id: userId,
          system_instruction: "",
          business_knowledge: data.business_knowledge,
        } as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
