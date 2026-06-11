import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

import { requireBearerAuth, translateAiError, assertAdmin } from "@/lib/api/auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const mockGetUser = supabaseAdmin.auth.getUser as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireBearerAuth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const req = new Request("http://localhost/api/test");
    const result = await requireBearerAuth(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns 401 when Authorization header is not Bearer", async () => {
    const req = new Request("http://localhost/api/test", {
      headers: { authorization: "Basic dXNlcjpwYXNz" },
    });
    const result = await requireBearerAuth(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns 401 when supabase returns an error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid token") });
    const req = new Request("http://localhost/api/test", {
      headers: { authorization: "Bearer bad-token" },
    });
    const result = await requireBearerAuth(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns userId when token is valid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    const req = new Request("http://localhost/api/test", {
      headers: { authorization: "Bearer valid-token" },
    });
    const result = await requireBearerAuth(req);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.userId).toBe("user-123");
  });
});

describe("translateAiError", () => {
  it("maps 429 errors to rate-limit response", () => {
    const err = new Error("upstream error 429 Too Many Requests");
    const { status, message } = translateAiError(err);
    expect(status).toBe(429);
    expect(message).toBe("הגעת למגבלת קצב.");
  });

  it("maps 402 errors to credit response", () => {
    const err = new Error("Payment Required 402");
    const { status, message } = translateAiError(err);
    expect(status).toBe(402);
    expect(message).toBe("אזלו קרדיטי ה-AI.");
  });

  it("returns 500 for generic errors", () => {
    const err = new Error("Something went wrong");
    const { status, message } = translateAiError(err);
    expect(status).toBe(500);
    expect(message).toBe("Something went wrong");
  });

  it("handles non-Error values", () => {
    const { status, message } = translateAiError("plain string error");
    expect(status).toBe(500);
    expect(message).toBe("plain string error");
  });
});

function makeSupabaseMock(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  const from = vi.fn().mockReturnValue(chain);
  return { from };
}

describe("assertAdmin", () => {
  it("resolves when user has admin role", async () => {
    const supabase = makeSupabaseMock({ data: { role: "admin" }, error: null });
    await expect(assertAdmin(supabase, "user-123")).resolves.toBeUndefined();
  });

  it("throws with default message when user has no admin role", async () => {
    const supabase = makeSupabaseMock({ data: null, error: null });
    await expect(assertAdmin(supabase, "user-456")).rejects.toThrow(
      "רק אדמין יכול לבצע פעולה זו",
    );
  });

  it("throws with custom message when provided", async () => {
    const supabase = makeSupabaseMock({ data: null, error: null });
    await expect(assertAdmin(supabase, "user-456", "גישה נדחתה")).rejects.toThrow(
      "גישה נדחתה",
    );
  });

  it("throws when supabase returns an error", async () => {
    const supabase = makeSupabaseMock({ data: null, error: { message: "db error" } });
    await expect(assertAdmin(supabase, "user-789")).rejects.toThrow("db error");
  });
});
