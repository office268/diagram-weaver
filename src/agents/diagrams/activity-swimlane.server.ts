import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { DEFAULT_AGENT_MODEL } from "@/agents/shared/constants";
import type { UsageTracker } from "@/lib/ai-usage.server";
import {
  ActivityDiagramGenerationError,
  STAGE1_SYSTEM,
  STAGE2_HTML_SYSTEM,
  parseProcessMapResponse,
  extractSvg,
  validateActivitySvg,
  reviewActivitySvg,
  type ProcessMap,
} from "@/lib/activity-diagram-pipeline.server";

type Model = Parameters<typeof generateText>[0]["model"];

export async function runExtractorAgent(
  model: Model,
  userPrompt: string,
  tracker?: UsageTracker,
  modelName?: string,
): Promise<ProcessMap> {
  let text = "";
  const MAX_ATTEMPTS = 3;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const system =
        attempt === 0
          ? STAGE1_SYSTEM
          : `${STAGE1_SYSTEM}\n\nניסיון חוזר (${attempt + 1}/${MAX_ATTEMPTS}): החזר אובייקט JSON מלא ותקין בלבד. אל תחתוך את הפלט, אל תעטוף ב-markdown, ואל תחזיר טקסט נוסף. ודא שכל הסוגריים נסגרים והפלט מסתיים ב-}.`;

      const result = await generateText({
        model,
        system,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0,
        maxOutputTokens: 16000,
      });
      if (tracker && modelName) tracker.track(modelName, result.usage);
      text = result.text;
      return parseProcessMapResponse(text);
    } catch (err) {
      if (
        err instanceof ActivityDiagramGenerationError &&
        attempt < MAX_ATTEMPTS - 1 &&
        (err.code === "extractor_truncated" || err.code === "extractor_invalid_json")
      ) {
        continue;
      }

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

  throw new Error("שלב חילוץ מבנה התהליך נכשל — לא התקבל פלט מובנה תקין.");
}

/** Agent 2 — generate SVG swimlane from ProcessMap + original prompt */
export async function runBuilderAgent(
  model: Model,
  processMap: ProcessMap,
  userPrompt: string,
  tracker?: UsageTracker,
  modelName?: string,
): Promise<string> {
  const prompt =
    `תיאור התהליך המקורי: ${userPrompt}\n\n` +
    `מבנה מובנה של התהליך:\n` +
    "```json\n" +
    JSON.stringify(processMap, null, 2) +
    "\n```\n\n" +
    `צור תרשים activity swimlane כ-SVG לפי המבנה.`;

  const r = await generateText({
    model,
    system: STAGE2_HTML_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
  });
  if (tracker && modelName) tracker.track(modelName, r.usage);
  const svg = extractSvg(r.text);
  if (!svg) {
    throw new ActivityDiagramGenerationError(
      "builder_invalid_svg",
      "שלב בניית תרשים ה-Activity נכשל — המודל לא החזיר SVG תקין.",
    );
  }
  return svg;
}

/** Agent 3 — validate SVG: structural checks + LLM semantic review */
export async function runValidatorAgent(
  model: Model,
  svg: string,
  userPrompt: string,
  tracker?: UsageTracker,
  modelName?: string,
): Promise<{ violations: string[] }> {
  const structuralViolations = validateActivitySvg(svg);
  const review = await reviewActivitySvg(model, svg, userPrompt, tracker, modelName);
  const llmViolations =
    !review.ok && Array.isArray(review.violations) ? review.violations : [];
  const merged = [
    ...structuralViolations,
    ...llmViolations.filter(
      (v) => !structuralViolations.some((r) => r.slice(0, 25) === v.slice(0, 25)),
    ),
  ];
  return { violations: merged };
}

/** Agent 4 — fix violations: return corrected SVG */
export async function runFixerAgent(
  model: Model,
  svg: string,
  violations: string[],
  userPrompt: string,
  tracker?: UsageTracker,
  modelName?: string,
): Promise<string> {
  const violationsList = violations.map((v) => `• ${v}`).join("\n");
  const prompt =
    `תיאור התהליך המקורי: ${userPrompt}\n\n` +
    `קוד SVG הנוכחי:\n${svg}\n\n` +
    `הפרות שנמצאו:\n${violationsList}\n\n` +
    `תקן את כל ההפרות והחזר את קוד ה-SVG המלא המתוקן.`;

  const r = await generateText({
    model,
    system: STAGE2_HTML_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });
  if (tracker && modelName) tracker.track(modelName, r.usage);
  const fixed = extractSvg(r.text);
  if (!fixed) return svg;
  return fixed;
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
  tracker?: UsageTracker;
}): Promise<{ svg: string; iterations: number }> {
  const { userPrompt, lovableApiKey, modelOverride, maxFixIterations = 2, tracker } = params;
  const gateway = createLovableAiGatewayProvider(lovableApiKey);
  const modelName = modelOverride ?? DEFAULT_AGENT_MODEL;
  const model = gateway(modelName);

  const processMap = await runExtractorAgent(model, userPrompt, tracker, modelName);

  let svg = await runBuilderAgent(model, processMap, userPrompt, tracker, modelName);
  let iterations = 1;

  for (let i = 0; i < maxFixIterations; i++) {
    const { violations } = await runValidatorAgent(model, svg, userPrompt, tracker, modelName);
    if (violations.length === 0) break;

    const fixed = await runFixerAgent(model, svg, violations, userPrompt, tracker, modelName);
    if (validateActivitySvg(fixed).length <= validateActivitySvg(svg).length) {
      svg = fixed;
    }
    iterations++;
  }

  const finalViolations = validateActivitySvg(svg);
  if (finalViolations.length > 0) {
    throw new ActivityDiagramGenerationError(
      "builder_invalid_svg",
      `שלב בניית תרשים ה-Activity נכשל — SVG שנוצר אינו תקין: ${finalViolations.slice(0, 3).join(" | ")}`,
    );
  }

  return { svg, iterations };
}
