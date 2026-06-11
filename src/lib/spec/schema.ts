// ============================================================
// src/lib/spec/schema.ts
// ספריית עזר (lib) — spec-schema.ts
// ============================================================
import { z } from "zod";

export const RequirementSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
});
export type Requirement = z.infer<typeof RequirementSchema>;

export const TextItemSchema = z.object({
  id: z.string(),
  text: z.string(),
});
export type TextItem = z.infer<typeof TextItemSchema>;

export const PersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});
export type Persona = z.infer<typeof PersonaSchema>;

export const UseCaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  diagram: z.string().optional().default(""),
});
export type UseCase = z.infer<typeof UseCaseSchema>;

export const DiagramSectionSchema = z.object({
  description: z.string(),
  diagram: z.string().optional().default(""),
});
export type DiagramSection = z.infer<typeof DiagramSectionSchema>;

export const SpecContentSchema = z.object({
  overview: z.string(),
  goals: z.array(TextItemSchema),
  personas: z.array(PersonaSchema),
  functional_requirements: z.array(RequirementSchema),
  non_functional_requirements: z.array(RequirementSchema),
  assumptions: z.array(TextItemSchema),
  use_cases: z.array(UseCaseSchema),
  architecture: DiagramSectionSchema,
  data_model: DiagramSectionSchema,
  risks: z.array(TextItemSchema),
});
export type SpecContent = z.infer<typeof SpecContentSchema>;

export function emptySpec(): SpecContent {
  return {
    overview: "",
    goals: [],
    personas: [],
    functional_requirements: [],
    non_functional_requirements: [],
    assumptions: [],
    use_cases: [],
    architecture: { description: "", diagram: "" },
    data_model: { description: "", diagram: "" },
    risks: [],
  };
}

/** Generate a stable id for new client-side items. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Ensure missing fields are filled with safe defaults (for legacy/empty docs). */
export function normalizeSpec(input: unknown): SpecContent {
  const base = emptySpec();
  if (!input || typeof input !== "object") return base;
  const obj = input as Record<string, unknown>;
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    overview: typeof obj.overview === "string" ? obj.overview : "",
    goals: arr<TextItem>(obj.goals),
    personas: arr<Persona>(obj.personas),
    functional_requirements: arr<Requirement>(obj.functional_requirements),
    non_functional_requirements: arr<Requirement>(obj.non_functional_requirements),
    assumptions: arr<TextItem>(obj.assumptions),
    use_cases: arr<UseCase>(obj.use_cases),
    architecture:
      obj.architecture && typeof obj.architecture === "object"
        ? { description: String((obj.architecture as { description?: unknown }).description ?? ""), diagram: String((obj.architecture as { diagram?: unknown }).diagram ?? "") }
        : { description: "", diagram: "" },
    data_model:
      obj.data_model && typeof obj.data_model === "object"
        ? { description: String((obj.data_model as { description?: unknown }).description ?? ""), diagram: String((obj.data_model as { diagram?: unknown }).diagram ?? "") }
        : { description: "", diagram: "" },
    risks: arr<TextItem>(obj.risks),
  };
}
