// ============================================================
// src/lib/doc-type-instructions.functions.ts
// Server function (createServerFn) — doc-type-instructions.functions.ts
// נקודת RPC מהלקוח לשרת
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DOC_TYPE_KEYS } from "@/lib/doc-types";
import { getDefaultFullInstruction } from "@/lib/doc-type-instructions.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const listDocTypeInstructions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data, error } = await supabase
      .from("doc_type_instructions")
      .select("doc_type, system_instruction, updated_at");
    if (error) throw new Error(error.message);

    const overrides = new Map<string, { system_instruction: string; updated_at: string }>();
    for (const row of data ?? []) {
      overrides.set(row.doc_type, {
        system_instruction: row.system_instruction,
        updated_at: row.updated_at,
      });
    }

    return DOC_TYPE_KEYS.map((key) => {
      const override = overrides.get(key);
      const defaultText = getDefaultFullInstruction(key);
      return {
        doc_type: key,
        system_instruction: override?.system_instruction ?? defaultText,
        default_instruction: defaultText,
        is_default: !override,
        updated_at: override?.updated_at ?? null,
      };
    });
  });

export const updateDocTypeInstruction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        doc_type: z.enum(DOC_TYPE_KEYS),
        system_instruction: z.string().min(10).max(20000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { error } = await supabase
      .from("doc_type_instructions")
      .upsert(
        {
          doc_type: data.doc_type,
          system_instruction: data.system_instruction,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "doc_type" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetDocTypeInstruction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ doc_type: z.enum(DOC_TYPE_KEYS) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { error } = await supabase
      .from("doc_type_instructions")
      .delete()
      .eq("doc_type", data.doc_type);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
