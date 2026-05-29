import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

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
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-pro");

    const system = [
      "אתה אנליסט מערכות בכיר. בהינתן תיאור של מערכת בעברית, החזר מסמך אפיון על מלא ומובנה.",
      "המסמך חייב לכלול: סקירה כללית, מטרות, משתמשי קצה (personas), דרישות פונקציונליות, דרישות לא-פונקציונליות, הנחות יסוד (לגבי דברים שלא צוינו במפורש), תרחישי שימוש מרכזיים, ארכיטקטורה, מודל נתונים, וסיכונים.",
      "כל הטקסטים בעברית, ברורים ומקצועיים.",
      "כל פריט ברשימה חייב לקבל id ייחודי קצר (למשל 'req-1', 'a-1', 'p-1').",
      "בתרחישי שימוש: לפחות 2 תרחישים. אם רלוונטי, כלול תרשים Mermaid מסוג sequenceDiagram בשדה `diagram`. אם לא רלוונטי, השאר מחרוזת ריקה.",
      "בארכיטקטורה: חובה לכלול תרשים Mermaid (graph TD או flowchart TD) בשדה `diagram` שמדגים את הרכיבים המרכזיים והקשרים ביניהם.",
      "במודל הנתונים: חובה לכלול תרשים Mermaid מסוג erDiagram בשדה `diagram` שמתאר את הישויות העיקריות והקשרים ביניהן.",
      "תוויות צמתים ב-Mermaid יכולות להיות בעברית, אבל מזהי הצמתים (A, B, USER, ORDER) חייבים להיות ASCII קצר.",
      "אל תעטוף קוד Mermaid ב-``` או בסימני קוד. רק קוד נקי בשדה diagram.",
      "הנחות היסוד צריכות להיות דברים שהמשתמש לא ציין אך אתה מניח לטובת השלמת המסמך — לפחות 3.",
      "דרישות פונקציונליות: לפחות 5. דרישות לא-פונקציונליות: לפחות 3 (ביצועים, אבטחה, נגישות וכו').",
      "סיכונים: לפחות 3.",
    ].join("\n");

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
