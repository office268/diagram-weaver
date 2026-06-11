// ============================================================
// src/lib/diagrams/activity-pipeline.server.ts
// מודול server-only — activity-diagram-pipeline.server.ts
// מורץ רק בצד השרת (TanStack Start)
// ============================================================
import { generateText } from "ai";

export interface ProcessMap {
  actors: string[];
  steps: Array<{ actor: string; action: string }>;
  decisions: Array<{ label: string; branches: string[] }>;
  merges: Array<{ from: string[]; to: string }>;
}

export const STAGE1_SYSTEM =
  `אתה מנתח תהליכים עסקיים. המשתמש מתאר תהליך — חלץ ממנו מבנה JSON תקני ללא markdown.` +
  `\n\nפורמט נדרש (JSON בלבד, ללא הסברים):` +
  `\n{` +
  `\n  "actors": ["שם שחקן 1", "שם שחקן 2"],` +
  `\n  "steps": [{"actor": "שם השחקן", "action": "תיאור הפעולה"}, ...],` +
  `\n  "decisions": [{"label": "שאלה?", "branches": ["ענף 1", "ענף 2"]}, ...],` +
  `\n  "merges": [{"from": ["פעולה א", "פעולה ב"], "to": "פעולת הסינכרון"}]` +
  `\n}` +
  `\n\nהנחיות:` +
  `\n- actors: לפי סדר הופעה; השחקן הראשון מתחיל את התהליך` +
  `\n- steps: כל הפעולות לפי סדר לוגי, כולל פעולות שחוזרות בלולאה` +
  `\n- decisions: decision אחד לכל נקודת החלטה — גם אם יש 3 תוצאות זהו decision אחד עם 3 branches` +
  `\n- merges: מערך ריק [] אם אין מיזוג נתיבים` +
  `\n- אם ספק — עדיף פחות מידע מאשר מידע שגוי`;

// ── SVG pipeline (replaces former Mermaid Stage 2) ──────────────────────────

export const STAGE2_HTML_SYSTEM =
  `אתה מומחה SVG. קיבלת JSON המתאר תהליך בעברית ותיאור מקורי. צור תרשים activity swimlane כ-SVG בלבד.` +

  `\n\n## נוסחת קואורדינטות — חובה לציית במדויק` +
  `\nMARGIN=90  LANE_W=340  HEADER_H=44  ROW_H=110` +
  `\nActor i center_x  = 90 + i*340 + 170` +
  `\nRow j center_y    = 110 + j*110   (j=0 לשורה ראשונה)` +
  `\nSVG width  = 90 + N_actors*340 + 10` +
  `\nSVG height = 110 + (total_rows + 2) * 110` +

  `\n\n## מבנה SVG קבוע` +
  `\n<svg viewBox="0 0 WIDTH HEIGHT" xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif">` +
  `\n<defs><marker id="arr" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">` +
  `\n  <polygon points="0 0, 9 3.5, 0 7" fill="#111"/></marker></defs>` +

  `\n\n<!-- מחיצות אנכיות: line לכל גבול בין lanes (לא כולל הקצה השמאלי של MARGIN) -->` +
  `\n<line x1="[90+i*340]" y1="0" x2="[90+i*340]" y2="HEIGHT" stroke="#5566cc" stroke-width="1.3" stroke-dasharray="7,5"/>` +

  `\n\n<!-- כותרת -->` +
  `\n<line x1="90" y1="44" x2="WIDTH" y2="44" stroke="#5566cc" stroke-width="1.3" stroke-dasharray="7,5"/>` +
  `\n<text x="[center_x]" y="28" text-anchor="middle" font-size="16" font-weight="bold" fill="#3344bb" text-decoration="underline">שם Actor</text>` +

  `\n\n## אלמנטים` +

  `\n\nSTART (איש מקל) — x=45, y=center_y של שורה ראשונה:` +
  `\n<circle cx="45" cy="[y-10]" r="13" fill="none" stroke="#222" stroke-width="1.6"/>` +
  `\n<line x1="45" y1="[y+3]" x2="45" y2="[y+34]" stroke="#222" stroke-width="1.6"/>` +
  `\n<line x1="25" y1="[y+17]" x2="65" y2="[y+17]" stroke="#222" stroke-width="1.6"/>` +
  `\n<line x1="45" y1="[y+34]" x2="27" y2="[y+57]" stroke="#222" stroke-width="1.6"/>` +
  `\n<line x1="45" y1="[y+34]" x2="63" y2="[y+57]" stroke="#222" stroke-width="1.6"/>` +

  `\n\nTASK (מלבן) — center(cx, cy), גודל 150×46 (או 150×60 לשתי שורות טקסט):` +
  `\n<rect x="[cx-75]" y="[cy-23]" width="150" height="46" fill="white" stroke="#222" stroke-width="1.6"/>` +
  `\n<text x="[cx]" y="[cy+5]" text-anchor="middle" font-size="13">טקסט שורה אחת</text>` +
  `\nלשני שורות: text ראשון y=[cy-5], שני y=[cy+13]` +

  `\n\nDECISION (diamond) — center(cx, cy), half=48:` +
  `\n<polygon points="[cx],[cy-48] [cx+50],[cy] [cx],[cy+48] [cx-50],[cy]" fill="white" stroke="#222" stroke-width="1.6"/>` +
  `\n<text x="[cx]" y="[cy+6]" text-anchor="middle" font-size="14">שאלה?</text>` +

  `\n\nJOIN BAR (מיזוג נתיבים) — רצועה שחורה עבה:` +
  `\n<rect x="[x_min-60]" y="[join_y]" width="[span+120]" height="11" fill="#111"/>` +
  `\nspan = מרחק בין x הכי שמאלי לכי ימני של הנתיבים הנכנסים` +

  `\n\nEND (עיגול סיום) — x=45:` +
  `\n<circle cx="45" cy="[cy]" r="22" fill="white" stroke="#222" stroke-width="1.6"/>` +
  `\n<text x="45" y="[cy+5]" text-anchor="middle" font-size="12">סיום</text>` +

  `\n\n## חיצים — כל חץ: stroke="#111" stroke-width="1.6" marker-end="url(#arr)"` +
  `\nחץ מ-START לצומת ראשון: קו אופקי (x1=62 → x2=שמאל הצומת) באותה y` +
  `\nבתוך אותה עמודה (אנכי): x1=x2=center_x, y1=תחתית מקור, y2=עליית יעד` +
  `\nבין עמודות (אופקי): קו ישר באותה y בין קצה המקור לקצה היעד` +
  `\nלולאת חזרה: מתחתית הצומת → למטה → שמאלה עד x=130 → למעלה עד y של היעד → ימינה לצומת` +
  `\nאחרי JOIN BAR: ממרכז הבר → למטה → שמאלה לצומת הסיום` +
  `\nחץ מ-END לצומת: קו אופקי מ-x=67 שמאלה לצומת הסיום` +

  `\n\n## כללים` +
  `\n- אל תוסיף פעולות שלא מוזכרות ב-ProcessMap` +
  `\n- כל actor = lane נפרדת` +
  `\n- לכל decision: diamond + ענף שמאלי (בירור/לא) + ענף ימני (אישור/כן) + ענף ישיר למטה (דחייה) לפי ההקשר` +
  `\n- לכל merge: JOIN BAR בשורה נפרדת מתחת לכל הענפים המתמזגים` +

  `\n\n## פלט` +
  `\nהחזר אך ורק <svg ...>...</svg> — ללא DOCTYPE, ללא <html>, ללא הסברים, ללא markdown.`;

export function extractSvg(text: string): string | null {
  const m = text.match(/<svg[\s\S]*?<\/svg>/i);
  return m ? m[0] : null;
}

export function validateActivitySvg(svg: string): string[] {
  const v: string[] = [];
  if (!svg.trim().toLowerCase().startsWith("<svg")) v.push("הפלט אינו מתחיל ב-<svg>");
  if (!/<\/svg>/i.test(svg)) v.push("חסר </svg> בסוף");
  if (!/<line\b/.test(svg)) v.push("חסרים חיצים (<line>)");
  if (!/<text\b/.test(svg)) v.push("חסרות תוויות (<text>)");
  if (!/<rect\b/.test(svg)) v.push("חסרים מלבני תהליך (<rect>)");
  return v;
}

const SVG_REVIEW_SYSTEM =
  `אתה מבקר תרשימי SVG swimlane. קיבלת SVG ותיאור התהליך המקורי.` +
  `\n\nבדוק:` +
  `\n1. כל actor מהתיאור מוצג כ-lane נפרד (כותרת + מחיצה אנכית)` +
  `\n2. כל שלב מהתיאור מופיע כצומת (<rect> + <text>)` +
  `\n3. כל decision מהתיאור מופיע כ-diamond (<polygon>)` +
  `\n4. חיצים (<line>) מחברים את הצמתים בסדר הנכון` +
  `\n5. אין פעולות שלא מוזכרות בתיאור המקורי` +
  `\n\nהחזר JSON בלבד ללא markdown:` +
  `\n{"ok":true}` +
  `\nאו אם יש הפרות: {"ok":false,"violations":["תיאור הפרה 1","תיאור הפרה 2"]}`;

export interface DiagramReviewResult {
  ok: boolean;
  violations?: string[];
  fixedCode?: string;
}

export async function reviewActivitySvg(
  model: Parameters<typeof generateText>[0]["model"],
  svgCode: string,
  originalPrompt: string,
  tracker?: { track(model: string, usage: unknown): void },
  modelName?: string,
): Promise<DiagramReviewResult> {
  try {
    const userMessage =
      `תיאור התהליך המקורי:\n${originalPrompt}\n\n` +
      `קוד SVG שנוצר:\n${svgCode.slice(0, 6000)}\n\n` +
      `בדוק את התרשים והחזר JSON לפי הפורמט המבוקש.`;

    const r = await generateText({
      model,
      system: SVG_REVIEW_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
      temperature: 0,
    });
    if (tracker && modelName) tracker.track(modelName, r.usage as never);
    const text = r.text;

    const clean = text.replace(/```json[^\n]*\n?/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(clean) as Partial<DiagramReviewResult>;
    if (typeof parsed.ok !== "boolean") return { ok: true };
    return {
      ok: parsed.ok,
      violations: Array.isArray(parsed.violations) ? parsed.violations : undefined,
    };
  } catch {
    return { ok: true };
  }
}

export type ActivityDiagramErrorCode =
  | "extractor_truncated"
  | "extractor_invalid_json"
  | "extractor_invalid_schema"
  | "builder_invalid_svg";

export class ActivityDiagramGenerationError extends Error {
  constructor(
    public readonly code: ActivityDiagramErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ActivityDiagramGenerationError";
  }
}

function stripJsonCodeFences(raw: string): string {
  return raw.replace(/```json[^\n]*\n?/gi, "").replace(/```\s*/g, "").trim();
}

function extractBalancedJsonBlock(raw: string): string | null {
  const start = raw.search(/[\[{]/);
  if (start === -1) return null;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const char = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const open = stack.at(-1);
      if (!open) return null;
      if ((open === "{" && char !== "}") || (open === "[" && char !== "]")) {
        return null;
      }
      stack.pop();
      if (stack.length === 0) return raw.slice(start, i + 1);
    }
  }

  return null;
}

function repairCommonJsonIssues(raw: string): string {
  return raw
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

export function detectJsonTruncation(raw: string): boolean {
  const cleaned = stripJsonCodeFences(raw);
  if (!cleaned) return false;

  if (/\.\.\.$|…$|\[truncated\]$|\[continued\]$/i.test(cleaned)) {
    return true;
  }

  const hasJsonStart = /[\[{]/.test(cleaned);
  if (!hasJsonStart) return false;

  return extractBalancedJsonBlock(cleaned) === null;
}

export function parseProcessMapResponse(raw: string): ProcessMap {
  const cleaned = stripJsonCodeFences(raw);
  const jsonCandidate = extractBalancedJsonBlock(cleaned);

  if (!jsonCandidate) {
    if (detectJsonTruncation(cleaned)) {
      throw new ActivityDiagramGenerationError(
        "extractor_truncated",
        "Activity extractor returned truncated JSON.",
      );
    }

    throw new ActivityDiagramGenerationError(
      "extractor_invalid_json",
      "Activity extractor did not return a JSON object.",
    );
  }

  let parsed: Partial<ProcessMap>;
  try {
    parsed = JSON.parse(repairCommonJsonIssues(jsonCandidate)) as Partial<ProcessMap>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Unexpected end of JSON input/i.test(message) || detectJsonTruncation(jsonCandidate)) {
      throw new ActivityDiagramGenerationError(
        "extractor_truncated",
        "Activity extractor returned truncated JSON.",
      );
    }

    throw new ActivityDiagramGenerationError(
      "extractor_invalid_json",
      `Activity extractor returned invalid JSON: ${message}`,
    );
  }

  if (!Array.isArray(parsed.actors) || parsed.actors.length === 0) {
    throw new ActivityDiagramGenerationError(
      "extractor_invalid_schema",
      "Activity extractor JSON is missing actors.",
    );
  }

  const steps = Array.isArray(parsed.steps)
    ? parsed.steps.filter(
        (step): step is { actor: string; action: string } =>
          !!step &&
          typeof step === "object" &&
          typeof step.actor === "string" &&
          typeof step.action === "string",
      )
    : [];

  const decisions = Array.isArray(parsed.decisions)
    ? parsed.decisions.filter(
        (
          decision,
        ): decision is { label: string; branches: string[] } =>
          !!decision &&
          typeof decision === "object" &&
          typeof decision.label === "string" &&
          Array.isArray(decision.branches) &&
          decision.branches.every((branch) => typeof branch === "string"),
      )
    : [];

  const merges = Array.isArray(parsed.merges)
    ? parsed.merges.filter(
        (merge): merge is { from: string[]; to: string } =>
          !!merge &&
          typeof merge === "object" &&
          Array.isArray(merge.from) &&
          merge.from.every((item) => typeof item === "string") &&
          typeof merge.to === "string",
      )
    : [];

  return {
    actors: parsed.actors.filter((actor): actor is string => typeof actor === "string"),
    steps,
    decisions,
    merges,
  };
}
