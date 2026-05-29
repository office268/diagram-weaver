## הבעיה
לוג ה-Worker מראה:
`[review-spec] failed: AI_NoObjectGeneratedError: No object generated: response did not match schema.`

המודל `google/gemini-3-flash-preview` דרך ה-Gateway לא מצליח לעמוד ב-strict schema של `generateObject` (כנראה מחזיר טקסט עטוף ב-```json``` או טקסט מקדים). זה אותו דפוס שכבר פתרנו ב-`generate-spec.ts` (שם השתמשנו ב-`generateText` + `extractJson` + parse ידני, לא ב-`generateObject`).

## תיקון
לעבוד באותה גישה ב-`src/routes/api/review-spec.ts`:

1. החלפת `generateObject` ב-`generateText` מתוך `ai`.
2. הוספת הוראת פורמט מפורשת ל-system prompt:
   - "החזר אך ורק אובייקט JSON תקני יחיד בצורה: `{ \"score\": number (1-10), \"notes\": string[] }`. ללא ```json```, ללא טקסט נוסף."
3. הוצאת ה-JSON מהפלט עם `extractJson` הקיים מ-`@/lib/spec-output-schema`.
4. `ReviewSchema.parse(JSON.parse(extracted))` עם clamp ל-score ל-טווח 1–10 ו-truncate ל-notes (max 20, max 500 תווים לכל אחד) — דרך טרנספורם ב-Zod כדי לא להפיל אם המודל חרג מעט.
5. במקרה של כשל parse — fallback ל-`{ score: null, notes: [] }` + status 200 ולוג שגיאה. כך הזרימה ב-dashboard לא נשברת (היא כבר תומכת ב-score=null).

## מה לא משתנה
- אותו model (`gemini-3-flash-preview`), אותו gateway, אותו endpoint, אותו contract של ה-response (`{score, notes}`).
- אין שינוי ב-DB, ב-dashboard, ב-editor או ב-ReviewPanel.
- אין שינוי ב-`generate-spec.ts`.

## קבצים שישתנו
- `src/routes/api/review-spec.ts` בלבד.
