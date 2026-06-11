// ============================================================
// src/lib/audit/login-log.functions.ts
// Server function (createServerFn) — login-log.functions.ts
// נקודת RPC מהלקוח לשרת
// ============================================================
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

    // Throttle: skip if the same user logged the same event in the last 30 minutes
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("login_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event", data.event)
      .gte("created_at", since)
      .limit(1);
    if (recent && recent.length > 0) {
      return { ok: true as const, skipped: true as const };
    }

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
      .select("id, created_at, email, provider, event, ip, user_agent, user_id")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (appErr) {
      console.error("login_events query failed:", appErr.message);
    } else if (appRows) {
      // Cap per-user rows to keep the log fair across users (avoid one
      // user's repeated sign-ins pushing out everyone else).
      const perUserCap = 30;
      const perUserCount = new Map<string, number>();
      for (const r of appRows) {
        const key = (r.user_id as string | null) ?? (r.email as string | null) ?? "unknown";
        const seen = perUserCount.get(key) ?? 0;
        if (seen >= perUserCap) continue;
        perUserCount.set(key, seen + 1);
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

    // Auth analytics logs via Supabase Management API (best-effort)
    let authLogsAvailable = false;
    try {
      const pat = process.env.CLOUD_MANAGEMENT_PAT;
      const projectRef =
        process.env.SUPABASE_PROJECT_ID ||
        process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];

      if (pat && projectRef) {
        const sql = `
          select id, timestamp, event_message,
                 metadata.msg as msg,
                 metadata.status as status,
                 metadata.path as path,
                 metadata.error as error,
                 metadata.remote_addr as remote_addr,
                 metadata.user_id as auth_user_id,
                 metadata.login_method as login_method,
                 metadata.provider as provider
          from auth_logs
          cross join unnest(metadata) as metadata
          order by timestamp desc
          limit 200
        `;
        const url = `https://api.supabase.com/v1/projects/${projectRef}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}`;
        const res = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${pat}` },
        });

        if (res.ok) {
          authLogsAvailable = true;
          const json = (await res.json()) as { result?: Array<Record<string, unknown>> };
          const result = json.result ?? [];
          for (const r of result) {
            const msg = (r.msg as string | null) ?? null;
            const statusStr = (r.status as string | number | null)?.toString() ?? null;
            const statusNum = statusStr ? parseInt(statusStr, 10) : NaN;
            const errorVal = (r.error as string | null) ?? null;
            const path = (r.path as string | null) ?? null;

            // Filter to only meaningful auth events
            const isAuthEvent =
              msg === "Login" ||
              msg === "Logout" ||
              msg === "Signup" ||
              msg === "User Recovery Requested" ||
              path === "/token" ||
              path === "/signup" ||
              path === "/recover" ||
              path === "/logout" ||
              (!isNaN(statusNum) && statusNum >= 400);
            if (!isAuthEvent) continue;

            const isError = !!errorVal || (!isNaN(statusNum) && statusNum >= 400);
            const event =
              msg === "Logout" || path === "/logout"
                ? "signed_out"
                : msg === "Signup" || path === "/signup"
                  ? "signed_up"
                  : "signed_in";

            const ts = r.timestamp as number | string;
            const created_at =
              typeof ts === "number"
                ? new Date(ts / 1000).toISOString() // microseconds → ms
                : new Date(ts).toISOString();

            rows.push({
              id: `auth:${(r.id as string) ?? created_at}`,
              source: "auth",
              created_at,
              email: null,
              provider: (r.provider as string | null) ?? (r.login_method as string | null) ?? null,
              event,
              status: isError ? "error" : event === "signed_out" ? "info" : "success",
              ip: (r.remote_addr as string | null) ?? null,
              user_agent: null,
              message: errorVal ?? msg ?? null,
            });
          }
        } else {
          console.error("auth logs fetch failed:", res.status, await res.text().catch(() => ""));
        }
      }
    } catch (e) {
      console.error("auth logs fetch error:", (e as Error).message);
      authLogsAvailable = false;
    }

    rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { rows: rows.slice(0, 300), authLogsAvailable };
  });
