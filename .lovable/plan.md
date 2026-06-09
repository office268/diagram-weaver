
# איחוד מסמך דרישות (עסקי + טכני) למסמך אחד

כיום הקובייה "מסמך דרישות (עסקי + טכני)" יוצרת שני threads/מסמכים נפרדים (BRD + TRD). המטרה: ליצור מסמך אחד מאוחד שמכיל את שני החלקים.

## גישה
מוסיפים סוג מסמך חדש `requirements_combined` בצד הסוגים הקיימים. סוגי ה-BRD וה-TRD הנפרדים יישארו זמינים תחת "עוד" (לא נמחקים — שמירה על תאימות לאחור ולמשתמשים שרוצים מסמך נפרד).

## שינויים

### 1. `src/lib/doc-types.ts`
- הוספת `"requirements_combined"` ל-`DOC_TYPE_KEYS`.
- הוספת רשומה ל-`DOC_TYPES` עם label `"מסמך דרישות (עסקי + טכני)"` ו-`sectionOrder` שמכיל את כל סקציות ה-BRD + ה-TRD (overview, goals, personas, functional_requirements, non_functional_requirements, assumptions, architecture, data_model, risks, user_notes) עם `sectionTitles` מותאמים.
- הוספת אייקון ל-`DOC_TYPE_VISUALS` (Briefcase, amber) — תואם לקובייה הקיימת.

### 2. `src/lib/doc-types.server.ts` (איכות התוצר — לא מוריד מאומה)
הוספת `DOC_TYPE_SYSTEM_INSTRUCTIONS.requirements_combined` — system prompt חדש שמורכב מאיחוד מלא של דרישות ה-BRD וה-TRD הקיימות, ללא הורדת מינימומים:
- title, overview משולב (רקע עסקי + תיאור טכני).
- goals: מטרות עסקיות + KPIs (לפחות 4, כמו ב-BRD).
- personas: בעלי עניין **וגם** משתמשי קצה (לפחות 4 סה"כ; שילוב של דרישות BRD ו-spec).
- functional_requirements: דרישות עסקיות **ופונקציונליות מערכת** במאוחד (לפחות 10 סה"כ — סכום מינימומי BRD+TRD), כל פריט מסומן אם הוא Business/System בתוך ה-description.
- non_functional_requirements: NFRs מלאים כמו ב-TRD (לפחות 5: ביצועים, אבטחה, זמינות, סקלביליות, נגישות).
- architecture: description + diagram (graph TD/flowchart TD) — חובה, כמו ב-TRD.
- data_model: description + diagram (erDiagram) — חובה, כמו ב-TRD.
- assumptions: עסקיות וטכניות במאוחד — לפחות 4.
- risks: סיכונים עסקיים **וגם** טכניים — לפחות 4.
- use_cases: [] (כמו ב-BRD/TRD המקוריים — תרחישים שמורים למסמכי אפיון).
- שמירה על `MERMAID_RULES` ו-`ID_RULE`.

### 3. `src/lib/doc-templates.ts`
הוספת `requirements_combined: [...]` עם 3 תבניות (למשל "אפליקציית B2C", "פלטפורמת SaaS B2B", "מערכת פנים-ארגונית") שמשלבות צד עסקי + טכני.

### 4. `src/routes/_authenticated/editor.$id.tsx`
הוספת `requirements_combined: "Business + Technical Requirements Document"` ל-`TYPE_LABELS`.

### 5. `src/routes/_authenticated/dashboard.tsx`
- מחיקת `combinedMut` (לוגיקת היצירה הכפולה).
- ב-`activateTile`: הסרת ה-branch של `requirements_combined` — תיפול לזרימה הרגילה של `createMut.mutate(key)` שתיצור thread יחיד מסוג `requirements_combined`.
- ניקוי כל ההתייחסויות ל-`combinedMut.isPending` ב-`pending`/`isPending` של ה-tiles.

### 6. `src/lib/output-types.ts`
- אין שינוי במיקום הקובייה (`requirements_combined` כבר ב-`OUTPUT_TYPE_ORDER`).
- אופציונלי: לעדכן את ה-`description` הריק של `requirements_combined` למשהו קצר ("מטרות עסקיות, KPIs, NFRs, ארכיטקטורה ומודל נתונים — במסמך אחד").

## אין שינויים בסכמה/DB
מבנה ה-spec output קיים תומך בכל הסקציות — לא נדרשת מיגרציה.

## בדיקות אחרי implementation
- לחיצה על הקובייה → נוצר thread יחיד מסוג `requirements_combined`.
- שליחת prompt → מסמך אחד עם כל הסקציות (עסקי + טכני + ארכיטקטורה + ERD).
- בעורך מופיעות כל הסקציות עם הכותרות המאוחדות.
