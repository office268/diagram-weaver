# הוראות AI אמיתיות לפי סוג מסמך

## הבעיה

`DEFAULT_SYSTEM_INSTRUCTION` ב-`src/lib/ai-spec-defaults.server.ts` מנוסחת תמיד כ"מסמך אפיון על" — דורשת personas, תרחישי שימוש, תרשים ארכיטקטורה ו-erDiagram כחובה. היא משולבת לכל סוג (BRD, TRD, ייזום, אפיון על, אפיון מפורט) דרך `getDefaultFullInstruction`, וההוראות הספציפיות ב-`doc-types.server.ts` הן רק תוספת קצרה שלא מבטלת את הבסיס. התוצאה: BRD מקבל בקשה לתרשים ER, ייזום מקבל בקשה ל-personas טכניים וכו'.

ה-JSON output schema לעומת זאת כן משותף וכל השדות מקבלים defaults ריקים, כך שאפשר להשאיר חלקים ריקים כשלא רלוונטיים — אבל ההוראה הנוכחית מכריחה למלא הכל.

## מה משתנה

לכל סוג מסמך תהיה **הוראת מערכת מלאה, עצמאית ומותאמת** — לא מבוססת על בסיס משותף. ההוראה תכלול:

1. הגדרת זהות וסוג המסמך המדויק (לא "אפיון על" עבור BRD).
2. רשימת הסעיפים שחובה למלא — תואמת ל-`sectionOrder` של אותו סוג ב-`doc-types.ts`.
3. רשימת הסעיפים שיש להשאיר ריקים (מערכים ריקים / מחרוזות ריקות) ב-JSON.
4. הנחיות איכות ספציפיות לסוג: מה הטון, מה העומק, איזה תרשימי Mermaid נדרשים (אם בכלל), ומה מספר הפריטים המינימלי בכל רשימה.
5. הסכמת JSON המשותפת (נשארת זהה — היא רק מבנה, השדות הלא־רלוונטיים יישארו ריקים).

## פירוט לפי סוג

- **business_requirements (BRD)**: רקע עסקי, KPIs, בעלי עניין (personas), דרישות עסקיות (functional_requirements כדרישות עסקיות, לא מערכת), הנחות, סיכונים עסקיים. השאר ריק: `non_functional_requirements`, `use_cases`, `architecture` (description+diagram=""), `data_model` (description+diagram=""). אסור תרשימי Mermaid. ≥4 KPIs, ≥3 בעלי עניין, ≥5 דרישות עסקיות, ≥3 סיכונים.

- **technical_requirements (TRD)**: תיאור טכני, דרישות מערכת פונקציונליות מפורטות, NFRs (ביצועים/אבטחה/זמינות/סקלביליות/נגישות), ארכיטקטורה (description+`graph TD/flowchart TD` חובה), מודל נתונים (description+`erDiagram` חובה), אילוצים והנחות, סיכונים טכניים. השאר ריק: `goals` (אופציונלי), `personas`, `use_cases`. ≥8 FRs, ≥5 NFRs, ≥3 סיכונים.

- **initiation**: רקע ומטרת הפרויקט, יעדים והיקף ואבני דרך (goals), בעלי עניין וצוות (personas), תקציב/לו"ז/הנחות (assumptions), סיכוני פרויקט. השאר ריק: `functional_requirements`, `non_functional_requirements`, `use_cases`, `architecture`, `data_model`. אסור תרשימי Mermaid. ≥4 יעדים/אבני דרך, ≥3 בעלי עניין, ≥4 הנחות, ≥3 סיכונים.

- **spec_overview (HLD)**: כל הסעיפים ברמה גבוהה — סקירה, מטרות, פרסונות, FRs, NFRs, הנחות, ≥2 תרחישי שימוש עם sequenceDiagram, ארכיטקטורה עם flowchart, מודל נתונים עם erDiagram, סיכונים. (≈ ההוראה הקיימת היום, אבל כעצמאית.)

- **spec_detailed (LLD)**: כמו HLD אבל בעומק — ≥10 FRs מפורטים, ≥4 use cases מלאים עם sequenceDiagram, ארכיטקטורה מפורטת עם רכיבי משנה, erDiagram עם שדות עיקריים בכל ישות. תיאורים ארוכים וקונקרטיים.

הכללים הטכניים של Mermaid (מזהי צמתים ASCII, ללא ```` ``` ```` סביב הקוד) נכללים רק בהוראות של הסוגים שדורשים תרשימים.

## שינויי קוד

### `src/lib/doc-types.server.ts`
מחליפים את `DOC_TYPE_SYSTEM_INSTRUCTIONS` — כל ערך הופך להוראת מערכת **מלאה ועצמאית** (לא תוספת). הפונקציה `getDocTypeSystemInstruction` נשארת ומחזירה את ההוראה המלאה לפי המפתח.

### `src/lib/ai-spec-defaults.server.ts`
- `DEFAULT_SYSTEM_INSTRUCTION` — מוסר מהשימוש בזרימת היצירה. נשאיר אותו (או נסיר) אבל הוא כבר לא ישולב עם הוראת הסוג.
- `JSON_OUTPUT_INSTRUCTION` נשאר כפי שהוא (תיאור הסכמה המשותפת), והוא ימשיך להיות מצורף בקצה. תוספת קטנה: "סעיפים שלא נדרשים לסוג המסמך הזה — החזר מערך ריק או מחרוזת ריקה לפי הטיפוס".

### `src/lib/doc-type-instructions.server.ts`
- `getDefaultFullInstruction(docType)` יחזיר **רק** את `getDocTypeSystemInstruction(docType)` — בלי `DEFAULT_SYSTEM_INSTRUCTION`.
- `resolveSystemInstruction` נשאר כפי שהוא: override מה-DB אם קיים, אחרת ה-default המלא לפי הסוג.

### תאימות לאחור
טבלת `doc_type_instructions` ריקה כרגע, אז אין צורך ב-migration. אדמינים שכבר שמרו override יקבלו את הטקסט שלהם כפי שהוא; ה-Reset יחזיר את ההוראה החדשה והנכונה לפי הסוג. כפתור "שחזר לברירת מחדל" ב-UI ימשיך לעבוד.

### לא משתנה
- `src/routes/api/generate-spec.ts` — כבר קורא ל-`resolveSystemInstruction` ומוסיף `JSON_OUTPUT_INSTRUCTION`. לא נוגעים.
- `src/components/doc-type-instructions-card.tsx` — ה-UI כבר טוען את ההוראה הנוכחית מ-`getDefaultFullInstruction`, אז אחרי השינוי הוא יציג אוטומטית את ההוראה החדשה לכל סוג. לא נוגעים.
- ה-JSON schema (`SpecOutputSchema` / `SpecContentSchema`) — לא נוגעים. כל ה-defaults הריקים כבר נתמכים.

## קבצים שיעודכנו

- `src/lib/doc-types.server.ts` — שכתוב מלא של `DOC_TYPE_SYSTEM_INSTRUCTIONS` (5 הוראות מלאות).
- `src/lib/doc-type-instructions.server.ts` — הסרת השרשור עם `DEFAULT_SYSTEM_INSTRUCTION`.
- `src/lib/ai-spec-defaults.server.ts` — תוספת משפט ל-`JSON_OUTPUT_INSTRUCTION` על השארת שדות לא־רלוונטיים ריקים.
