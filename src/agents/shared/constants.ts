// ============================================================
// src/agents/shared/constants.ts
// משאבים משותפים לכל הסוכנים — constants.ts
// ============================================================
export const SCORE_THRESHOLD = 7;
export const MAX_ITERATIONS = 3;

// Default reasoning model for all agents. Admin can override via DB setting.
export const DEFAULT_AGENT_MODEL = "google/gemini-2.5-pro" as const;

export const AGENT_MODELS = {
  requirements:  DEFAULT_AGENT_MODEL,
  architecture:  DEFAULT_AGENT_MODEL,
  dataModel:     DEFAULT_AGENT_MODEL,
  useCases:      DEFAULT_AGENT_MODEL,
  diagrams:      DEFAULT_AGENT_MODEL,
  review:        DEFAULT_AGENT_MODEL,
} as const;

export const AGENT_TEMPERATURES = {
  requirements:  0.2,
  architecture:  0.15,
  dataModel:     0.1,
  useCases:      0.6,
  diagrams:      0.1,
  review:        0.2,
} as const;

export const AGENT_MAX_OUTPUT_TOKENS = {
  requirements: 4000,
  architecture: 6000,
  dataModel: 6000,
  useCases: 6000,
  diagrams: 8000,
  review: 2000,
  retryBoost: 8000,
} as const;

/** Keyword routing for the orchestrator improvement loop */
export const IMPROVEMENT_KEYWORDS = {
  requirements: ["דרישה", "FR", "NFR", "requirements", "מטרה", "סיכון", "הנחה"],
  architecture: ["ארכיטקטורה", "architecture", "רכיב", "diagram", "דיאגרמה"],
  useCases: ["תרחיש", "use case", "persona", "משתמש", "זרימה"],
} as const;

// Whitelist of models that admin can select for the agents.
export const ALLOWED_AGENT_MODELS = [
  "google/gemini-2.5-pro",
  "google/gemini-3.1-pro-preview",
  "openai/gpt-5.4",
  "openai/gpt-5.5",
  "anthropic/claude-opus-4-5",
  "anthropic/claude-sonnet-4-5",
] as const;

export type AllowedAgentModel = typeof ALLOWED_AGENT_MODELS[number];
