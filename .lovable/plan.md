
## מטרה
החלפת ה-Toast "ניהול מוצר — בקרוב" בניווט אמיתי לעמוד `/product` שבו תוצג תפזורת מילים מעוצבת עד שיהיו הכלים בפועל.

## שינויים

### 1. עמוד חדש `src/routes/_authenticated/product.tsx`
- `createFileRoute("/_authenticated/product")` עם `head()` (כותרת + תיאור).
- מסך מלא (`min-h-[calc(100vh-...)]`) עם רקע עדין (gradient מ-`--background` ל-`--muted`).
- כותרת קטנה למעלה: "ניהול מוצר — בקרוב כלים ייעודיים".
- מתחתיה אזור מרכזי שמציג תפזורת של 6 מילים:

| מילה | גודל יחסי (חשיבות) | זווית |
|---|---|---|
| User Journey | text-7xl/8xl | -12° |
| KPIs | text-6xl | 90° (אנכי) |
| Persona | text-7xl | 8° |
| Backlog | text-5xl | -90° |
| Roadmap | text-8xl | 0° (אופקי, מודגש) |
| MVP | text-6xl | 25° |

- מיקום ע"י `absolute` בתוך container `relative` עם אחוזים (top/left), כך שזה רספונסיבי. בנייד נצמצם גדלים (`text-3xl`–`text-6xl`).
- צבעים מה-design tokens בלבד (`text-primary`, `text-foreground`, `text-muted-foreground`, `text-accent-foreground`) ברמות `opacity` שונות כדי להוסיף עומק.
- פונט: `font-serif`/`font-bold`/`tracking-tight` משולב — חלק `italic` להבדל ויזואלי.
- אנימציית כניסה עדינה (`animate-in fade-in` + `slide-in` עם delays שונים) ללא תלות בספריות חדשות.

### 2. עדכון `src/routes/_authenticated.tsx`
- שורה 73-80: להחליף את ה-`<button onClick={toast.info(...)}>` ב-`<Link to="/product">` עם אותו עיצוב, ולהוסיף הדגשת active דומה לזו של "ניתוח מערכות" (`isProduct = location.pathname.startsWith("/product")`).
- להסיר `Rocket` מהשורות אם לא נחוץ — להשאיר את האייקון.

### לא נוגעים
- כפתור "ניהול פרויקט" נשאר עם ה-Toast (לא נתבקש).
- אין שינוי backend / DB / auth.

## פרטים טכניים
- אין תלות חדשה.
- שימוש ב-Tailwind בלבד עבור rotation (`rotate-[-12deg]`, `[writing-mode:vertical-rl]` למילים אנכיות) — כל הזוויות דרך arbitrary values.
- responsive: בreakpoint `sm`/`md` נחליף גדלים ומיקומים כדי שלא ייחתך בנייד (384px viewport נוכחי).
