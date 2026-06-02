import { generateText } from "ai";
import type { SpecOutput, SpecReview } from "@/lib/spec-output-schema";
import { ReviewSchema, extractJson } from "@/lib/spec-output-schema";
import { AGENT_MODELS, AGENT_TEMPERATURES } from "@/agents/shared/constants";
import { buildSelfCritiqueInstruction } from "@/agents/shared/prompt-helpers";
import type { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const REVIEW_SYSTEM = [
  "אתה מבקר איכות בכיר של מסמכי אפיון מערכת.",
  "קיבלת את הפרומפט המקורי של המשתמש ואת מסמך האפיון (JSON).",
  "",
  "תפקידך: לדרג את המסמך בציון שלם בין 1 ל-10 על בסיס:",
  "- שלמות (כל הסעיפים מלאים?)",
  "- עקביות (אין סתירות בין סעיפים?)",
  "- רמת פירוט (דרישות מדידות? תרחישים ברורים?)",
  "- כיסוי הפרומפט (המסמך עונה על מה שהתבקש?)",
  "- איכות דיאגרמות Mermaid (תקניות? מייצגות?)",
  "",
  "כתוב עד 8 הערות שיפור — קצרות, קונקרטיות, מעשיות, בעברית.",
  "לכל הערה: דירוג חשיבות 1 (שולי) עד 10 (קריטי).",
  "אם המסמך מצוין — החזר notes ריק.",
  "",
  "בדיקות עקביות שחובה לבצע:",
  "- כל FR: מופיע בלפחות use case אחד?",
  "- כל persona: יש לה לפחות use case אחד?",
  "- דיאגרמות: מזהי צמתים ASCII?",
  "",
  buildSelfCritiqueInstruction([
    "לפני ציון — רשום 2 טיעונים לציון גבוה יותר ו-2 לנמוך יותר, ואז החלט.",
  ]),
  "",
  'פורמט פלט: { "score": <1-10>, "notes": [{ "text": string, "importance": <1-10> }] }',
  "JSON תקני בלבד, ללא עטיפה.",
].join("\n");

export async function runReviewAgent(
  spec: SpecOutput,
  userPrompt: string,
  gateway: ReturnType<typeof createLovableAiGatewayProvider>,
): Promise<SpecReview> {
  const prompt = [
    "## פרומפט מקורי\n" + userPrompt,
    "## מסמך האפיון\n" + JSON.stringify(spec),
  ].join("\n\n");

  let text: string;
  try {
    const res = await generateText({
      model: gateway(AGENT_MODELS.review),
      system: REVIEW_SYSTEM,
      prompt,
      maxOutputTokens: 2000,
      temperature: AGENT_TEMPERATURES.review,
    });
    text = res.text;
  } catch (err) {
    console.warn("[review-agent] generateText failed, using default review:", err);
    return { score: 8, notes: [] };
  }

  try {
    const raw = JSON.parse(extractJson(text));
    const score = Math.max(1, Math.min(10, Math.round(Number(raw.score) || 5)));
    const notes = (Array.isArray(raw.notes) ? raw.notes : [])
      .map((n: unknown, i: number) => {
        if (typeof n === "string") return { id: `n-${i + 1}`, text: n, importance: 5 };
        const obj = n as Record<string, unknown>;
        return {
          id: `n-${i + 1}`,
          text: String(obj.text ?? "").slice(0, 500),
          importance: Math.max(1, Math.min(10, Math.round(Number(obj.importance) || 5))),
        };
      })
      .filter((n: { text: string }) => n.text.trim())
      .slice(0, 8);
    return ReviewSchema.parse({ score, notes });
  } catch {
    return { score: 8, notes: [] };
  }
}

/** Filter review notes relevant to a set of keywords */
export function filterNotesByKeywords(
  notes: SpecReview["notes"],
  keywords: string[],
): SpecReview["notes"] {
  return notes.filter((n) =>
    keywords.some((kw) => n.text.toLowerCase().includes(kw.toLowerCase())),
  );
}
