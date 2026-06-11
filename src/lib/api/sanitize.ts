// ============================================================
// src/lib/api/sanitize.ts
// מודול server-only — sanitize.ts
// ============================================================

/** Strip common prompt-injection patterns and enforce a max length. */
export function sanitizeUserPrompt(raw: string, maxLen = 5000): string {
  return raw
    .replace(/\bignore\b.{0,60}\b(instructions?|system|rules?)\b/gi, "")
    .replace(/\bsystem\s*:/gi, "")
    .replace(/<\/?s(?:ystem|cript)[^>]*>/gi, "")
    .slice(0, maxLen)
    .trim();
}
