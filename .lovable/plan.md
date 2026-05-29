
## הבעיה

`generateSpecFromModel` משתמש ב-`generateText` שמחכה לתשובה מלאה. עבור מודלים איטיים (gemini-2.5-pro, gpt-5-mini) שמייצרים JSON ארוך של מסמך אפיון מלא, הקריאה ל-AI Gateway מתבצעת מאחורי שכבת ה-Cloudflare Worker; כאשר אין תעבורה במשך זמן מה ה-upstream נסגר עם `upstream request timeout`. בנוסף ראיתי שגיאת runtime "המודל לא החזיר JSON תקני" — תוצאה של תגובה חלקית/חתוכה.

המעבר ל-streaming פותר את שני הצדדים: התעבורה זורמת ברציפות (אין idle timeout), והלקוח רואה התקדמות חיה.

## הפתרון

מעבר מ-`createServerFn` + `generateText` ל-server route streaming + `streamText`, עם accumulation בצד הלקוח ופירוס JSON רק כשהזרם נסגר.

### 1. server route חדש: `src/routes/api/generate-spec.ts`

- `POST /api/generate-spec` עם body `{ prompt, model }`.
- ולידציית Zod זהה לזו שב-`ai-spec.functions.ts` (כולל `COMPARISON_MODELS`).
- בודק auth דרך header — קורא session מהבקשה. אם לא מאומת → 401.
- טוען `system_instruction` מ-`ai_settings` עבור המשתמש (שאילתה אחת ל-Supabase admin עם user id מה-JWT).
- בונה את ה-provider עם `createLovableAiGatewayProvider` + `JSON_OUTPUT_INSTRUCTION`.
- מפעיל `streamText({ model, system, prompt })` ומחזיר `result.toTextStreamResponse()` (זרם raw text/plain). זה משאיר את ה-upstream פעיל ומונע את ה-504.
- שגיאות 429/402 → מחזיר status מתאים עם הודעה ידידותית בעברית.

### 2. הסרת `generateSpecFromModel` ה-RPC

- מוחק את `generateSpecFromModel` מ-`ai-spec.functions.ts`.
- משאיר את ה-schemas (`SpecOutputSchema`, `extractJson`) ומייצא אותם — הלקוח יצטרך את ה-Zod schema כדי לפרסר אחרי שהזרם נסגר.
- מעביר את `extractJson` + `SpecOutputSchema` לקובץ client-safe `src/lib/spec-output-schema.ts` (כי schemas של zod עובדים גם בלקוח), והקובץ הישן `ai-spec.functions.ts` נמחק.

### 3. עדכון `src/routes/_authenticated/dashboard.tsx`

- מסיר `useServerFn(generateSpecFromModel)`.
- ב-`runModel`: 
  - `fetch('/api/generate-spec', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: \`Bearer ${session.access_token}\` }, body: JSON.stringify({ prompt, model }) })`.
  - בודק `response.ok` — אם 429/402/אחר, קורא טקסט ומציג כשגיאה.
  - קורא את הזרם עם `response.body!.getReader()` + `TextDecoder` בלולאה, מצטבר ל-`fullText`. (אפשרות: לעדכן state עם מספר תווים שהתקבלו כדי להראות "התקבלו X תווים…" בזמן אמת.)
  - בסיום הזרם: `extractJson(fullText)` → `JSON.parse` → `SpecOutputSchema.parse` → קורא ל-`saveSpec` כמו היום.
- שאר הלוגיקה (`saveSpec`, `retryModel`, `handlePick`, dialog) נשארת.
- ב-UI של ה-loading tab אפשר להציג את מספר התווים שהתקבל עד כה (אופציונלי, נחמד למשתמש).

### 4. גישה ל-session ב-client

`supabase.auth.getSession()` כבר זמין דרך `@/integrations/supabase/client`. נשתמש בו ב-`runModel` להוצאת ה-access token עבור ה-Authorization header.

### 5. אימות auth ב-server route

ה-route ישתמש ב-`supabaseAdmin.auth.getUser(token)` כדי לקבל user id מהtoken שב-Authorization header, ואז שאילתת `ai_settings` תרוץ עם service-role + `eq('user_id', userId)`.

## קבצים שיושפעו

- חדש: `src/routes/api/generate-spec.ts`
- חדש: `src/lib/spec-output-schema.ts` (schemas + `extractJson` + טיפוס `SpecOutput`)
- נמחק: `src/lib/ai-spec.functions.ts`
- עריכה: `src/routes/_authenticated/dashboard.tsx` (קריאת streaming, פירוס בסוף)

## מה נשאר בלי שינוי

- DB schema, RLS, `ai_settings`, `spec.functions.ts`, `createSpec`, מסך ה-editor, ה-settings, ה-default system instruction, רשימת המודלים, ו-UI ההשוואה (חוץ מהחלפת מקור הקריאה).

## מה זה לא פותר

אם מודל ייצור באמת JSON שבור (לא טיימאאוט אלא תוכן לא תקני), עדיין תוצג שגיאת "המודל לא החזיר JSON תקני" — אבל ה-retry הקיים יעזור והבעיה תהיה נדירה יותר כי לא נחתכים יותר באמצע.
