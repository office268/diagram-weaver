// ============================================================
// src/lib/orgs/site-texts.functions.ts
// Server function (createServerFn) — site-texts.functions.ts
// נקודת RPC מהלקוח לשרת
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/api/auth.server";

function publicServerClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase public env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const getSiteTexts = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicServerClient();
  const { data, error } = await sb.from("site_texts").select("key, value");
  if (error) throw new Error(error.message);
  const map: Record<string, string> = {};
  for (const r of data ?? []) map[r.key] = r.value;
  return map;
});

export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await assertAdmin(context.supabase as Parameters<typeof assertAdmin>[0], context.userId);
      return { isAdmin: true };
    } catch (err) {
      if (err instanceof Error && err.message === "רק אדמין יכול לבצע פעולה זו") {
        return { isAdmin: false };
      }
      throw err;
    }
  });

export const updateSiteText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        key: z.string().min(1).max(200).regex(/^[a-zA-Z0-9._-]+$/),
        value: z.string().max(5000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId, "רק מנהל מערכת יכול לערוך טקסטים");

    const { error } = await sb
      .from("site_texts")
      .upsert(
        { key: data.key, value: data.value, updated_by: context.userId, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
