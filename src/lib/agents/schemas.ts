// Per-agent Zod output schemas. Client-safe (no server imports).
import { z } from "zod";

export const ItemSchema = z.object({
  id: z.string().default(""),
  text: z.string().default(""),
});

export const RequirementSchema = z.object({
  id: z.string().default(""),
  title: z.string().default(""),
  description: z.string().default(""),
});

export const PersonaSchema = z.object({
  id: z.string().default(""),
  name: z.string().default(""),
  description: z.string().default(""),
});

export const UseCaseSchema = z.object({
  id: z.string().default(""),
  title: z.string().default(""),
  description: z.string().default(""),
  diagram: z.string().default(""),
});

export const DiagramSectionSchema = z.object({
  description: z.string().default(""),
  diagram: z.string().default(""),
});

export const RequirementsAgentSchema = z.object({
  overview: z.string().default(""),
  goals: z.array(ItemSchema).default([]),
  personas: z.array(PersonaSchema).default([]),
  functional_requirements: z.array(RequirementSchema).default([]),
  non_functional_requirements: z.array(RequirementSchema).default([]),
  assumptions: z.array(ItemSchema).default([]),
  risks: z.array(ItemSchema).default([]),
});
export type RequirementsOutput = z.infer<typeof RequirementsAgentSchema>;

export const ArchitectureAgentSchema = DiagramSectionSchema;
export type ArchitectureOutput = z.infer<typeof ArchitectureAgentSchema>;

export const DataModelAgentSchema = DiagramSectionSchema;
export type DataModelOutput = z.infer<typeof DataModelAgentSchema>;

export const UseCasesAgentSchema = z.object({
  use_cases: z.array(UseCaseSchema).default([]),
});
export type UseCasesOutput = z.infer<typeof UseCasesAgentSchema>;

export const TitleAgentSchema = z.object({
  title: z.string().default("מסמך אפיון"),
});

export const ReviewNoteAgentSchema = z.object({
  text: z.string().default(""),
  importance: z.number().int().min(1).max(10).default(5),
  // Which agent should re-run to address this note (Note Classifier output).
  target: z
    .enum(["requirements", "architecture", "data_model", "use_cases", "general"])
    .default("general"),
});
export type ReviewNoteAgent = z.infer<typeof ReviewNoteAgentSchema>;

export const ReviewAgentSchema = z.object({
  score: z.number().int().min(1).max(10).default(5),
  notes: z.array(ReviewNoteAgentSchema).default([]),
});
export type ReviewAgentOutput = z.infer<typeof ReviewAgentSchema>;

export type StageKey =
  | "context"
  | "title"
  | "requirements"
  | "architecture"
  | "data_model"
  | "use_cases"
  | "review"
  | "iterate";
