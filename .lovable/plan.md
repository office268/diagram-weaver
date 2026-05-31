# System Instruction לפי סוג מסמך

## מה משתנה

היום יש System Instruction אחד גלובלי ב-`ai_settings` (פר-משתמש) + תוספת קשיחה לכל סוג מסמך בקוד (`doc-types.server.ts`) שלא ניתן לערוך.

החדש: לכל סוג מסמך (BRD, TRD, ייזום, אפיון על, אפיון מפורט) יש **הוראה מלאה ונפרדת** הניתנת לעריכה דרך ה-UI ע"י אדמין בלבד, גלובלית לכל המשתמשים.

## DB

טבלה חדשה `doc_type_instructions`:
- `doc_type` text PK (אחד מ-`DOC_TYPE_KEYS`)
- `system_instruction` text
- `updated_at`, `updated_by`

RLS:
- SELECT: `authenticated` (כל משתמש מחובר — נחוץ לקריאה ע"י השרת בשם המשתמש; הקריאה בפועל ב-API נעשית עם `supabaseAdmin`, אבל ה-grant נדרש אם נקרא בעתיד מהקליינט)
- INSERT/UPDATE/DELETE: רק `has_role(auth.uid(), 'admin')`
- GRANTs בהתאם

Seed: insert ראשוני עם הטקסטים הקיימים מ-`doc-types.server.ts` + `DEFAULT_SYSTEM_INSTRUCTION` משולבים, כך שאין רגרסיה ביום הראשון.

## Server

`src/lib/doc-type-instructions.functions.ts` חדש:
- `listDocTypeInstructions()` — אדמין בלבד, מחזיר את כל הסוגים + defaults
- `updateDocTypeInstruction({ doc_type, system_instruction })` — אדמין בלבד
- `resetDocTypeInstruction({ doc_type })` — אדמין בלבד (מוחק מה-DB, יחזור ל-default מהקוד)

`src/routes/api/generate-spec.ts`:
- במקום `baseSystem` מ-`ai_settings` + `getDocTypeSystemInstruction`, נקרא קודם מ-`doc_type_instructions` לפי `body.docType`.
- אם קיים שם — זו ההוראה היחידה שתישלח (מלאה ועצמאית).
- אם לא — fallback ל-`DEFAULT_SYSTEM_INSTRUCTION + getDocTypeSystemInstruction(...)` כמו היום.
- (גם `review-spec.ts` ו-`improve-section.ts` ייהנו מאותו fallback אם רלוונטי — נבדוק ונחיל באותה צורה.)

`ai_settings` של המשתמש נשאר קיים אבל לא בשימוש לזרימת היצירה החדשה. הסעיף ב-UI יוסר כדי לא לבלבל (ראה למטה).

## UI — `src/routes/_authenticated/settings.tsx`

סעיף חדש "הוראות מערכת לפי סוג מסמך" (אדמין בלבד, באותו `isAdmin` כמו שאר סעיפי האדמין):
- Tabs/Accordion עם 5 סוגי המסמכים.
- כל טאב: `Textarea` גדול + "שמור" + "שחזר לברירת מחדל".
- תווית המציינת אם ההוראה כרגע = ברירת מחדל מהקוד או override מה-DB.

הסעיף הקיים "הוראות מערכת ל-AI" (הגלובלי הפר-משתמש) — מוסר מה-UI, כי הוא כבר לא משפיע על הזרימה החדשה. הטבלה `ai_settings` נשארת ב-DB ללא שינוי (אפשר לנקות בעתיד).

## קבצים

חדש:
- migration: `doc_type_instructions` + RLS + GRANTs + seed
- `src/lib/doc-type-instructions.functions.ts`
- `src/components/doc-type-instructions-card.tsx`

עריכה:
- `src/routes/api/generate-spec.ts` — קריאה מהטבלה החדשה
- `src/lib/doc-types.server.ts` — נשאר כמקור defaults (מיוצא ל-helper שמשלב עם `DEFAULT_SYSTEM_INSTRUCTION`)
- `src/routes/_authenticated/settings.tsx` — סעיף חדש, הסרת סעיף ai_settings הישן
