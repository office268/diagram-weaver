// ============================================================
// src/lib/ai/project-ideas.functions.ts
// Server function (createServerFn) — project-ideas.functions.ts
// נקודת RPC מהלקוח לשרת
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "@/lib/ai/gateway.server";

const IdeaSchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
});

export const generateProjectIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ name: string; description: string }> => {
    const { userId } = context;

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      throw new Error("Forbidden");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const gateway = createLovableAiGatewayProvider(apiKey);

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: [
        "אתה מייצר רעיונות מקוריים למערכות מידע ארגוניות בעברית.",
        "החזר שם קצר (3-6 מילים) ותיאור באורך של בדיוק 3 משפטים בעברית.",
        "התיאור חייב לכלול: (1) הערך העסקי, (2) משתמשי היעד, (3) פיצ'ר מרכזי או יכולת ייחודית.",
        "גוון בין דומיינים שונים (בריאות, חינוך, לוגיסטיקה, פיננסים, ייצור, נדל\"ן, וכו').",
      ].join("\n"),
      prompt: "צור רעיון אחד חדש ומעניין למערכת מידע.",
      output: Output.object({ schema: IdeaSchema }),
      maxOutputTokens: 500,
    });

    return {
      name: (output.name || "").trim(),
      description: (output.description || "").trim(),
    };
  });
