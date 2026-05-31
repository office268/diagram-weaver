## תוכנית סופית — העברת הפרומפטים ל־back (אפשרות A)

### 1. פיצול `src/lib/ai-spec-defaults.ts`
- **חדש** `src/lib/ai-spec-defaults.server.ts` — `DEFAULT_SYSTEM_INSTRUCTION`, `JSON_OUTPUT_INSTRUCTION` (server only, ה־`.server.ts` חוסם bundling לקליינט).
- **קיים, ינוקה** `src/lib/ai-spec-defaults.ts` — יישאר עם **טיפוס בלבד**: `export type SpecModel = string`. בלי `COMPARISON_MODELS`, בלי `OUTPUT_SCHEMA_FIELDS`, בלי הוראות.

### 2. פיצול `src/lib/doc-types.ts`
- **חדש** `src/lib/doc-types.server.ts` — `DOC_TYPE_SYSTEM_INSTRUCTIONS: Record<DocTypeKey, string>` עם ה־`systemInstruction` של כל סוג מסמך.
- **קיים, ינוקה** `src/lib/doc-types.ts` — יוסר השדה `systemInstruction` מ־`DOC_TYPES`. ישארו רק `key, label, description, sectionOrder, sectionTitles` + `ALL_SECTION_KEYS`, `DEFAULT_SECTION_TITLES`, `DOC_TYPE_KEYS`, `getDocType`.

### 3. שינויים בצד השרת
- `src/routes/api/generate-spec.ts`, `review-spec.ts`, `improve-section.ts`:
  - לייבא `DEFAULT_SYSTEM_INSTRUCTION` + `JSON_OUTPUT_INSTRUCTION` מ־`ai-spec-defaults.server`.
  - לייבא `DOC_TYPE_SYSTEM_INSTRUCTIONS` מ־`doc-types.server`.
  - לבחור את שם המודל מתוך קבוע פנימי בצד השרת (לא לקבל מהקליינט).
- `src/lib/ai-settings.functions.ts`:
  - `getAiSettings` יחזיר רק `{ system_instruction: string | null }` (override של המשתמש או null). **לא** להחזיר `default_system_instruction` ו**לא** `is_default`.
  - לייבא `DEFAULT_SYSTEM_INSTRUCTION` רק במקום שבו בונים את ה־prompt בפועל (בקבצי ה־API), לא כאן.

### 4. שינויים בצד הקליינט
- `src/routes/_authenticated/settings.tsx`:
  - להסיר את הקטע "תבנית הפרומפט הנשלח ל־LLM" (preview של System / User / Output schema / רשימת מודלים).
  - להסיר ייבואים של `COMPARISON_MODELS`, `OUTPUT_SCHEMA_FIELDS`.
  - באזור "הוראות מערכת ל־AI": Textarea שמראה את ה־override של המשתמש בלבד (ריק אם אין). כפתור "שמור". כפתור "שחזר לברירת מחדל" שמוחק את ה־override (קורא ל־`resetAiSettings`). להסיר את ה־`details` שמציג את ה־default.
- `src/routes/_authenticated/projects.$projectId.tsx`:
  - להסיר את הייבוא של `COMPARISON_MODELS` / `SpecModel` כערך. במקום `model: SpecModel` להשתמש ב־`model?: string` (יוחזר מהשרת, לא נבחר בקליינט). לוודא שאין UI שמציג שם מודל.
- `src/routes/_authenticated/editor.$id.tsx`:
  - להסיר את הייבוא של `COMPARISON_MODELS`. השורה `const model = ... ?? COMPARISON_MODELS[0]` תהפוך ל־`const model = spec.model ?? ""` (רק אם הוא בכלל בשימוש להצגה — אחרת להסיר).
- `src/components/doc-type-sections-card.tsx`:
  - להסיר כל הצגה של `systemInstruction` אם קיימת. שאר הפונקציונליות (label/description/סעיפים) נשמרת.

### 5. אימות
- לבדוק שאין שגיאות import/build.
- להריץ: `rg "DEFAULT_SYSTEM_INSTRUCTION|JSON_OUTPUT_INSTRUCTION|COMPARISON_MODELS|OUTPUT_SCHEMA_FIELDS" src/components src/routes/_authenticated src/routes/index.tsx src/routes/login.tsx src/routes/__root.tsx` — לא צריך להחזיר תוצאות.
- להריץ: `rg "systemInstruction" src/components src/routes/_authenticated` — לא צריך להחזיר תוצאות.
- לוודא ידנית ש־flow של יצירת מסמך + ביקורת + improve-section עדיין עובד.

### תוצאה
לאחר השינוי, ה־bundle שמגיע לדפדפן לא מכיל אף שורת prompt, אף סכמת JSON ואף שם מודל. המשתמש עדיין יכול לערוך system instruction אישי, אבל ברירת המחדל (וההוראות הספציפיות לכל סוג מסמך) חיות רק בשרת.