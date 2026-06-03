
## מטרה
להוסיף כפתור שלישי בשורת החיפוש/מיון/סינון. לחיצה עליו תפתח פאנל נשלף מהצד (Sheet) המאפשר לדפדף בהיררכיה: **מוצרים של הארגון → פרויקטים של המוצר → מסמכים/תרשימים של הפרויקט**.

מכיוון שכרגע אין במערכת ישות "מוצר" שמקבצת פרויקטים (הדף `/product` הוא תוכן סטטי לא קשור), נוסיף ישות חדשה במסד הנתונים.

## שינויי מסד נתונים

טבלה חדשה `public.products`:
- `id` (uuid)
- `org_id` (uuid, FK ל-`organizations`, NOT NULL)
- `name` (text, NOT NULL)
- `description` (text)
- `created_by` (uuid), `created_at`, `updated_at`

שינוי בטבלת `projects`:
- הוספת עמודה `product_id uuid` (nullable, FK ל-`products` עם `ON DELETE SET NULL`) — פרויקטים קיימים יישארו ללא מוצר משויך.

הרשאות / RLS:
- `GRANT` ל-`authenticated` ו-`service_role`.
- RLS על `products`: חברי הארגון (`is_org_member`) רואים; owner/admin של הארגון יוצרים/עורכים/מוחקים.
- אינדקסים: `products(org_id)`, `projects(product_id)`.

## שרת (Server Functions)

קובץ חדש `src/lib/products.functions.ts`:
- `listProducts({ orgId })` — מחזיר מוצרים של הארגון + ספירת פרויקטים לכל מוצר.
- `createProduct`, `updateProduct`, `deleteProduct` (לבעלי הרשאה בארגון).
- `getProduct({ id })` — פרטי מוצר + רשימת פרויקטים שלו.

עדכון `src/lib/project.functions.ts`:
- ל-`listProjects` הוספת פרמטר אופציונלי `productId` לסינון.
- ל-`createProject`/`updateProject` הוספת שדה אופציונלי `product_id`.

## ממשק (UI)

ב-`src/routes/_authenticated.tsx`, בשורה השנייה ליד כפתורי חיפוש/מיון/סינון, נוסיף `Button` חדש עם אייקון `Package` (lucide). לחיצה פותחת `<Sheet side="right">` (במובייל יתאים מ-RTL) חדש.

קומפוננטה חדשה `src/components/products-browser-sheet.tsx`:
- ניהול state פנימי של רמה נוכחית: `"products" | "projects" | "items"`.
- מצב נוכחי שומר `selectedProduct` ו-`selectedProject`.
- כותרת עם breadcrumbs קליקבילי לחזרה אחורה (חץ "חזרה" + שם הרמה האב).
- **רמה 1 — מוצרים**: רשימת מוצרים של הארגון הנוכחי (`useCurrentOrganization` + `listProducts`). ריק → empty state עם CTA "צור מוצר" (לבעלי הרשאה). לחיצה על שורה → רמה 2.
- **רמה 2 — פרויקטים**: רשימת פרויקטים של המוצר. לחיצה על שורה → רמה 3.
- **רמה 3 — מסמכים/תרשימים**: שימוש ב-`getProject` שכבר מחזיר `specs` (מסמכים/תרשימים לפי `doc_type`). כל פריט הוא `<Link to="/editor/$id">` שסוגר את ה-Sheet.

יצירת מוצר/הוספת פרויקט למוצר נוספות בהמשך — בשלב זה רק יצירה בסיסית של מוצר (כפתור "+ מוצר חדש" בראש רשימת המוצרים, dialog פשוט עם שם ותיאור).

## פרטים טכניים

- TanStack Query: `useQuery` עם `queryKey: ["products", orgId]`, `["product", productId]`.
- ניווט: שימוש ב-`Link` של TanStack לפריטי המסמך (קיים route `/_authenticated/editor/$id`).
- שיוך פרויקט קיים למוצר אינו כלול בשלב זה; אם תרצה — נוסיף בהמשך כפתור "שייך פרויקט" בתוך תצוגת המוצר.

## קבצים שיושפעו
- חדש: migration ל-`products` + עמודה ב-`projects`
- חדש: `src/lib/products.functions.ts`
- חדש: `src/components/products-browser-sheet.tsx`
- שינוי: `src/lib/project.functions.ts` (פרמטר `productId`)
- שינוי: `src/routes/_authenticated.tsx` (כפתור חדש בשורה השנייה)
