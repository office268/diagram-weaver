## מה נבנה

הוספת אייקון חיפוש (Search) בקצה ההפוך של שורת הלוגו בהדר. לחיצה עליו פותחת/סוגרת שורה שנייה מתחת לשורת הלוגו, עם אותם רכיבי חיפוש/מיון/סינון כמו בדף "המסמכים שלי", רק שהם פועלים גלובלית על כל הפריטים בארגון (פרויקטים + מסמכים + תרשימים + קבצים שהועלו).

לחיצה על פריט בתוצאות = ניווט ישיר לעמוד הפריט (`/editor/$id` למסמכים, `/projects/$projectId` לפרויקטים וכו').

## שינויי קבצים

### `src/components/global-search-bar.tsx` (חדש)
קומפוננטה חדשה שעוטפת:
- `Input` חיפוש חופשי (placeholder: "חפש פרויקטים, מסמכים, תרשימים, קבצים...")
- כפתור מיון (`DropdownMenu` עם `ArrowUpDown`) — אותם 4 ערכי מיון כמו ב-documents
- כפתור סינון (`Sheet` עם `SlidersHorizontal` + badge מספרי) — סינון לפי קטגוריה: הכל / פרויקטים / מסמכים / תרשימים / קבצים
- אזור תוצאות (פאנל מתחת) שמציג עד ~20 תוצאות תואמות, כל אחת `Link` ליעד המתאים, עם אייקון + כותרת + סוג + תאריך
- מציאת נתונים דרך `useServerFn` ל-`listSpecs`, `listDiagrams`, `listDocuments`, `listProjects` (כולם כבר קיימים, בשימוש ב-`documents.tsx` ו-`global-command-palette.tsx`)
- שאילתות `useQuery` עם אותם `queryKey` קיימים כדי לנצל מטמון משותף

### `src/routes/_authenticated.tsx`
- הוספת state מקומי `searchOpen` ב-`AuthenticatedLayout`
- בשורה הראשונה (`flex ... [direction:rtl]`) — הוספת אייקון `Search` כ-`Button` ב`variant="ghost" size="icon"` עם `mr-auto` (כלומר בקצה השני בגלל RTL) שמחליף את `searchOpen`
- כאשר `searchOpen=true` — רנדור `<GlobalSearchBar />` בשורה חדשה בין שורת הלוגו לשורת הטאבים (Workflow/Kanban/Rocket)
- סגירה אוטומטית בעת ניווט (תוך שימוש ב-`useLocation` שכבר קיים)

## הערות

- אין שינוי ב-`CommandTriggerButton` / `GlobalCommandPalette` הקיימים — נשארים פעילים (Cmd+K).
- מטמון נתונים משותף עם `documents.tsx` כך שלא נשלחות בקשות כפולות.
- ה-UI של כפתורי המיון/סינון נבנה במדויק לפי המראה ב-`documents.tsx` (אותם וריאנטים, גדלים, אייקונים, badges).
- מובייל: ה-Sheet של הסינון נפתח מלמטה (`side="bottom"`) — זהה ל-documents.
