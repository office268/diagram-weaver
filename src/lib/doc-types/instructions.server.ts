// ============================================================
// src/lib/doc-types/instructions.server.ts
// מודול server-only — doc-type-instructions.server.ts
// מורץ רק בצד השרת (TanStack Start)
// ============================================================
// Server-only helpers for resolving per-doc-type system instructions.

import { getDocTypeSystemInstruction } from "./types.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function getDefaultFullInstruction(docType: string | null | undefined): string {
  return getDocTypeSystemInstruction(docType);
}

/**
 * Returns the active system instruction for a given doc type.
 * If an admin override exists in `doc_type_instructions`, returns it as-is.
 * Otherwise returns the default (base + per-type) instruction from code.
 */
export async function resolveSystemInstruction(
  docType: string | null | undefined,
): Promise<string> {
  if (docType) {
    const { data } = await supabaseAdmin
      .from("doc_type_instructions")
      .select("system_instruction")
      .eq("doc_type", docType)
      .maybeSingle();
    if (data?.system_instruction) return data.system_instruction;
  }
  return getDefaultFullInstruction(docType);
}
