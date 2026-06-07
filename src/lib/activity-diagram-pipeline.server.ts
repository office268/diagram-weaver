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

export const STAGE2_SYSTEM =
  `אתה מומחה Mermaid. קיבלת JSON המתאר תהליך ותיאור מקורי. המר אותו לתרשים Mermaid swimlane.` +
  `\n\nכללים מחייבים:` +
  `\n1. flowchart RL` +
  `\n2. כל actor = subgraph נפרד עם direction TB` +
  `\n3. Actor ראשון ב-actors = subgraph ראשון בקוד (יופיע מימין)` +
  `\n4. כל decision = diamond אחד {{label?}} עם כל הענפים — לא שני diamonds עוקבים` +
  `\n5. כל merge = node MERGE מפורש שאליו מגיעים כל הנתיבים לפני DONE` +
  `\n6. S(["👤"]) = נקודת התחלה, DONE(("סיום")) = סיום — שני זוגות סוגריים חובה` +
  `\n7. לולאה = חץ ישיר בין-subgraph ללא node ביניים: F --> A` +
  `\n8. אל תוסיף פעולות שלא מוזכרות` +
  `\n9. כל subgraph חייב מזהה ASCII + תווית בעברית בסוגריים מרובעים:` +
  `\n   ✓ subgraph LANE1["עובד"]` +
  `\n   ❌ subgraph "עובד"  ← שובר את הפרסר` +
  `\n10. style מתייחס תמיד למזהה ASCII של ה-subgraph, לא לטקסט מצוטט:` +
  `\n    ✓ style LANE1 fill:#ffffff,stroke:#4444dd,stroke-dasharray:5 5` +
  `\n    ❌ style "עובד" fill:...  ← שובר את הפרסר` +
  `\n11. מזהי nodes: ASCII בלבד, תוויות עברית ב-["..."]` +
  `\n\nשגיאות נפוצות:` +
  `\n❌ DONE(["סיום"]) → ✓ DONE(("סיום"))` +
  `\n❌ שני diamonds עוקבים → ✓ diamond אחד עם כל הענפים` +
  `\n❌ {{{label}}} → ✓ {{label}} (זוג סוגריים אחד בלבד)` +
  `\n\nהחזר אך ורק קוד Mermaid בתוך \`\`\`mermaid ... \`\`\`.`;

export type ActivityDiagramErrorCode =
  | "extractor_truncated"
  | "extractor_invalid_json"
  | "extractor_invalid_schema"
  | "builder_invalid_mermaid";

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

export function postProcessActivityMermaid(code: string): string {
  // Step 1: assign ASCII IDs to any `subgraph "label"` (without an id) and
  // remap matching `style "label" ...` lines to the same id. Mermaid's
  // `style` command requires a node/subgraph identifier — a quoted label
  // breaks the parser ("got 'STR'").
  const quotedSubgraphIds = new Map<string, string>();
  let laneCounter = 0;
  const idAssigned = code.replace(
    /^(\s*)subgraph\s+"([^"]+)"\s*$/gm,
    (_m, indent: string, label: string) => {
      let id = quotedSubgraphIds.get(label);
      if (!id) {
        laneCounter += 1;
        id = `LANE${laneCounter}`;
        quotedSubgraphIds.set(label, id);
      }
      return `${indent}subgraph ${id}["${label}"]`;
    },
  );
  const styleRemapped = idAssigned.replace(
    /^(\s*)style\s+"([^"]+)"(\s+)/gm,
    (m, indent: string, label: string, sp: string) => {
      const id = quotedSubgraphIds.get(label);
      return id ? `${indent}style ${id}${sp}` : m;
    },
  );

  // Step 2: line-by-line transforms (skip init directive lines).
  const lines = styleRemapped.split("\n").map((line) => {
    if (line.trimStart().startsWith("%%")) return line;
    let out = line.replace(/DONE\(\["([^"]+)"\]\)/g, 'DONE(("$1"))');
    // Repair triple-braced diamonds {{{label}}} → {{label}}
    out = out.replace(/\{\{\{([^{}]+)\}\}\}/g, "{{$1}}");
    // Promote single-brace decision diamonds `{label}` to `{{label}}`, but
    // skip cases that are already `{{...}}` (lookbehind/lookahead on `{`/`}`)
    // and skip JSON-like content starting with `"`.
    out = out.replace(
      /(?<!\{)\{([^{}"][^{}]*)\}(?!\})/g,
      "{{$1}}",
    );
    return out;
  });
  const transformed = lines.join("\n");
  const elkDirective = '%%{init: {"flowchart": {"defaultRenderer": "elk"}} }%%';
  return transformed.trimStart().startsWith("%%")
    ? transformed
    : `${elkDirective}\n${transformed}`;
}


export function validateActivityDiagram(code: string): string[] {
  const violations: string[] = [];
  if (!/^flowchart\s+RL\b/m.test(code))
    violations.push("חסר `flowchart RL` — חובה להתחיל בשורה `flowchart RL`");
  const subgraphs = (code.match(/^\s*subgraph\b/gm) ?? []).length;
  const dirTB = (code.match(/^\s*direction\s+TB\b/gm) ?? []).length;
  if (subgraphs > 0 && dirTB < subgraphs)
    violations.push(`חסר \`direction TB\` ב-${subgraphs - dirTB} subgraph(s) — כל subgraph חייב לכלול \`direction TB\` בתחילתו`);
  if (/\bDONE\s*\(\s*\[/.test(code))
    violations.push('node הסיום כתוב כ-`DONE(["סיום"])` במקום `DONE(("סיום"))` — נדרשים שני זוגות סוגריים לעיגול');
  const diamonds = (code.match(/\{\{[^}]+\}\}/g) ?? []).length;
  if (diamonds > 2)
    violations.push(`נמצאו ${diamonds} diamonds — כשיש נקודת החלטה אחת, השתמש ב-diamond יחיד עם כל הענפים במקום ${diamonds} diamonds עוקבים`);
  if (/^\s*subgraph\s+"/m.test(code))
    violations.push('subgraph עם תווית מצוטטת ללא מזהה ASCII — חובה `subgraph LANE1["שם"]` ולא `subgraph "שם"`');
  if (/^\s*style\s+"/m.test(code))
    violations.push('פקודת `style` עם שם מצוטט — חובה להפנות למזהה ASCII של ה-subgraph, לדוגמה `style LANE1 fill:...`');
  if (/\{\{\{/.test(code))
    violations.push('נמצא diamond כפול-מסגרת `{{{...}}}` — חובה זוג סוגריים אחד בלבד `{{...}}`');
  return violations;
}

export interface DiagramReviewResult {
  ok: boolean;
  violations?: string[];
  fixedCode?: string;
}

const REVIEW_SYSTEM =
  `אתה מבקר תרשימי Mermaid swimlane. קיבלת תרשים Mermaid ותיאור התהליך המקורי.` +
  `\n\nבדוק את התרשים מול הכללים הבאים:` +
  `\n1. flowchart RL בשורה הראשונה` +
  `\n2. כל subgraph חייב לכלול direction TB` +
  `\n3. DONE(("סיום")) — חייב שני זוגות סוגריים. DONE(["סיום"]) שגוי` +
  `\n4. כל נקודת החלטה = diamond אחד עם כל הענפים — לא שני diamonds עוקבים` +
  `\n5. לולאה חוזרת = חץ ישיר בין-subgraph ללא node ביניים` +
  `\n6. אין nodes לפעולות שלא הוזכרו בתיאור המקורי` +
  `\n7. כל actor מהתיאור מוצג כ-subgraph, ה-actors מהתיאור מיוצגים נכון` +
  `\n\nהחזר JSON בלבד ללא markdown:` +
  `\n- אם הכול תקין: {"ok":true}` +
  `\n- אם יש הפרות: {"ok":false,"violations":["תיאור הפרה 1","תיאור הפרה 2"],"fixedCode":"\`\`\`mermaid\\n...\\n\`\`\`"}` +
  `\n\nחשוב: בשדה fixedCode החזר את קוד ה-Mermaid המלא המתוקן בתוך גדר \`\`\`mermaid. אם אין הפרות, אל תכלול fixedCode.`;

export async function reviewActivityDiagram(
  model: Parameters<typeof generateText>[0]["model"],
  mermaidCode: string,
  originalPrompt: string,
): Promise<DiagramReviewResult> {
  try {
    const userMessage =
      `תיאור התהליך המקורי:\n${originalPrompt}\n\n` +
      `קוד Mermaid שנוצר:\n\`\`\`mermaid\n${mermaidCode}\n\`\`\`\n\n` +
      `בדוק את התרשים והחזר JSON לפי הפורמט המבוקש.`;

    const { text } = await generateText({
      model,
      system: REVIEW_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
      temperature: 0,
    });

    const clean = text.replace(/```json[^\n]*\n?/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(clean) as Partial<DiagramReviewResult>;
    if (typeof parsed.ok !== "boolean") return { ok: true };
    return {
      ok: parsed.ok,
      violations: Array.isArray(parsed.violations) ? parsed.violations : undefined,
      fixedCode: typeof parsed.fixedCode === "string" ? parsed.fixedCode : undefined,
    };
  } catch {
    return { ok: true };
  }
}

export async function runTwoStagePipeline(
  model: Parameters<typeof generateText>[0]["model"],
  userPrompt: string,
): Promise<string | null> {
  // Stage 1: extract structured process map from natural language
  let processMap: ProcessMap;
  try {
    const { text } = await generateText({
      model,
      system: STAGE1_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0,
    });
    processMap = parseProcessMapResponse(text);
  } catch {
    return null;
  }

  // Stage 2: generate Mermaid from structured JSON + original description
  const userMessage =
    `תיאור התהליך המקורי: ${userPrompt}\n\n` +
    `מבנה מובנה של התהליך:\n` +
    "```json\n" +
    JSON.stringify(processMap, null, 2) +
    "\n```\n\n" +
    `צור תרשים Mermaid swimlane לפי המבנה.`;

  const { text: mermaidText } = await generateText({
    model,
    system: STAGE2_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
    temperature: 0.1,
  });

  return mermaidText;
}
