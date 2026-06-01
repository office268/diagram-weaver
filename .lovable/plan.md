## מעבר ל-Google OAuth עם המיתוג שלך (BYOK)

### מה אעשה

**1. שמירת הסודות בצורה מאובטחת**
אבקש ממך להזין דרך טופס מאובטח את שני הערכים מ-Google Cloud Console:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

(לא לשלוח אותם בצ'אט — הטופס מצפין ושומר אותם ב-Lovable Cloud)

**2. הגדרת ספק Google ב-Backend**
אגדיר את ספק Google ב-Auth של Lovable Cloud עם הסודות שלך, במקום ה-OAuth המנוהל של Lovable. מהרגע הזה — חלון ההסכמה של Google יציג את **השם והלוגו של Analyst Assist**, לא של Lovable.

**3. עדכון קוד הכניסה**
ב-`src/routes/login.tsx`:
- החלפת `lovable.auth.signInWithOAuth("google", ...)` ב-`supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: ... } })`
- הסרת ה-import של `lovable`

**4. בדיקה**
- כניסה עם Google → לוודא שמופיע "Analyst Assist" במסך ההסכמה
- כניסה עם משתמש קיים (שנכנס דרך Lovable OAuth בעבר) — תמשיך לעבוד כי `sub` של Google זהה
- כניסה עם משתמש חדש — לוודא שהפרופיל נוצר נכון (trigger `handle_new_user` כבר קיים)

### נקודה חשובה — Verification

כל עוד האפליקציה ב-Google היא במצב **Testing**, משתמשים שאינם ברשימת ה-Test Users יראו אזהרה "Google hasn't verified this app". כדי להעלים אותה צריך:
- להגיש את האפליקציה ל-Verification (לוקח כמה ימים, דורש דומיין מאומת — `analyst-assist.com` מתאים)
- זה תהליך נפרד של Google ולא דורש שינויי קוד

### קבצים שישתנו

- `src/routes/login.tsx` — החלפת קריאת ה-OAuth
- הגדרות Auth ב-Backend (דרך הכלים)
- סודות חדשים: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`

### מה לא ישתנה

- טבלאות, RLS, פרופילים, קרדיטים — הכל נשאר
- משתמשים קיימים — ימשיכו להתחבר רגיל
- כניסה עם אימייל/סיסמה — לא מושפעת

מאשר להתחיל?
