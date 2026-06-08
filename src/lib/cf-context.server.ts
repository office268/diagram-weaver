/**
 * Cloudflare Worker execution context holder.
 *
 * Captured by `src/server.ts` on each request so server routes can call
 * `waitUntil()` to run work AFTER returning the response (durable background
 * processing). Falls back to a no-op shim when running outside Cloudflare
 * (e.g. local Node dev / unit tests).
 */

type WaitUntil = (promise: Promise<unknown>) => void;

interface CfExecutionContext {
  waitUntil: WaitUntil;
}

let currentCtx: CfExecutionContext | undefined;

function isCfCtx(value: unknown): value is CfExecutionContext {
  return (
    !!value &&
    typeof value === "object" &&
    "waitUntil" in (value as Record<string, unknown>) &&
    typeof (value as { waitUntil?: unknown }).waitUntil === "function"
  );
}

export function setCloudflareCtx(ctx: unknown): void {
  if (isCfCtx(ctx)) currentCtx = ctx;
}

/**
 * Returns a `waitUntil` that keeps the worker alive until `promise` resolves.
 * Outside Cloudflare it just lets the promise run to completion (best effort).
 */
export function waitUntil(promise: Promise<unknown>): void {
  const safe = promise.catch((err) => {
    console.error("[waitUntil] background task failed:", err);
  });
  if (currentCtx) {
    try {
      currentCtx.waitUntil(safe);
      return;
    } catch (e) {
      console.error("[waitUntil] ctx.waitUntil threw:", e);
    }
  }
  // Fallback: rely on the host runtime to drain microtasks.
  void safe;
}
