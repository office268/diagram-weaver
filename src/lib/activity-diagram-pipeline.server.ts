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

export function postProcessActivityMermaid(code: string): string {
  // Apply transforms line-by-line so the init directive line (starts with %%)
  // is never touched by the decision-diamond regex (which would otherwise
  // mangle `%%{init: {...}}%%` into `%%{{"flowchart...}}%%`).
  const lines = code.split("\n").map((line) => {
    if (line.trimStart().startsWith("%%")) return line;
    let out = line.replace(/DONE\(\["([^"]+)"\]\)/g, 'DONE(("$1"))');
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
    const clean = text.replace(/```json[^\n]*\n?/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(clean) as Partial<ProcessMap>;
    if (!Array.isArray(parsed.actors) || parsed.actors.length === 0) throw new Error("invalid");
    processMap = {
      actors: parsed.actors,
      steps: parsed.steps ?? [],
      decisions: parsed.decisions ?? [],
      merges: parsed.merges ?? [],
    };
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
