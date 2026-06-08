export const MODEL_LABELS: Record<string, string> = {
  "google/gemini-2.5-pro": "Gemini 2.5 Pro — Reasoning (ברירת מחדל)",
  "google/gemini-3.1-pro-preview": "Gemini 3.1 Pro Preview — Reasoning",
  "openai/gpt-5.4": "GPT-5.4 — Reasoning",
  "openai/gpt-5.4-pro": "GPT-5.4 Pro — Reasoning מתקדם",
  "openai/gpt-5.5": "GPT-5.5 — Reasoning מתקדם",
  "openai/gpt-5.5-pro": "GPT-5.5 Pro — Reasoning הכי איכותי",
};

export const MODEL_SHORT_LABELS: Record<string, string> = {
  "google/gemini-2.5-pro": "Gemini 2.5 Pro",
  "google/gemini-3.1-pro-preview": "Gemini 3.1 Pro",
  "google/gemini-3-flash-preview": "Gemini 3 Flash",
  "google/gemini-2.5-flash": "Gemini 2.5 Flash",
  "openai/gpt-5.4": "GPT-5.4",
  "openai/gpt-5.4-pro": "GPT-5.4 Pro",
  "openai/gpt-5.5": "GPT-5.5",
  "openai/gpt-5.5-pro": "GPT-5.5 Pro",
};

export function modelLabel(model: string | null | undefined): string {
  if (!model) return "—";
  return MODEL_LABELS[model] ?? model;
}

export function modelShortLabel(model: string | null | undefined): string {
  if (!model) return "—";
  return MODEL_SHORT_LABELS[model] ?? model;
}
