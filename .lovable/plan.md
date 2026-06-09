# דף ניסיוני חדש — אפיון מול Gemini 2.5 Pro

## מטרה
דף עצמאי באפליקציה, מנותק מהזרימה הקיימת (אין orchestrator, אין סוכנים מרובים, אין JSON forced, אין self-critique loop). כל פעולה = קריאה בודדת ל-`google/gemini-2.5-pro` בפורמט ברירת המחדל של המודל (טקסט/Markdown חופשי).

לא נוגעים בקוד קיים — הכל חדש לחלוטין במקביל לזרימה הראשית.

## מסלול
- ראוט חדש: `src/routes/_authenticated/lab.$sessionId.tsx` (`/lab/:sessionId`)
- ראוט אינדקס: `src/routes/_authenticated/lab.index.tsx` (`/lab`) — יוצר session חדש ומפנה אליו.

## פריסה (UI/UX)

### Desktop (≥ lg) — 12 עמודות
```text
┌──────────────────────────────────┬─────────────────────────┐
│ אזור 4 — תוצרי אפיון (Markdown)  │ אזור 2 — מסמכים שעלו   │
│   col-span-8, גובה מלא           │   col-span-4            │
│                                  ├─────────────────────────┤
│                                  │ אזור 3 — שאלות לבירור  │
│                                  │   col-span-4            │
├──────────────────────────────────┴─────────────────────────┤
│ אזור 1 — פרומפט חופשי + העלאת קבצים (sticky bottom)       │
└────────────────────────────────────────────────────────────┘
```

### Mobile (< lg) — טאבים
טאבים עליונים: **תוצרים | מסמכים | שאלות**. אזור 1 (פרומפט) sticky בתחתית מעל ה-mobile bottom nav הקיים, נגיש תמיד מכל טאב.

## פונקציונליות לפי אזור

**אזור 1 — פרומפט חופשי**
- `Textarea` + כפתור שליחה + כפתור צירוף קבצים (multi).
- בשליחה: שולח לשרת את הפרומפט + ה-session id. השרת בונה את הקונטקסט מה-DB (מסמכים + שאלות-תשובות + תוצר אחרון) ומבצע קריאה בודדת ל-Gemini 2.5 Pro.

**אזור 2 — מסמכים**
- כרטיסים: שם קובץ, גודל, סטטוס, כפתור מחיקה.
- העלאה דרך `/api/lab-upload` (חדש). הקובץ נשמר ב-bucket `chat-attachments` תחת `lab/<userId>/<sessionId>/`.
- חילוץ טקסט בצד הלקוח (`text-extractor.client.ts` הקיים תומך ב-PDF/DOCX/TXT) — נשלח לשרת כטקסט גולמי ונשמר ב-DB יחד עם metadata של הקובץ.

**אזור 3 — שאלות פתוחות**
- אם המודל מסיים תשובה ברשימת שאלות בפורמט `?? <שאלה>` בשורות נפרדות, הלקוח יפרסר אותן ויציג כשדות תשובה inline.
- בלחיצה על "שלח תשובות" — התשובות נשמרות ב-DB, וקריאה הבאה למודל מצרפת אותן לקונטקסט.

**אזור 4 — תוצרים**
- חלון Markdown גדול (`react-markdown` + plugins הקיימים). מציג את הפלט האחרון של המודל.
- כפתורים: "נקה תוצר", "העתק", "פתח session חדש".

## קריאת ה-LLM — סטנדרטית לחלוטין
- Server route: `POST /api/lab-chat`.
- מודל: `google/gemini-2.5-pro` קבוע.
- `generateText` בלבד — בלי `Output.object`, בלי schema, בלי tools, בלי `JSON_ONLY_INSTRUCTION`, בלי thinking budget, בלי בקרות מותאמות.
- System prompt מינימלי בעברית: "אתה אנליסט מערכות. כתוב בעברית, ב-Markdown טבעי. אם חסר לך מידע, סיים את התשובה ברשימת שאלות שכל שורה מתחילה ב-`?? `."
- הקונטקסט שנשלח: תוכן כל המסמכים שעלו (concatenated, עם הפרדה ברורה) + רשימת שאלות-תשובות קודמות + הפרומפט הנוכחי. בלי ניקיון/דחיסה נוסף.
- חיוב קרדיטים: 1 קרדיט לקריאה (להתאמה עם המנגנון הקיים).

## אחסון ב-DB (חדש, מבודד)

מיגרציה אחת יוצרת 4 טבלאות חדשות (אין שינוי בטבלאות קיימות):

| טבלה | מטרה | שדות עיקריים |
|------|------|-------------|
| `lab_sessions` | סשן עבודה של משתמש | `id`, `user_id`, `title`, `latest_output_md`, `created_at`, `updated_at` |
| `lab_documents` | מסמכים שעלו לסשן | `id`, `session_id`, `user_id`, `file_name`, `mime_type`, `file_size`, `storage_path`, `extracted_text`, `created_at` |
| `lab_messages` | היסטוריית פרומפטים ותגובות מהמודל | `id`, `session_id`, `user_id`, `role` (`user`/`assistant`), `content`, `created_at` |
| `lab_questions` | שאלות שהמודל ביקש + תשובות המשתמש | `id`, `session_id`, `user_id`, `question`, `answer`, `answered_at`, `created_at` |

כל הטבלאות:
- RLS פעיל, מדיניות `auth.uid() = user_id` ל-SELECT/INSERT/UPDATE/DELETE.
- GRANTs ל-`authenticated` ו-`service_role`.
- `service_role` בלבד דרך `supabaseAdmin` ב-server routes.

## ניווט
- פריט תפריט חדש "מעבדה" (Lab) ב-sidebar הקיים, גלוי רק למשתמשים מאומתים.

## מה לא משתנה
שום קובץ קיים תחת `src/agents/`, `src/lib/spec-*`, `src/routes/_authenticated/editor.*`, `src/routes/api/chat-message.ts`, `src/routes/api/generate-spec*.ts` — אפס שינוי. הדף הזה חי במקביל.

## פרטים טכניים (קבצים חדשים)
- `supabase/migrations/<timestamp>_lab_tables.sql` — 4 הטבלאות + RLS + GRANTs.
- `src/routes/_authenticated/lab.index.tsx` — יצירת session + redirect.
- `src/routes/_authenticated/lab.$sessionId.tsx` — הדף עצמו (UI מלא, desktop + mobile).
- `src/routes/api/lab-chat.ts` — POST: בונה קונטקסט מה-DB, קריאה ל-Gemini 2.5 Pro, שומר message, מעדכן `latest_output_md`, מפרסר ושומר שאלות חדשות.
- `src/routes/api/lab-upload.ts` — POST: שומר ב-Storage + insert ל-`lab_documents` עם הטקסט המחולץ.
- `src/routes/api/lab-answer.ts` — POST: עדכון תשובה לשאלה.
- `src/routes/api/lab-delete.ts` — POST: מחיקת מסמך / סשן / שאלה.
- עדכון קל ל-sidebar להוסיף פריט "מעבדה".

## מה לא בתוכנית הזו (לעתיד אם תרצה)
- ייצוא ל-PDF/Word
- שיתוף סשן עם משתמש אחר
- לולאות סוכנים / ביקורת / שיפור אוטומטי
- בחירת מודל (קבוע על Gemini 2.5 Pro)
