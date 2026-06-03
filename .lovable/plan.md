## מטרה
בעת הרשמה — לא לאפשר כניסה ישירה. במקום זה: ליצור בקשת רישום, להציג הודעה למשתמש, ולחייב אישור admin לפני כניסה. חל גם על הרשמה עם אימייל וגם דרך Google.

## שינויי DB (migration)

1. **טבלה חדשה `signup_requests`** — מאחסנת את פרטי הבקשה:
   - `id`, `user_id` (FK ל-auth user שנוצר), `email`, `display_name`, `provider` (`email` / `google`), `status` (`pending` / `approved` / `rejected`), `notes`, `requested_at`, `reviewed_at`, `reviewed_by`.
   - RLS: משתמש יכול לראות את הבקשה שלו (לפי `user_id`); admin רואה/מעדכן הכל. INSERT מותר למשתמש מאומת על השורה שלו.

2. **עמודה `approval_status`** ב-`profiles` (`pending` ברירת מחדל, `approved` למשתמשים קיימים כדי לא לחסום אותם).

3. **טריגר על `handle_new_user`** — להוסיף יצירת שורה ב-`signup_requests` עם `status='pending'` בכל הרשמה חדשה, ולסמן `profiles.approval_status='pending'`.

## שינויי קוד

### `src/routes/index.tsx` — מסך הכניסה/הרשמה

- **Email signup**: לאחר `signUp` מוצלח — לבצע מיד `signOut`, להציג toast: "בקשת הרישום נשלחה. בשעות הקרובות תקבל אישור ופרטי כניסה במייל". לא לנווט ל-dashboard.
- **Email signin**: לאחר `signInWithPassword` מוצלח — לבדוק `profiles.approval_status`. אם `pending`/`rejected` — לבצע `signOut` ולהציג הודעה מתאימה ("הבקשה ממתינה לאישור admin" / "הבקשה נדחתה").
- **Google**: באותה לוגיקה — לאחר חזרה מ-OAuth, ב-`_authenticated` נבדוק את הסטטוס.

### `src/routes/_authenticated.tsx` (gate)

- להוסיף בדיקת `approval_status` של המשתמש המחובר. אם אינו `approved` — `signOut` + ניווט לעמוד `/pending-approval` עם הודעת המתנה (או חזרה ל-`/` עם toast).

### עמוד חדש `src/routes/pending-approval.tsx`

- עמוד פשוט שמסביר שהבקשה ממתינה לאישור admin, וכפתור חזרה למסך הכניסה.

### עמוד admin לאישור בקשות

- חדש: `src/routes/_authenticated/signup-requests.tsx` — רשימת בקשות ממתינות עם כפתורי "אשר" / "דחה". מוגן ב-`has_role('admin')`.
- קישור לעמוד מתוך תפריט ה-admin הקיים.
- בעת אישור: עדכון `signup_requests.status='approved'`, `reviewed_at`, `reviewed_by`, וגם `profiles.approval_status='approved'`. בעת דחייה: סטטוס `rejected` + סימון profile בהתאם.

## הערות
- הסיסמה שהמשתמש הזין נשמרת ע"י Supabase Auth כרגיל (hashed). admin רק "פותח את השער" ע"י עדכון הסטטוס — לא משנה סיסמה.
- משתמשים קיימים יסומנו כ-`approved` אוטומטית במיגרציה כדי לא לחסום גישה קיימת.
- שליחת מייל פעיל למשתמש על האישור היא שלב נוסף אופציונלי (לא כלול כעת — תוכל לבקש אם תרצה).