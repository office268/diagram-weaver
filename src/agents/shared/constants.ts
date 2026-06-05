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

// Whitelist of models that admin can select for the agents.
export const ALLOWED_AGENT_MODELS = [
  "google/gemini-2.5-pro",
  "google/gemini-3.1-pro-preview",
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "openai/gpt-5.4",
  "openai/gpt-5.4-pro",
  "openai/gpt-5.5",
  "openai/gpt-5.5-pro",
] as const;

export type AllowedAgentModel = typeof ALLOWED_AGENT_MODELS[number];
