## הבעיה

ב-`src/routes/__root.tsx` (שורה 80) ה-loader מחזיר `isAdmin: false` קבוע, ולא קורא לפונקציה `getIsAdmin` שכבר קיימת ב-`src/lib/site-texts.functions.ts`. התוצאה: ה-`SiteTextsProvider` תמיד מקבל `isAdmin=false`, ולכן ב-`src/routes/_authenticated/settings.tsx` 4 הסקציות שמוגנות ב-`{isAdmin ? ... : null}` נעלמות לכל המשתמשים — כולל אדמינים אמיתיים:

- לוג התחברויות
- מטא-דאטה של האפליקציה
- סוגי מסמכים וסעיפי ברירת מחדל
- הוראות מערכת לפי סוג מסמך (הפרומפטים)

## הפתרון

לזהות אדמין בצד הלקוח אחרי שה-session נטען, ולהזרים את הערך ל-`SiteTextsProvider`. לא דרך ה-root loader, כי ה-loader רץ ב-SSR בלי bearer token ו-`requireSupabaseAuth` היה נכשל.

### שינויים

1. **`src/routes/__root.tsx`**
   - להסיר את `isAdmin: false` מה-loader (לא קריטי, אבל מסדר את המודל).
   - ב-`RootComponent`: להוסיף `useQuery` שקורא ל-`getIsAdmin` רק כשיש משתמש מחובר (תלוי ב-`useAuth().user?.id` בתור queryKey, ו-`enabled: !!user`).
   - להעביר את התוצאה (`data?.isAdmin ?? false`) ל-`<SiteTextsProvider isAdmin={...}>`.
   - ה-`AuthBridge` הקיים כבר עושה `queryClient.invalidateQueries()` ב-SIGNED_IN/OUT, אז הסטטוס יתעדכן אוטומטית בלוגין/לוגאוט.

2. **בלי שינויי DB / RLS** — המדיניות `Users view own roles` על `user_roles` כבר מאפשרת לפונקציה לקרוא את התפקיד של המשתמש עצמו.

### אימות

אחרי השינוי, להתחבר כ-`office@make-i-tec.com`, לפתוח את `/settings`, ולפתוח את 4 הסקציות (הן עדיין יהיו מקופלות כברירת מחדל לפי הבחירה הקודמת — אם תרצה גם להחזיר אותן פתוחות כברירת מחדל, תגיד ואוסיף לזה).
