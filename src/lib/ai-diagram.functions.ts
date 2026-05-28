import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const InputSchema = z.object({
  prompt: z.string().min(1).max(2000),
  diagram_type: z.string().min(1).max(50),
  existingCode: z.string().max(50000).optional(),
});

const DIAGRAM_HINTS: Record<string, string> = {
  flowchart: "Use `graph TD` or `flowchart TD` syntax.",
  sequence: "Use `sequenceDiagram` syntax with participants and arrows like ->> and -->>.",
  class: "Use `classDiagram` syntax with class blocks and relationships like <|--, *--, o--.",
  state: "Use `stateDiagram-v2` syntax with [*] start/end and transitions with `:` labels.",
  er: "Use `erDiagram` syntax with cardinality like ||--o{ and relationship labels.",
  gantt: "Use `gantt` syntax with `dateFormat YYYY-MM-DD` and sections.",
  activity: "Use `flowchart TB` with `subgraph LaneName ... end` blocks to represent swim-lanes, one subgraph per actor/lane.",
};

export const generateDiagramFromPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const hint = DIAGRAM_HINTS[data.diagram_type] ?? "";
    const system = [
      "You are an expert at writing Mermaid.js diagrams.",
      `The user wants a diagram of type: ${data.diagram_type}.`,
      hint,
      "Return ONLY valid Mermaid code — no code fences, no markdown, no explanation.",
      "Node labels may be in any language including Hebrew.",
      "Keep node IDs as short ASCII identifiers (A, B, C, step1...).",
      "Also propose a short descriptive title (max 60 chars) for the diagram.",
      data.existingCode
        ? "You are editing an existing diagram. Preserve the overall structure and IDs where it makes sense; apply the user's requested change."
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const userMsg = data.existingCode
      ? `Current diagram:\n\`\`\`\n${data.existingCode}\n\`\`\`\n\nRequested change:\n${data.prompt}`
      : data.prompt;

    try {
      const result = await generateText({
        model,
        system,
        prompt: userMsg,
        experimental_output: Output.object({
          schema: z.object({
            code: z.string().min(1),
            title: z.string().min(1).max(80),
          }),
        }),
      });

      const out = result.experimental_output;
      // Strip accidental code fences just in case
      const cleaned = out.code
        .replace(/^```(?:mermaid)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();

      return { code: cleaned, title: out.title };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("429")) throw new Error("Rate limit reached. Please try again in a moment.");
      if (msg.includes("402")) throw new Error("AI credits exhausted. Add credits in Settings.");
      throw new Error(`AI generation failed: ${msg}`);
    }
  });
