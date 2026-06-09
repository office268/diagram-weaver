export const MODEL_LABELS: Record<string, string> = {
  "google/gemini-2.5-pro": "Gemini 2.5 Pro — Reasoning (ברירת מחדל)",
  "google/gemini-3.1-pro-preview": "Gemini 3.1 Pro Preview — Reasoning",
  "openai/gpt-5.4": "GPT-5.4 — Reasoning",
  "openai/gpt-5.5": "GPT-5.5 — Reasoning מתקדם",
  "anthropic/claude-opus-4-5": "Claude Opus 4.5 — Reasoning לארכיטקטורה (Anthropic)",
  "anthropic/claude-sonnet-4-5": "Claude Sonnet 4.5 — Reasoning מאוזן (Anthropic)",
};

export const MODEL_SHORT_LABELS: Record<string, string> = {
  "google/gemini-2.5-pro": "Gemini 2.5 Pro",
  "google/gemini-3.1-pro-preview": "Gemini 3.1 Pro",
  "openai/gpt-5.4": "GPT-5.4",
  "openai/gpt-5.5": "GPT-5.5",
  "anthropic/claude-opus-4-5": "Claude Opus 4.5",
  "anthropic/claude-sonnet-4-5": "Claude Sonnet 4.5",
};

export function modelLabel(model: string | null | undefined): string {
  if (!model) return "—";
  return MODEL_LABELS[model] ?? model;
}

export function modelShortLabel(model: string | null | undefined): string {
  if (!model) return "—";
  return MODEL_SHORT_LABELS[model] ?? model;
}
