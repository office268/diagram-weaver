// ============================================================
// src/lib/dashboard-tile-order.functions.ts
// Server function (createServerFn) — dashboard-tile-order.functions.ts
// נקודת RPC מהלקוח לשרת
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OUTPUT_TYPE_ORDER, OUTPUT_TYPE_EXTRAS, type OutputKey } from "@/lib/doc-types/output-types";

const VALID_ORDER = new Set<string>(OUTPUT_TYPE_ORDER as readonly string[]);
const VALID_EXTRAS = new Set<string>(OUTPUT_TYPE_EXTRAS as readonly string[]);
const VALID_ALL = new Set<string>([...VALID_ORDER, ...VALID_EXTRAS]);

function normalizeOrder(order: string[]): OutputKey[] {
  const seen = new Set<string>();
  const filtered = order.filter((k) => VALID_ORDER.has(k) && !seen.has(k) && seen.add(k));
  const missing = OUTPUT_TYPE_ORDER.filter((k) => !seen.has(k));
  return [...filtered, ...missing] as OutputKey[];
}

function normalizeKeys(keys: unknown, allow: Set<string>): OutputKey[] {
  if (!Array.isArray(keys)) return [];
  const seen = new Set<string>();
  return keys.filter(
    (k): k is OutputKey =>
      typeof k === "string" && allow.has(k) && !seen.has(k) && !!seen.add(k),
  );
}

export const getDashboardTileOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("dashboard_tile_order")
      .select("order, moved_to_extras, moved_to_main")
      .eq("id", "singleton")
      .maybeSingle();
    return {
      order: normalizeOrder((data?.order as string[] | undefined) ?? []),
      movedToExtras: normalizeKeys(data?.moved_to_extras, VALID_ORDER),
      movedToMain: normalizeKeys(data?.moved_to_main, VALID_EXTRAS),
    };
  });

const UpdateSchema = z.object({
  order: z.array(z.string().min(1).max(100)).min(1).max(100).optional(),
  movedToExtras: z.array(z.string().min(1).max(100)).max(100).optional(),
  movedToMain: z.array(z.string().min(1).max(100)).max(100).optional(),
});

export const setDashboardTileOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await (context.supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("רק מנהל מערכת יכול לשנות את סדר הקוביות");

    // Load current row to preserve fields not provided in this call.
    const { data: current } = await (context.supabase as any)
      .from("dashboard_tile_order")
      .select("order, moved_to_extras, moved_to_main")
      .eq("id", "singleton")
      .maybeSingle();

    const order = normalizeOrder(
      data.order ?? (current?.order as string[] | undefined) ?? [],
    );
    const movedToExtras = normalizeKeys(
      data.movedToExtras ?? current?.moved_to_extras ?? [],
      VALID_ORDER,
    );
    const movedToMain = normalizeKeys(
      data.movedToMain ?? current?.moved_to_main ?? [],
      VALID_EXTRAS,
    );

    const { error } = await (context.supabase as any)
      .from("dashboard_tile_order")
      .upsert({
        id: "singleton",
        order,
        moved_to_extras: movedToExtras,
        moved_to_main: movedToMain,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      });
    if (error) throw new Error(error.message);
    return { order, movedToExtras, movedToMain };
  });
