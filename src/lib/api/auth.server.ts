// ============================================================
// src/lib/api/auth.server.ts
// מודול server-only — auth.server.ts
// מורץ רק בצד השרת (TanStack Start)
// ============================================================
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuthResult = { ok: true; userId: string } | { ok: false; response: Response };

/** Extract and validate a Bearer token from the Authorization header. */
export async function requireBearerAuth(request: Request): Promise<AuthResult> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { ok: false, response: new Response("Unauthorized", { status: 401 }) };

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user)
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };

  return { ok: true, userId: userData.user.id };
}

/** Assert that userId holds the admin role; throws if not. */
export async function assertAdmin(
  supabase: { from: (t: string) => unknown },
  userId: string,
  msg = "רק אדמין יכול לבצע פעולה זו",
): Promise<void> {
  const { data, error } = await (supabase as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error((error as { message: string }).message);
  if (!data) throw new Error(msg);
}

/** Translate a raw AI provider error into an HTTP { status, message } pair. */
export function translateAiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429")) return { status: 429, message: "הגעת למגבלת קצב." };
  if (msg.includes("402")) return { status: 402, message: "אזלו קרדיטי ה-AI." };
  return { status: 500, message: msg };
}
