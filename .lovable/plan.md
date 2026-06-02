## בעיה

המשתמש מחובר כמנהל (אומת ב-DB: 1 משתמש עם `role='admin'`), אך הכפתור לא מופיע. הקוד שלי בודק `isAdmin` מ-`useSiteTexts()` שמגיע מ-`loaderData` של ה-root route. שני חשדים סבירים:

1. **Stale loader data** — ה-`__root.tsx` loader רץ פעם אחת ב-SSR ללא bearer token (`getIsAdmin` נכשל → `isAdmin=false`), ועד שה-`onAuthStateChange` קורא ל-`router.invalidate()` ה-state עדיין הישן. בגלל `defaultPreloadStaleTime: 0` בדרך כלל זה נפתר, אבל ייתכן מירוץ.
2. **Build/deploy לא טרי** — המשתמש פשוט רואה גרסה ישנה.

## תיקון

להוסיף ל-`projects.index.tsx` בדיקת admin עצמאית דרך `useQuery` שקורא ישירות ל-`getIsAdmin` (server fn קיימת), במקום להסתמך רק על context. ככה הכפתור יוצג ברגע שהשאילתה חוזרת `true`, ללא תלות ב-loader של ה-root.

```ts
const isAdminFn = useServerFn(getIsAdmin);
const { data: adminData } = useQuery({
  queryKey: ["isAdmin"],
  queryFn: () => isAdminFn(),
  staleTime: 60_000,
});
const isAdmin = adminData?.isAdmin ?? siteTextsIsAdmin;
```

(ה-fallback ל-`useSiteTexts().isAdmin` נשמר כדי לא להמתין לראשון.)

## שלבים

1. בקובץ `src/routes/_authenticated/projects.index.tsx`:
   - להוסיף import של `getIsAdmin` מ-`@/lib/site-texts.functions`
   - להוסיף `useQuery({ queryKey: ['isAdmin'], queryFn: ... })`
   - לאחד עם `useSiteTexts().isAdmin` בתור fallback
   - להחליף את התנאי `{isAdmin && ...}` עם הערך המאוחד

2. אין שינויי DB, אין סכמות חדשות.

## הערה למשתמש

אם גם אחרי התיקון הכפתור לא מופיע — נא לעשות **רענון קשה** (Ctrl+Shift+R / משיכה מלמעלה במובייל) ולפתוח שוב את דיאלוג "פרויקט חדש".
