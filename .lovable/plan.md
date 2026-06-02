## מטרה
הוספת קולפס חדש בדף ההגדרות בשם **"עלויות"**, שמציג טבלה מצטברת של כל הפעילות באתר — מסמך אחר מסמך — עם מספר מילים, טוקנים (input/output/total) ועלות ב-USD. הנתונים נשמרים תמיד, גם אחרי מחיקת המסמך.

## איך זה יעבוד

1. **שמירה לאורך זמן (snapshot):** הטבלה `ai_usage_events` כבר אוגרת קריאות AI עם טוקנים ועלות לכל `spec_document_id`. כיוון שכותרת המסמך ומספר המילים יכולים להימחק יחד עם המסמך, נוסיף לטבלה שלוש עמודות snapshot שמתמלאות בזמן הלוג:
   - `doc_title text` — שם המסמך באותו רגע
   - `doc_type text` — סוג המסמך
   - `word_count int` — ספירת מילים של תוכן המסמך באותו רגע
   
   ככה גם אחרי מחיקת המסמך נשמר תיעוד מלא.

2. **מילוי הנתונים החדשים:** `logAiUsage` ב-`src/lib/ai-usage.server.ts` יקבל את שלושת השדות (אופציונליים). בכל ארבעת ה-callers (`spec.functions.ts`, `chat-message.ts`, `review-spec.ts`, `improve-section.ts`) נשלוף את הכותרת/סוג מ-`spec_documents` ונספור מילים מתוך `content` (JSON serialize → split whitespace) ונעביר ל-log.

3. **Server function חדש:** `listAiUsage` ב-`src/lib/ai-usage.functions.ts` עם `requireSupabaseAuth` — מחזיר את כל ה-rows של המשתמש מ-`ai_usage_events` ממוין לפי `created_at desc`, כולל ה-snapshot fields.

4. **UI בדף ההגדרות:** קומפוננטה חדשה `AiUsageCard` בתוך קולפס חדש "עלויות" ב-`src/routes/_authenticated/settings.tsx`. תציג:
   - שורת סיכום: סה"כ מסמכים, סה"כ מילים, סה"כ טוקנים, סה"כ עלות USD
   - גריד/טבלה: תאריך · שם מסמך · סוג · purpose · מודל · מילים · input tokens · output tokens · total · עלות

   מסמכים מחוקים יוצגו עם הכותרת מה-snapshot ועם תווית "נמחק" (כש-`spec_document_id` לא קיים יותר בטבלה — נסמן ב-join `left join`).

## פרטים טכניים

- מיגרציה: `ALTER TABLE public.ai_usage_events ADD COLUMN doc_title text, ADD COLUMN doc_type text, ADD COLUMN word_count integer NOT NULL DEFAULT 0;`
- ספירת מילים: עוברים על כל הסעיפים ב-`content` (jsonb), מבצעים `JSON.stringify` או איסוף ערכי טקסט, ו-`split(/\s+/).filter(Boolean).length`.
- ה-Card יקרא דרך `useSuspenseQuery` עם `queryOptions(['ai-usage'])`.
- אין שינוי ב-RLS — המדיניות הקיימת "Users view own ai usage" מספיקה.
- אין צורך ב-FK ל-`spec_documents` (הוא לא קיים כיום בכל מקרה), כך שמסמך מחוק לא ימחק את שורות ה-usage.

## קבצים

- מיגרציה חדשה (3 עמודות snapshot)
- `src/lib/ai-usage.server.ts` — הרחבת `logAiUsage` עם snapshot fields
- 4 callers — שליפת כותרת/סוג + ספירת מילים והעברה ל-log
- `src/lib/ai-usage.functions.ts` — חדש, server fn `listAiUsage`
- `src/components/ai-usage-card.tsx` — חדש, ה-grid + סיכום
- `src/routes/_authenticated/settings.tsx` — הוספת `SettingsSection` חדש "עלויות"