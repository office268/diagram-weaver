import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { OUTPUT_TYPE_ORDER, type OutputKey } from "@/lib/output-types";

const VALID = new Set<string>(OUTPUT_TYPE_ORDER as readonly string[]);

function normalize(order: string[]): OutputKey[] {
  const seen = new Set<string>();
  const filtered = order.filter((k) => VALID.has(k) && !seen.has(k) && seen.add(k));
  const missing = OUTPUT_TYPE_ORDER.filter((k) => !seen.has(k));
  return [...filtered, ...missing] as OutputKey[];
}

export const getDashboardTileOrder = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await (supabaseAdmin as any)
    .from("dashboard_tile_order")
    .select("order")
    .eq("id", "singleton")
    .maybeSingle();
  const raw = (data?.order as string[] | undefined) ?? [];
  return { order: normalize(raw) };
});

const UpdateSchema = z.object({
  order: z.array(z.string().min(1).max(100)).min(1).max(100),
});

export const setDashboardTileOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("רק מנהל מערכת יכול לשנות את סדר הקוביות");

    const order = normalize(data.order);
    const { error } = await (supabaseAdmin as any)
      .from("dashboard_tile_order")
      .upsert({
        id: "singleton",
        order,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      });
    if (error) throw new Error(error.message);
    return { order };
  });
