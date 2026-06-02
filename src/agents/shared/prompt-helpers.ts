// Shared prompt building blocks injected into every agent

export const HEBREW_WRITING_RULES = `
## כללי כתיבה בעברית
- כתוב עברית טכנית תקנית — לא תרגום מאנגלית
- משפטים קצרים וברורים (עד 25 מילה)
- הימנע מסגנון "יירד לפרטים" — כתוב מה המערכת עושה, לא איך היא מרגישה
- שמות מקצועיים (API, UI, DB) — השאר באנגלית
- מספרים: כתב ספרות (3, לא שלוש)
`.trim();

export const SPEC_QUALITY_CRITERIA = `
## קריטריוני איכות למפרט טוב
- כל דרישה פונקציונלית: בעלת כותרת + תיאור, ניתנת למדידה ולבדיקה
- דרישות לא-פונקציונליות: מכסות ביצועים, אבטחה, זמינות, נגישות
- תרחישי שימוש: כל תרחיש מתאר מי עושה מה ומה קורה
- כל פריט ברשימה: id ייחודי קצר (req-1, uc-1, p-1...)
- אין סתירות בין סעיפים
- כל דרישה מעוגנת בפרומפט המשתמש או בחומרים שסופקו
`.trim();

export const MERMAID_RULES = `
## חוקי Mermaid — חובה לציית
- מזהי צמתים (node IDs): ASCII קצר בלבד — A, B, USER, ORDER, DB (ללא עברית ב-ID)
- תוויות צמתים: מותר עברית בסוגריים מרובעים: A[לקוח]
- ציטוט עברית בקשת: השתמש בגרשיים כפולים: A["מסך הזמנה"]
- לא לעטוף ב-\`\`\` — רק קוד נקי
- flowchart TD / graph TD לארכיטקטורה
- erDiagram למודל נתונים
- sequenceDiagram לתרחישי שימוש
- לא לכלול שבירות שורה בתוך label
`.trim();

export const JSON_ONLY_INSTRUCTION = `
פורמט הפלט — חובה:
החזר אך ורק אובייקט JSON תקני אחד, ללא טקסט נוסף, ללא הסברים, וללא עטיפה ב-\`\`\`json\`\`\`.
`.trim();

export function buildRagBlock(ragContext: string): string {
  if (!ragContext.trim()) return "";
  return `## חומרים שהמשתמש העלה (מידע רלוונטי)\n${ragContext}\n\n---\n\n`;
}

export function buildRevisionBlock(reviewNotes: string[]): string {
  if (!reviewNotes.length) return "";
  const lines = reviewNotes.map((n, i) => `${i + 1}. ${n}`).join("\n");
  return `## הערות שיפור לתיקון\n${lines}\n\n`;
}

export function buildThinkingInstruction(questions: string[]): string {
  const qs = questions.map((q) => `- ${q}`).join("\n");
  return `לפני שתכתוב, חשוב בשקט ועבור על השאלות הבאות:\n${qs}\n\n`;
}

export function buildSelfCritiqueInstruction(checks: string[]): string {
  const cs = checks.map((c) => `- ${c}`).join("\n");
  return `לאחר שסיימת לכתוב, בדוק את התוצאה שלך:\n${cs}\nאם מצאת בעיה — תקן לפני שתחזיר.`;
}
