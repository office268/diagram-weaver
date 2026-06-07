import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { DEFAULT_AGENT_MODEL } from "@/agents/shared/constants";
import {
  STAGE1_SYSTEM,
  STAGE2_SYSTEM,
  validateActivityDiagram,
  reviewActivityDiagram,
  type ProcessMap,
} from "@/lib/activity-diagram-pipeline.server";

type Model = Parameters<typeof generateText>[0]["model"];

function extractMermaid(text: string): string {
  const fence = text.match(/```(?:mermaid)?\s*\n([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  return text.trim();
}

/** Agent 1 — extract structured ProcessMap from natural language */
export async function runExtractorAgent(
  model: Model,
  userPrompt: string,
): Promise<ProcessMap | null> {
  try {
    const { text } = await generateText({
      model,
      system: STAGE1_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0,
    });
    const clean = text.replace(/```json[^\n]*\n?/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(clean) as Partial<ProcessMap>;
    if (!Array.isArray(parsed.actors) || parsed.actors.length === 0) return null;
    return {
      actors: parsed.actors,
      steps: parsed.steps ?? [],
      decisions: parsed.decisions ?? [],
      merges: parsed.merges ?? [],
    };
  } catch {
    return null;
  }
}

/** Agent 2 — generate Mermaid swimlane from ProcessMap + original prompt */
export async function runBuilderAgent(
  model: Model,
  processMap: ProcessMap,
  userPrompt: string,
): Promise<string> {
  const prompt =
    `תיאור התהליך המקורי: ${userPrompt}\n\n` +
    `מבנה מובנה של התהליך:\n` +
    "```json\n" +
    JSON.stringify(processMap, null, 2) +
    "\n```\n\n" +
    `צור תרשים Mermaid swimlane לפי המבנה.`;

  const { text } = await generateText({
    model,
    system: STAGE2_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
  });
  return extractMermaid(text);
}

/** Agent 3 — validate Mermaid: regex structural checks + LLM semantic review */
export async function runValidatorAgent(
  model: Model,
  mermaid: string,
  userPrompt: string,
): Promise<{ violations: string[] }> {
  const regexViolations = validateActivityDiagram(mermaid);
  const review = await reviewActivityDiagram(model, mermaid, userPrompt);
  const llmViolations =
    !review.ok && Array.isArray(review.violations) ? review.violations : [];
  // Merge, skipping LLM duplicates already caught by regex
  const merged = [
    ...regexViolations,
    ...llmViolations.filter(
      (v) => !regexViolations.some((r) => r.slice(0, 25) === v.slice(0, 25)),
    ),
  ];
  return { violations: merged };
}

/** Agent 4 — fix violations: return corrected Mermaid */
export async function runFixerAgent(
  model: Model,
  mermaid: string,
  violations: string[],
  userPrompt: string,
): Promise<string> {
  const violationsList = violations.map((v) => `• ${v}`).join("\n");
  const prompt =
    `תיאור התהליך המקורי: ${userPrompt}\n\n` +
    `קוד Mermaid הנוכחי:\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n\n` +
    `הפרות שנמצאו:\n${violationsList}\n\n` +
    `תקן את כל ההפרות והחזר את קוד ה-Mermaid המלא המתוקן.`;

  const { text } = await generateText({
    model,
    system: STAGE2_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });
  return extractMermaid(text);
}

/**
 * Full activity swimlane orchestrator.
 * Extract → Build → (Validate → Fix) × maxFixIterations
 */
export async function runActivitySwimlaneOrchestrator(params: {
  userPrompt: string;
  lovableApiKey: string;
  modelOverride?: string;
  maxFixIterations?: number;
}): Promise<{ mermaid: string; iterations: number }> {
  const { userPrompt, lovableApiKey, modelOverride, maxFixIterations = 2 } = params;
  const gateway = createLovableAiGatewayProvider(lovableApiKey);
  const model = gateway(modelOverride ?? DEFAULT_AGENT_MODEL);

  const processMap = await runExtractorAgent(model, userPrompt);
  if (!processMap) throw new Error("activity extractor failed to parse process structure");

  let mermaid = await runBuilderAgent(model, processMap, userPrompt);
  let iterations = 1;

  for (let i = 0; i < maxFixIterations; i++) {
    const { violations } = await runValidatorAgent(model, mermaid, userPrompt);
    if (violations.length === 0) break;

    const fixed = await runFixerAgent(model, mermaid, violations, userPrompt);
    // Accept the fix only if it doesn't regress on structural rules
    if (validateActivityDiagram(fixed).length <= validateActivityDiagram(mermaid).length) {
      mermaid = fixed;
    }
    iterations++;
  }

  return { mermaid, iterations };
}
