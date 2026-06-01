import type { AgentContext } from "@/agents/shared/types";
import {
  buildRagBlock,
  buildRevisionBlock,
  buildThinkingInstruction,
  buildSelfCritiqueInstruction,
  JSON_ONLY_INSTRUCTION,
} from "@/agents/shared/prompt-helpers";

const THINKING = buildThinkingInstruction([
  "מה הבעיה המרכזית שהמשתמש רוצה לפתור?",
  "מי הם המשתמשים ומה הם צריכים?",
  "מה גבולות המערכת — מה כן ומה לא?",
  "אילו NFRs ברורים מההקשר (אבטחה, ביצועים, נגישות)?",
]);

const SELF_CRITIQUE = buildSelfCritiqueInstruction([
  "כל FR: האם יש לו כותרת + תיאור? האם ניתן לבדוק אותו?",
  "כל NFR: האם מכסה ביצועים, אבטחה, זמינות, נגישות?",
  "יש לפחות 5 דרישות פונקציונליות ו-3 לא-פונקציונליות?",
  "כל דרישה מעוגנת בפרומפט — לא הומצאה?",
]);

const POSITIVE_EXAMPLE = `
דוגמה טובה לדרישה פונקציונלית:
{ "id": "req-1", "title": "ניהול משתמשים", "description": "המערכת תאפשר למנהל להוסיף, לערוך ולמחוק משתמשים. שינויים ייכנסו לתוקף מיידית ויתועדו ביומן ביקורת." }

דוגמה טובה לדרישה לא-פונקציונלית:
{ "id": "nfr-1", "title": "זמן תגובה", "description": "95% מהבקשות ייענו תוך פחות מ-2 שניות תחת עומס של עד 500 משתמשים מקביליים." }
`.trim();

const NEGATIVE_EXAMPLE = `
דוגמה גרועה — לא לחקות:
{ "id": "req-X", "title": "מהיר", "description": "המערכת תהיה מהירה ונוחה." }  ← לא מדיד, לא ניתן לבדוק
`.trim();

const OUTPUT_SCHEMA = `
סכמת JSON לפלט:
{
  "goals": [{ "id": string, "text": string }],
  "functional_requirements": [{ "id": string, "title": string, "description": string }],
  "non_functional_requirements": [{ "id": string, "title": string, "description": string }],
  "assumptions": [{ "id": string, "text": string }],
  "risks": [{ "id": string, "text": string }]
}
מינימומים: goals >= 3, functional_requirements >= 5, non_functional_requirements >= 3, assumptions >= 3, risks >= 3.
`.trim();

export function buildRequirementsPrompt(ctx: AgentContext): string {
  const parts: string[] = [];

  if (ctx.knowledgeBlock) parts.push(ctx.knowledgeBlock);
  if (ctx.ragContext) parts.push(buildRagBlock(ctx.ragContext));

  parts.push(THINKING);
  parts.push(POSITIVE_EXAMPLE + "\n\n" + NEGATIVE_EXAMPLE);

  if (ctx.isRevision && ctx.reviewNotes?.length) {
    parts.push(buildRevisionBlock(ctx.reviewNotes));
  }

  parts.push("## בקשת המשתמש\n" + ctx.userPrompt);
  parts.push(OUTPUT_SCHEMA);
  parts.push(JSON_ONLY_INSTRUCTION);
  parts.push(SELF_CRITIQUE);

  return parts.join("\n\n");
}
