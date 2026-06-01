export const SCORE_THRESHOLD = 7;
export const MAX_ITERATIONS = 3;

// Use the same default model as the existing system; swappable per agent
export const DEFAULT_AGENT_MODEL = "google/gemini-3-flash-preview" as const;

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
