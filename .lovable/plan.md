הסרה של `openai/gpt-5-mini` מרשימת המודלים להשוואה.

## שינוי בקובץ אחד

`src/lib/ai-spec-defaults.ts` — להסיר את השורה `"openai/gpt-5-mini"` מהמערך `COMPARISON_MODELS`. נשארים שני המודלים שעובדים:
- `google/gemini-2.5-pro`
- `google/gemini-3-flash-preview`

זה מספיק — `COMPARISON_MODELS` הוא מקור האמת ש-`dashboard.tsx` משתמש בו, כך ש-UI ההשוואה יציג רק 2 מודלים ולא ינסה לקרוא ל-gpt-5-mini.

## מה לא משתנה
- route ה-streaming (`/api/generate-spec`) נשאר כפי שהוא — אם בעתיד נרצה להחזיר את gpt-5-mini אפשר פשוט להוסיף אותו בחזרה למערך.
- אין שינויים ב-DB, RLS, או בלוגיקת השמירה.