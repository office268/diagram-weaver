## מטרה
החלפת ה-Toast "ניהול פרויקט — בקרוב" בניווט אמיתי לעמוד `/projects-management` עם תפזורת מילים בסגנון של עמוד ניהול מוצר.

## שינויים

### 1. עמוד חדש `src/routes/_authenticated/projects-management.tsx`
- מבנה זהה ל-`product.tsx`: רקע radial-gradient, כותרת עליונה ("ניהול פרויקטים — בקרוב כלים ייעודיים"), ואזור תפזורת מרכזי.
- מילים (חשיבות → גודל, זוויות מגוונות):

| מילה | גודל | זווית/מיקום |
|---|---|---|
| Gantt | text-8xl/9xl (מרכז, מודגש) | -2° |
| Timeline | text-7xl | -10°, שמאל-עליון |
| Milestone | text-6xl | 8°, ימין-עליון |
| Scope | text-5xl/6xl | -90° (אנכי, שמאל) |
| Risk Management | text-5xl | 90° (אנכי, ימין) |
| Resource Allocation | text-5xl/6xl | 12°, תחתון-שמאל |
| Velocity | text-6xl italic | -8°, תחתון-מרכז |
| Bottleneck | text-4xl/5xl | 18°, תחתון-ימין |
| Dependency | text-3xl/4xl light/italic | -14°, מעל המרכז |

- הופעת "Bottleneck" ו-"Dependency" כפולה ברשימת המשתמש — אציג כל אחת פעם אחת בלבד (אין ערך ויזואלי בכפילות + נמנע מ-DOM duplicates).
- font-serif, opacity ו-italic מעורבים לעומק; אנימציית `animate-fade-in` עם delays.
- responsive: גדלים קטנים יותר ב-sm/md viewport (384px).

### 2. עדכון `src/routes/_authenticated.tsx`
- שורות 73-80: החלפת ה-`<button onClick={toast.info(...)}>` של ניהול פרויקטים ב-`<Link to="/projects-management">` (אותו עיצוב), כולל הדגשת active (`location.pathname.startsWith("/projects-management")`).
- ניקוי import של `toast` אם אינו בשימוש נוסף.

## לא נוגעים
- backend / DB / auth — ללא שינוי.
- כפתורים אחרים נשארים.

## הערה
שם הroute הוא `/projects-management` (ולא `/projects`) כדי לא להתנגש עם `/projects/$projectId` ו-`/projects` הקיימים תחת `_authenticated/projects.*`.
