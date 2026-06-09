## הבעיה
דף `/organization` מציג "אינך משויך לארגון" למרות שלמשתמש `amoyal1976@gmail.com` יש שיוך בפועל לארגון `רוני` במסד הנתונים.

**הסיבה המדויקת:**
ה־hook `useCurrentOrganization` ב־`src/hooks/use-current-organization.ts` מבצע שליפה מ־`organization_members` בלי סינון לפי `user_id` של המשתמש המחובר. לכן הוא עלול לקבל `null` או רשומה לא רלוונטית, ואז דף `src/routes/_authenticated/organization.tsx` חושב שאין שיוך לארגון.

## מה אתקן
1. **אתקן את שליפת הארגון הנוכחי**
   - אוסיף סינון מפורש לפי המשתמש המחובר.
   - אעדיף להשתמש בפונקציית השרת הקיימת `getCurrentOrganization` מתוך `src/lib/organizations.functions.ts`, כי שם כבר יש סינון נכון לפי `userId`.

2. **אתקן את מנגנון ה־cache המקומי**
   - אמנע מצב שבו `null` ישן נשמר וממשיך להופיע אחרי שכבר נוצר שיוך לארגון.
   - אדאג לרענון נתונים אחרי טעינת משתמש מחובר.

3. **אאמת את מסך הארגון**
   - אבדוק ש־`/organization` מציג את הארגון `רוני` עבור `amoyal1976@gmail.com`.
   - אבדוק שגם האייקון/שם הארגון בכותרת נשארים עקביים עם אותו מקור נתונים.

## קבצים ממוקדים
- `src/hooks/use-current-organization.ts`
- `src/lib/organizations.functions.ts`
- `src/routes/_authenticated/organization.tsx`
- ייתכן גם `src/routes/_authenticated.tsx` רק אם אצטרך לרענון query/תצוגה בכותרת

## אימות
- אאשר שהמשתמש המחובר רואה את `רוני` בדף הארגון.
- אאשר שהודעת "אינך משויך לארגון" לא מופיעה יותר למשתמש הזה.