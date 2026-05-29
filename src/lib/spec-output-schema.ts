import { z } from "zod";

const ItemSchema = z.object({
  id: z.string().default(""),
  text: z.string().default(""),
});

const RequirementSchema = z.object({
  id: z.string().default(""),
  title: z.string().default(""),
  description: z.string().default(""),
});

const PersonaSchema = z.object({
  id: z.string().default(""),
  name: z.string().default(""),
  description: z.string().default(""),
});

const UseCaseSchema = z.object({
  id: z.string().default(""),
  title: z.string().default(""),
  description: z.string().default(""),
  diagram: z.string().default(""),
});

export const SpecOutputSchema = z.object({
  title: z.string().default("מסמך אפיון"),
  overview: z.string().default(""),
  goals: z.array(ItemSchema).default([]),
  personas: z.array(PersonaSchema).default([]),
  functional_requirements: z.array(RequirementSchema).default([]),
  non_functional_requirements: z.array(RequirementSchema).default([]),
  assumptions: z.array(ItemSchema).default([]),
  use_cases: z.array(UseCaseSchema).default([]),
  architecture: z
    .object({
      description: z.string().default(""),
      diagram: z.string().default(""),
    })
    .default({ description: "", diagram: "" }),
  data_model: z
    .object({
      description: z.string().default(""),
      diagram: z.string().default(""),
    })
    .default({ description: "", diagram: "" }),
  risks: z.array(ItemSchema).default([]),
});

export type SpecOutput = z.infer<typeof SpecOutputSchema>;

export function extractJson(text: string): string {
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) t = fence[1].trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return t;
}
