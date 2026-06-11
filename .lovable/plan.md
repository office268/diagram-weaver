
## רקע מהבדיקה

הצילום שצירפת מציג את מסך הצ'אט (`/chat/$threadId`), אזור ה־Composer עם כפתור `+`. אישרת ש:
- לחיצה על `+` → בוחר הקבצים **כן נפתח**.
- הניסיון הוא עם **PDF**.
- הקובץ לא נפתח / לא מתחיל לעלות אחרי הבחירה.

### מה כבר ידוע מהקוד

1. הרכיב הרלוונטי: `src/routes/_authenticated/chat.$threadId.tsx`
   - `onPickFiles` → `uploadFiles(file)` → שני שלבים:
     - `supabase.storage.from("chat-attachments").upload(path, file)` (RLS, בצד לקוח)
     - `extractTextFromFile(file)` (PDF.js בדפדפן)
2. Bucket `chat-attachments` **קיים** (אומת מול ה־DB), עם RLS תקין לפי `userId/...`.
3. ב־`lab.$sessionId.tsx` קיים flow מקביל עם **לוגים מובנים מפורטים** (`[lab-upload][client] ...`) שמאפשרים אבחון מדויק — בצ'אט אין לוגים כאלה כרגע. ה־toast היחיד שמופיע במידה ויש שגיאה הוא:
   - `"נדרשת התחברות מחדש"` (אין session)
   - `"הקובץ גדול מ-10MB"`
   - `"<filename>: <error message>"` (שגיאת storage או חילוץ)
4. ה־Console logs האחרונים שלך ריקים (אין שגיאות JS), וב־Network שמורת ההפעלה אין רשומת `upload` — מה שמרמז ששגיאה קורית **לפני** קריאת הרשת (sessionless / שגיאת PDF.js בטעינת ה־worker / חריגה שנבלעה ב־try), או שמופיע toast קצר שאתה לא רואה.

### חשודים מובילים (לפי סדר סבירות)

1. **PDF.js worker** — `await import("pdfjs-dist/build/pdf.worker.min.mjs?url")` עלול להיכשל ב־build הפרודקשן (path/CSP/MIME) — שגיאה נזרקת ב־`extractPdf` ונבלעת ל־toast `"<file>: ..."` שיכול להיעלם מהר.
2. **`supabase.storage.upload` נכשל** עקב MIME לא צפוי (Android Chrome לעיתים מחזיר `application/octet-stream` ל־PDF) — ה־bucket לא מגביל MIME אבל זה עדיין סטוץ' לוודא.
3. **Session expired** ב־`supabase.auth.getSession()` — מציג רק toast קצר ויוצא בלי שום קריאת רשת.
4. **כשל שקט בתוך `Promise.all` של uploadFiles** — אם משהו נזרק לפני ה־try (למשל ב־`crypto.randomUUID()` בסביבה בעייתית), אין toast בכלל.

## תוכנית

### שלב 1 — הוספת לוגים מובנים זהים ל־Lab בצ'אט (אבחון בלבד)

עריכת `src/routes/_authenticated/chat.$threadId.tsx` בלבד, בפונקציות:
- `onPickFiles` — לוג של `count` ו־`names`.
- `uploadFiles` — לוג בכל צומת:
  - `[chat-upload] start` (קובץ, גודל, type, hasSession)
  - `[chat-upload] storage:before` / `storage:after` (כולל `error?.message`)
  - `[chat-upload] extract:start` / `extract:done` (`charCount`) / `extract:error` (message + stack)
- שמירת ה־toasts הקיימים — בלי לשנות UX.

הלוגים בלבד; **אין שינוי בלוגיקה, אין שינוי באיכות התוצרים האפיוניים**.

### שלב 2 — שיפור הצגת שגיאות ל־UI (קל)

- בכל toast של שגיאה להוסיף את `status code` / `error.code` כאשר זמין.
- לשמור את ה־`errorMessage` ב־state כבר היום — לוודא שהוא מוצג כ־`title` על ה־chip (כבר עושים זאת).

### שלב 3 — רפרודוקציה חיה ב־browser tool

לאחר השינוי:
1. אכנס לפריוויו ב־browser tool (תוך שימוש בסשן שלך).
2. אנווט ל־thread קיים בצ'אט.
3. אנסה להעלות PDF קטן (1–2 עמודים) דרך כפתור ה־`+`.
4. אקרא את ה־Console + Network של ה־browser tool כדי לאתר את הצומת שנכשל.
5. אדווח לך מה הסיבה המדויקת ואציע תיקון ממוקד (תוכנית נפרדת).

### שלב 4 (תלוי בממצאי שלב 3) — תיקון

לפי מה שנמצא:
- אם זה **PDF.js worker** → לעבור ל־import של ה־worker ב־`new Worker(new URL(...))` או להשתמש ב־`workerSrc` מתוך CDN של pdfjs בגרסה המקבילה.
- אם זה **MIME / RLS** → להוסיף fallback של `contentType` ולבדוק את `error.statusCode`.
- אם זה **Session** → לרענן טוקן לפני העלאה.

## מה לא משתנה

- אין שינוי ב־system prompts, סכמות, ולידציה, thinking steps, self-critique או באיכות התוצרים האפיוניים.
- אין שינוי במיגרציות / RLS / buckets.
- אין שינוי באף route או פלואו פרט להוספת לוגים בצ'אט.

## קבצים מושפעים בשלב 1+2

- `src/routes/_authenticated/chat.$threadId.tsx` — הוספת `console.info`/`console.error` בלבד ב־`uploadFiles`/`onPickFiles`.

## אישור

מאשר/ת להמשיך לשלב 1 ואז לרוץ אבחון חי בדפדפן?
