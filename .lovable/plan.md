## המטרה
להפוך את יצירת התרשימים לעמידה לחלוטין לטיימאאוטים של Worker/Edge, על ידי תור עבודות מתמשך שמעובד ע"י pg_cron — בלי לפגוע באיכות הפרומפטים, הסכמות, הוולידציה או ה-self-critique.

## ארכיטקטורה

```text
Client → /api/chat-message
           ├─ INSERT diagram_jobs (status=pending)
           └─ return { jobId }   ← מיידי
                          ↓
Client polls diagram_jobs.status

pg_cron (כל 10 שניות)
   └─ POST /api/public/hooks/process-diagram-jobs
            ├─ SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1
            ├─ UPDATE status=processing
            ├─ runDiagramJob(...)   ← הלוגיקה הקיימת ב-diagram-job.server.ts
            └─ UPDATE status=done/failed
```

עיבוד עבודה אחת כל הרצה של ה-hook → אין מצב של "תקיעה" של ה-Worker, וכל עבודה רצה בתוך חלון Worker רגיל (הלוגיקה הקיימת כבר נכנסת בזמן סביר לעבודה בודדת; הבעיה הייתה רק החיבור הפתוח מהלקוח).

## שינויים

### 1. טבלת `diagram_jobs` — תוספות קטנות (מיגרציה)
- `attempts int default 0`
- `locked_at timestamptz` — לזיהוי עבודות תקועות ב-processing
- אינדקס על `(status, created_at)` להאצת ה-poll
- אופציונלי: `max_attempts int default 1` (כדי לא לחזור על כשלון יקר אוטומטית)

### 2. הסרת `waitUntil`
- ב-`src/routes/api/chat-message.ts`: להסיר את `waitUntil(runDiagramJob(...))` ואת ה-import של `cf-context.server.ts`. ה-handler רק יוצר את ה-job ומחזיר `jobId`.
- `src/lib/cf-context.server.ts` ו-`src/server.ts` (חלק ה-`waitUntil`) — לא נחוצים יותר ויוסרו.

### 3. נקודת קצה לעיבוד: `src/routes/api/public/hooks/process-diagram-jobs.ts`
- POST בלבד.
- אבטחה: `apikey` header מול `SUPABASE_PUBLISHABLE_KEY` (הדפוס הסטנדרטי ל-pg_cron במערכת).
- שולף עבודה אחת `pending` באמצעות RPC ייעודי `claim_diagram_job()` שמשתמש ב-`FOR UPDATE SKIP LOCKED` ומעלה `status=processing`, `started_at`, `locked_at`, `attempts+1`.
- מריץ את `runDiagramJob(...)` הקיים — בלי שינוי לוגיקה, בלי שינוי פרומפטים, בלי שינוי ולידציה.
- מחזיר `{ processed: true|false, jobId? }`.

### 4. RPC `claim_diagram_job()` (מיגרציה, SECURITY DEFINER)
מבטיח שאף שתי הרצות cron לא יתפסו את אותו job. מחזיר שורה אחת או NULL.

### 5. `pg_cron` (דרך supabase--insert, לא מיגרציה)
- הפעלת `pg_cron` + `pg_net` אם אינם פעילים.
- job בשם `process-diagram-jobs` שרץ כל 10 שניות (`*/10 * * * * *` אם נתמך; אחרת קביעת מינימום של דקה + לולאה פנימית של עד 5 עבודות ברצף בתוך אותה הרצה — נחליט לפי מה ש-pg_cron של הפרויקט תומך).
- קורא לעוטף ה-hook עם `apikey` של anon.

### 6. שחזור עבודות תקועות (Watchdog)
job שני (`reset-stuck-diagram-jobs`, כל דקה): מחזיר ל-`failed` כל job שב-`processing` יותר מ-5 דקות עם `error_message='stuck timeout'`. מונע מצב שבו Worker נפל באמצע.

### 7. צד לקוח
ללא שינוי — ה-polling הקיים על `diagram_jobs.status` ממשיך לעבוד כמו שהוא.

## מה שנשאר זהה לחלוטין (איכות התוצרים)
- `runActivitySwimlaneOrchestrator` (Extract → Build → Validate → Fix ×2): ללא שינוי.
- `runRfJsonDiagramAgent`: ללא שינוי.
- כל ה-system prompts, סכמות, ולידציות מבניות, self-critique, מינימום שלבי thinking: ללא שינוי.

## הערות טכניות
- ה-hook יושב תחת `/api/public/*` כי pg_cron קורא מבחוץ; אבטחה ע"י `apikey` בלבד (הדפוס המקובל בפרויקט, לא ממציאים secret חדש).
- אם בעתיד תרצה throughput גבוה — מגדילים את התדירות או מעבדים כמה jobs בהרצה. כרגע 1-job-per-tick מספיק ובטוח.
- העבודה הקיימת שתקועה ב-`pending` תיתפס אוטומטית ע"י ה-cron ברגע שהוא יופעל.

## סדר ביצוע
1. מיגרציה: עמודות חדשות + אינדקס + RPC `claim_diagram_job`.
2. יצירת `process-diagram-jobs.ts` + הסרת `waitUntil` מ-`chat-message.ts`.
3. מחיקת `cf-context.server.ts` והניקוי ב-`src/server.ts`.
4. רישום ה-cron jobs (`process-diagram-jobs` + `reset-stuck-diagram-jobs`).
5. בדיקת end-to-end על activity.
