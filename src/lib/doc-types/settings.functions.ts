// ============================================================
// src/lib/doc-types/settings.functions.ts
// Server function (createServerFn) — doc-type-settings.functions.ts
// נקודת RPC מהלקוח לשרת
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DOC_TYPE_KEYS,
  DOC_TYPES,
  ALL_SECTION_KEYS,
  type DocTypeKey,
} from "./types";

export interface DocTypeOverride {
  doc_type: DocTypeKey;
  section_order: string[];
  section_titles: Record<string, string>;
}

const docTypeEnum = z.enum(DOC_TYPE_KEYS as readonly [string, ...string[]]);
const sectionKeyEnum = z.enum(ALL_SECTION_KEYS as readonly [string, ...string[]]);

export const listDocTypeSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("doc_type_settings")
      .select("doc_type, section_order, section_titles")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const overrides: Record<string, DocTypeOverride> = {};
    for (const row of data ?? []) {
      const r = row as {
        doc_type: string;
        section_order: unknown;
        section_titles: unknown;
      };
      overrides[r.doc_type] = {
        doc_type: r.doc_type as DocTypeKey,
        section_order: Array.isArray(r.section_order)
          ? (r.section_order as string[])
          : [],
        section_titles:
          r.section_titles && typeof r.section_titles === "object"
            ? (r.section_titles as Record<string, string>)
            : {},
      };
    }
    return { overrides };
  });

export const updateDocTypeSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        docType: docTypeEnum,
        sectionOrder: z.array(sectionKeyEnum).min(1).max(50),
        sectionTitles: z.record(sectionKeyEnum, z.string().max(200)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("doc_type_settings").upsert(
      {
        user_id: userId,
        doc_type: data.docType,
        section_order: data.sectionOrder,
        section_titles: data.sectionTitles,
      } as never,
      { onConflict: "user_id,doc_type" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetDocTypeSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ docType: docTypeEnum }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("doc_type_settings")
      .delete()
      .eq("user_id", userId)
      .eq("doc_type", data.docType);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Merge a user override with the built-in DocTypeDef defaults. */
export function effectiveDocTypeConfig(
  key: DocTypeKey,
  override?: DocTypeOverride | null,
) {
  const def = DOC_TYPES[key];
  if (!override) {
    return { sectionOrder: def.sectionOrder, sectionTitles: def.sectionTitles };
  }
  return {
    sectionOrder:
      override.section_order.length > 0
        ? override.section_order
        : def.sectionOrder,
    sectionTitles: { ...def.sectionTitles, ...override.section_titles },
  };
}
