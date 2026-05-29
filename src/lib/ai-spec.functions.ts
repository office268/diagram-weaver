import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import {
  COMPARISON_MODELS,
  DEFAULT_SYSTEM_INSTRUCTION,
  JSON_OUTPUT_INSTRUCTION,
  type SpecModel,
} from "./ai-spec-defaults";

const InputSchema = z.object({
  prompt: z.string().min(5).max(5000),
  model: z.enum(COMPARISON_MODELS),
});

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

const SpecOutputSchema = z.object({
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

function extractJson(text: string): string {
  let t = text.trim();
  // strip ```json ... ``` or ``` ... ``` fences
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) t = fence[1].trim();
  // fall back: slice from first { to last }
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return t;
}

async function generateOne(
  modelId: SpecModel,
  apiKey: string,
  system: string,
  prompt: string,
): Promise<SpecOutput> {
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway(modelId);
  const result = await generateText({
    model,
    system: system + "\n" + JSON_OUTPUT_INSTRUCTION,
    prompt,
  });
  const raw = extractJson(result.text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("המודל לא החזיר JSON תקני");
  }
  return SpecOutputSchema.parse(parsed);
}

export const generateSpecFromModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("ai_settings")
      .select("system_instruction")
      .eq("user_id", userId)
      .maybeSingle();
    const system = row?.system_instruction ?? DEFAULT_SYSTEM_INSTRUCTION;

    try {
      const spec = await generateOne(data.model, key, system, data.prompt);
      return { model: data.model, spec };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      let friendly = msg;
      if (msg.includes("429")) friendly = "הגעת למגבלת קצב.";
      else if (msg.includes("402")) friendly = "אזלו קרדיטי ה-AI.";
      throw new Error(friendly);
    }
  });
