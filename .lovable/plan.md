# סוכן 'מבקר איכות'

מיד אחרי שהסוכן 'מנתח מערכות' מחזיר אפיון JSON תקין ולפני השמירה ל-DB, נריץ סוכן AI שני — 'מבקר איכות' — שמקבל את האפיון המלא + הפרומפט המקורי, ומחזיר ציון 1–10 ורשימת הערות לשיפור. הציון וההערות יישמרו עם המסמך ויוצגו למשתמש בכרטיס התוצאה ובמסך העריכה.

## שינויים

### 1. סכמת DB (מיגרציה)
הוספת שתי עמודות ל-`public.spec_documents`:
- `review_score int` — null מותר (למסמכים ישנים)
- `review_notes jsonb` — ברירת מחדל `'[]'::jsonb`, מערך של מחרוזות

ללא שינויי RLS/GRANTS (הם כבר תקינים לעמודות נוספות).

### 2. סוכן הביקורת — server route חדש `src/routes/api/review-spec.ts`
- מאומת באותה צורה כמו `generate-spec` (Bearer token → `supabaseAdmin.auth.getUser`).
- מקבל `{ prompt: string, spec: <SpecOutput JSON> }`.
- משתמש באותו model שעובד (`google/gemini-3-flash-preview`) דרך `createLovableAiGatewayProvider`.
- משתמש ב-AI SDK `generateText` עם `Output.object` וסכמת Zod:
  ```
  { score: z.number().int().min(1).max(10), notes: z.array(z.string()).max(20) }
  ```
- system prompt בעברית: "אתה מבקר איכות בכיר של מסמכי אפיון. דרג את המסמך 1–10 על בסיס שלמות, עקביות, רמת פירוט, בהירות וכיסוי הפרומפט. כתוב עד 8 הערות קצרות וקונקרטיות לשיפור (בעברית). אם המסמך מצוין — החזר רשימת הערות ריקה."
- מחזיר `Response.json({ score, notes })`. מטפל ב-429/402 כמו ב-generate-spec.

### 3. `src/lib/spec.functions.ts` — `createSpec`
הוספת שדות אופציונליים `reviewScore?: number | null` ו-`reviewNotes?: string[]` לקלט, ושמירתם לעמודות החדשות. ללא שבירת תאימות לקריאות קיימות.

### 4. `src/lib/spec-output-schema.ts`
הוספת `ReviewSchema = z.object({ score: z.number().int().min(1).max(10), notes: z.array(z.string()) })` ושימוש בה ב-client.

### 5. `src/routes/_authenticated/dashboard.tsx`
- אחרי `SpecOutputSchema.parse(parsed)` וב-`runModel`: fetch ל-`/api/review-spec` עם הספק והפרומפט. אם הביקורת נכשלת — נמשיך לשמור עם `score=null, notes=[]` ונציג טוסט אזהרה (לא מפיל את כל הזרימה).
- `ModelState` יורחב: ב-`saving`/`success` יישמרו גם `review?: { score, notes }`.
- `saveSpec` יקבל גם את הביקורת ויעביר ל-`createFn`.
- בכרטיס תוצאה של מודל (status=success): תצוגת badge "ציון איכות: X/10" + רשימת bullets של ההערות (מתקפלת אם יש).

### 6. `src/routes/_authenticated/editor.$id.tsx`
תצוגה למעלה: badge ציון + רשימת הערות ביקורת (read-only) כשהן קיימות. ללא עריכה.

## מה לא משתנה
- רשימת המודלים (`COMPARISON_MODELS`) — נשארת רק עם `gemini-3-flash-preview`.
- אין הגדרת system instruction חדש למשתמש (הביקורת היא system קבוע שלנו).
- אין שינויים ב-auth, ב-RLS או בזרימת הניווט.
