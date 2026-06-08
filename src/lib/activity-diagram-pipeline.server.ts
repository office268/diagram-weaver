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

// ── HTML/SVG pipeline (replaces Mermaid Stage 2) ─────────────────────────────

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

export async function reviewActivitySvg(
  model: Parameters<typeof generateText>[0]["model"],
  svgCode: string,
  originalPrompt: string,
): Promise<DiagramReviewResult> {
  try {
    const userMessage =
      `תיאור התהליך המקורי:\n${originalPrompt}\n\n` +
      `קוד SVG שנוצר:\n${svgCode.slice(0, 6000)}\n\n` +
      `בדוק את התרשים והחזר JSON לפי הפורמט המבוקש.`;

    const { text } = await generateText({
      model,
      system: SVG_REVIEW_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
      temperature: 0,
    });

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

export function normalizeActivityMermaidForValidation(code: string): string {
  return postProcessActivityMermaid(code)
    .replace(/\{\{\{([^{}]+)\}\}\}/g, "{{$1}}")
    .trim();
}

export function getActivityMermaidValidationError(code: string): string | null {
  const normalized = normalizeActivityMermaidForValidation(code);
  const violations = validateActivityDiagram(normalized);
  if (violations.length > 0) return violations[0];

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const subgraphStarts = lines.filter((line) => /^subgraph\b/.test(line)).length;
  const subgraphEnds = lines.filter((line) => line === "end").length;
  if (subgraphStarts !== subgraphEnds) {
    return "מספר פקודות subgraph/end אינו מאוזן.";
  }

  if (lines.some((line) => /fill:[^,\s]+,[a-z]/i.test(line))) {
    return "נמצאה פקודת style פגומה עם פסיק/טקסט צמודים.";
  }

  return null;
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
