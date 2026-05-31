// Server-only per-doc-type system instructions.
// The `.server.ts` suffix blocks this file from the client bundle.

import type { DocTypeKey } from "./doc-types";

export const DOC_TYPE_SYSTEM_INSTRUCTIONS: Record<DocTypeKey, string> = {
  business_requirements: [
    "סוג המסמך: מסמך דרישות עסקי (BRD).",
    "התמקד בצד העסקי: רקע, צורך עסקי, מטרות מדידות (KPIs), בעלי עניין, תועלות צפויות.",
    "אל תכלול ארכיטקטורה טכנית, מודל נתונים או תרשימי מערכת.",
    "ה-personas מתארות בעלי עניין (Stakeholders).",
    "ה-functional_requirements מתארות דרישות עסקיות גבוהות, לא דרישות מערכת.",
  ].join("\n"),
  technical_requirements: [
    "סוג המסמך: מסמך דרישות טכני (TRD).",
    "התמקד בצד הטכני: דרישות מערכת מפורטות, אינטגרציות, חוזי APIs, מודל נתונים, ארכיטקטורה ואילוצי תשתית.",
    "הקפד על NFRs: ביצועים, אבטחה, זמינות, סקלביליות, נגישות.",
    "תרשים ארכיטקטורה ותרשים ER הם חובה.",
  ].join("\n"),
  initiation: [
    "סוג המסמך: מסמך ייזום פרויקט.",
    "המסמך הוא ברמת ניהול פרויקט: מטרה, היקף (Scope/Out of Scope), אבני דרך, בעלי עניין, תקציב גס, לוחות זמנים וסיכונים.",
    "אל תכנס לפירוט טכני, ארכיטקטורה או מודל נתונים.",
  ].join("\n"),
  spec_overview: [
    "סוג המסמך: מסמך אפיון על (High Level Design).",
    "כסה את כל הסעיפים ברמה גבוהה אך מקיפה: סקירה, מטרות, פרסונות, דרישות, תרחישים, ארכיטקטורה ומודל נתונים.",
  ].join("\n"),
  spec_detailed: [
    "סוג המסמך: מסמך אפיון מפורט (Low Level Design).",
    "פרט לעומק כל סעיף: דרישות פונקציונליות מפורטות (לפחות 10), לפחות 4 תרחישי שימוש מלאים עם sequence diagrams, ארכיטקטורה מפורטת ומודל נתונים שכולל שדות עיקריים בכל ישות.",
    "השתמש בתיאורים ארוכים וקונקרטיים — לא נקודות כלליות.",
  ].join("\n"),
};

export function getDocTypeSystemInstruction(key: string | null | undefined): string {
  if (key && key in DOC_TYPE_SYSTEM_INSTRUCTIONS) {
    return DOC_TYPE_SYSTEM_INSTRUCTIONS[key as DocTypeKey];
  }
  return DOC_TYPE_SYSTEM_INSTRUCTIONS.spec_overview;
}
