import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { DEFAULT_SYSTEM_INSTRUCTION, SPEC_MODEL } from "./ai-spec-defaults";

const InputSchema = z.object({
  prompt: z.string().min(5).max(5000),
});

const ItemSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
});

const RequirementSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
});

const PersonaSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().min(1),
});

const UseCaseSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  diagram: z.string().default(""),
});

const SpecOutputSchema = z.object({
  title: z.string().min(1).max(120),
  overview: z.string().min(1),
  goals: z.array(ItemSchema).min(1),
  personas: z.array(PersonaSchema).min(1),
  functional_requirements: z.array(RequirementSchema).min(1),
  non_functional_requirements: z.array(RequirementSchema).min(1),
  assumptions: z.array(ItemSchema).min(1),
  use_cases: z.array(UseCaseSchema).min(1),
  architecture: z.object({
    description: z.string().min(1),
    diagram: z.string().default(""),
  }),
  data_model: z.object({
    description: z.string().min(1),
    diagram: z.string().default(""),
  }),
  risks: z.array(ItemSchema).min(1),
});

export const generateSpecFromPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway(SPEC_MODEL);

    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("ai_settings")
      .select("system_instruction")
      .eq("user_id", userId)
      .maybeSingle();
    const system = row?.system_instruction ?? DEFAULT_SYSTEM_INSTRUCTION;

    try {
      const result = await generateText({
        model,
        system,
        prompt: data.prompt,
        experimental_output: Output.object({ schema: SpecOutputSchema }),
      });

      return result.experimental_output;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("429")) throw new Error("הגעת למגבלת קצב. נסה שוב בעוד רגע.");
      if (msg.includes("402")) throw new Error("אזלו קרדיטי ה-AI. יש להוסיף קרדיטים בהגדרות.");
      throw new Error(`יצירת המסמך נכשלה: ${msg}`);
    }
  });
