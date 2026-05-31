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

export const ReviewNoteSchema = z.object({
  id: z.string().default(""),
  text: z.string().default(""),
  importance: z.number().int().min(1).max(10).default(5),
});
export type ReviewNote = z.infer<typeof ReviewNoteSchema>;

export const ReviewSchema = z.object({
  score: z.number().int().min(1).max(10),
  notes: z.array(ReviewNoteSchema).default([]),
});
export type SpecReview = z.infer<typeof ReviewSchema>;

/** Normalize raw notes (may be strings from legacy data) into ReviewNote[]. */
export function normalizeReviewNotes(raw: unknown): ReviewNote[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((n, i): ReviewNote | null => {
      if (typeof n === "string") {
        const t = n.trim();
        if (!t) return null;
        return { id: `n-${i + 1}`, text: t, importance: 5 };
      }
      if (n && typeof n === "object") {
        const obj = n as Record<string, unknown>;
        const text =
          typeof obj.text === "string"
            ? obj.text
            : typeof obj.note === "string"
              ? obj.note
              : "";
        if (!text.trim()) return null;
        const importance =
          typeof obj.importance === "number"
            ? Math.max(1, Math.min(10, Math.round(obj.importance)))
            : 5;
        const id =
          typeof obj.id === "string" && obj.id.length > 0
            ? obj.id
            : `n-${i + 1}`;
        return { id, text: text.trim().slice(0, 1000), importance };
      }
      return null;
    })
    .filter((n): n is ReviewNote => n !== null);
}

export function extractJson(text: string): string {
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) t = fence[1].trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return t;
}
