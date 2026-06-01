import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const recordSchema = z.object({
  event: z.enum(["signed_in", "signed_out"]),
  provider: z.string().max(64).optional().nullable(),
  email: z.string().max(320).optional().nullable(),
});

export const recordLoginEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => recordSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let ip: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
    } catch {
      ip = null;
    }
    const userAgent = getRequestHeader("user-agent") ?? null;

    const { error } = await supabase.from("login_events").insert({
      user_id: userId,
      event: data.event,
      provider: data.provider ?? null,
      email: data.email ?? null,
      user_agent: userAgent,
      ip,
    });
    if (error) {
      console.error("recordLoginEvent insert failed:", error.message);
      return { ok: false as const };
    }
    return { ok: true as const };
  });

export type LoginLogRow = {
  id: string;
  source: "app" | "auth";
  created_at: string;
  email: string | null;
  provider: string | null;
  event: string;
  status: "success" | "error" | "info";
  ip: string | null;
  user_agent: string | null;
  message: string | null;
};

export const getLoginLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: LoginLogRow[]; authLogsAvailable: boolean }> => {
    const { userId } = context;

    // Admin gate
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      throw new Error("Forbidden");
    }

    const rows: LoginLogRow[] = [];

    const { data: appRows, error: appErr } = await supabaseAdmin
      .from("login_events")
      .select("id, created_at, email, provider, event, ip, user_agent")
      .order("created_at", { ascending: false })
      .limit(200);
    if (appErr) {
      console.error("login_events query failed:", appErr.message);
    } else if (appRows) {
      for (const r of appRows) {
        rows.push({
          id: `app:${r.id}`,
          source: "app",
          created_at: r.created_at as string,
          email: (r.email as string | null) ?? null,
          provider: (r.provider as string | null) ?? null,
          event: (r.event as string) ?? "signed_in",
          status: r.event === "signed_out" ? "info" : "success",
          ip: (r.ip as string | null) ?? null,
          user_agent: (r.user_agent as string | null) ?? null,
          message: null,
        });
      }
    }

    // Auth analytics logs (best-effort)
    let authLogsAvailable = false;
    try {
      const projectRef = process.env.SUPABASE_PROJECT_ID || process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];
      // analytics is only reachable via management API which we don't have; skip silently.
      // (Auth logs require the management API; not available from worker runtime.)
      void projectRef;
    } catch {
      authLogsAvailable = false;
    }

    rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { rows: rows.slice(0, 200), authLogsAvailable };
  });
