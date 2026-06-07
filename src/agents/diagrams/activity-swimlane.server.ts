import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { DEFAULT_AGENT_MODEL } from "@/agents/shared/constants";
import {
  ActivityDiagramGenerationError,
  STAGE1_SYSTEM,
  STAGE2_SYSTEM,
  parseProcessMapResponse,
  postProcessActivityMermaid,
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

export async function runExtractorAgent(
  model: Model,
  userPrompt: string,
): Promise<ProcessMap> {
  let text = "";
  try {
    const result = await generateText({
      model,
      system: STAGE1_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0,
    });
    text = result.text;
    return parseProcessMapResponse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[activity extractor] failed:", msg, "raw:", text.slice(0, 500));
    if (/payment required|402/i.test(msg)) {
      throw new Error("נגמרו הקרדיטים ל-AI. יש להוסיף קרדיטים בהגדרות > שימוש (402 Payment Required).");
    }
    if (/rate limit|429/i.test(msg)) {
      throw new Error("חרגת ממכסת הבקשות ל-AI. נסה שוב בעוד כמה רגעים (429 Rate Limit).");
    }

    if (err instanceof ActivityDiagramGenerationError) {
      if (err.code === "extractor_truncated") {
        throw new Error("שלב חילוץ מבנה התהליך נכשל — מודל ה-AI החזיר JSON קטוע. נסה שוב; אם זה חוזר, קצר מעט את התיאור או חלק אותו לשלבים.");
      }
      if (err.code === "extractor_invalid_schema") {
        throw new Error("שלב חילוץ מבנה התהליך נכשל — לא זוהו שחקנים תקינים בפלט המובנה. נסה לנסח את התהליך עם שחקנים ושלבים ברורים.");
      }
      throw new Error("שלב חילוץ מבנה התהליך נכשל — הפלט המובנה לא היה JSON תקין.");
    }

    throw err instanceof Error
      ? err
      : new Error("שלב חילוץ מבנה התהליך נכשל מסיבה לא ידועה.");
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

  const finalMermaid = postProcessActivityMermaid(mermaid);
  const finalViolations = validateActivityDiagram(finalMermaid);
  if (finalViolations.length > 0) {
    throw new ActivityDiagramGenerationError(
      "builder_invalid_mermaid",
      `שלב בניית תרשים ה-Activity נכשל — קוד Mermaid שנוצר עדיין אינו תקין: ${finalViolations.slice(0, 3).join(" | ")}`,
    );
  }

  return { mermaid: finalMermaid, iterations };
}
