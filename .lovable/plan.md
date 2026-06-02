## מה נבנה
הרחבה של סרגל הסטטוס בעורך כך שיציג:
1. **מילים במסמך הנוכחי** (כבר קיים)
2. **טוקנים מצטברים** של כל הקריאות ל-AI על המסמך הספציפי שפתוח (אותו `spec_documents.id`)
3. **עלות מצטברת ב-$** של אותן קריאות

מסמכים ישנים יציגו `—` בשני השדות החדשים.

---

## שינויי DB (migration)

טבלה חדשה `ai_usage_events`:
- `id uuid pk`
- `user_id uuid` (RLS)
- `spec_document_id uuid` — לאיזה מסמך הקריאה שייכת
- `model text` — שם המודל שנקרא
- `prompt_tokens int`, `completion_tokens int`, `total_tokens int`
- `cost_usd numeric(12,6)` — מחושב בעת ההכנסה לפי טבלת תעריפים בקוד
- `purpose text` — `generate` / `improve_section` / `review` / `agent:requirements` וכו'
- `created_at timestamptz`
- אינדקס על `(spec_document_id)`
- RLS: בעלים בלבד יכול לקרוא; INSERT דרך service_role (מהשרת)

## תעריפים (קוד, לא DB)
קובץ חדש `src/lib/ai-pricing.ts` עם מפה: `model → { inputPer1M, outputPer1M }` עבור המודלים שבשימוש (Gemini 2.5/3 flash/pro, GPT-5 וכו'). מחושב בעת לוג ה-usage. מודל לא מוכר → cost=0.

## רישום ה-usage
פונקציה משותפת `logAiUsage({ userId, docId, model, usage, purpose })` ב-`src/lib/ai-usage.server.ts` שמשתמשת ב-`supabaseAdmin`.

הוספת קריאה אליה אחרי כל `generateText` שמשויך למסמך, בקבצים:
- `src/routes/api/generate-spec.ts` ו-`generate-spec-v2.ts`
- `src/routes/api/improve-section.ts`
- `src/routes/api/review-spec.ts`
- כל agents תחת `src/agents/*/index.server.ts` (האורקסטרטור יעביר את `docId` למטה)

ה-AI SDK מחזיר `usage.promptTokens/completionTokens/totalTokens` — שימוש ישיר בערכים אלה.

## Server function חדשה לקריאה
`getDocUsageTotals(docId)` ב-`src/lib/spec.functions.ts` (עם `requireSupabaseAuth`):
```sql
select sum(total_tokens), sum(cost_usd) from ai_usage_events where spec_document_id = $1
```
מחזיר `{ totalTokens, totalCostUsd } | null` (null = אין נתונים → להציג `—`).

## שינויים בקליינט
1. `src/components/editor-status-bar.tsx` — מקבל שני props חדשים: `totalTokens: number | null`, `totalCostUsd: number | null`. מציג שני שדות נוספים עם אייקונים (`Coins` ו-`DollarSign` מ-lucide). `null → "—"`. עיצוב מינימלי בסגנון הקיים.
2. `src/routes/_authenticated/editor.$id.tsx` — `useQuery` ל-`getDocUsageTotals` עם `staleTime` של 30 שניות; invalidation אחרי "צור מחדש" / "שפר סעיף". מעביר ל-`EditorStatusBar`.

---

## ביצועים
- **כתיבה**: insert אחד לכל קריאת AI (ממילא 2-30 שניות) — תוספת זניחה (~5ms).
- **קריאה**: query אחד עם `SUM()` ואינדקס על `spec_document_id` → <10ms.
- **תדירות**: רק בעת טעינת המסמך + אחרי פעולות AI. ללא polling.

לא יורגש בביצועים.

## מה לא משתנה
- מבנה `spec_documents`, חישוב מילים, סעיפים, אחוזי התקדמות, קרדיטים.
- מסמכים ישנים — פשוט יציגו `—`.
