## מטרה
בתוצאות חיפוש הגלובלי, כל פריט יציג: **שם · סוג · תאריך · נתיב היררכי (מוצר ◂ פרויקט ◂ פריט) · מחבר**.

## שינויים

### 1) שרת — העשרת רשימות הקריאה
מוסיפים לכל אחת מהפונקציות `join`/lookup ל-`profiles.display_name` (מחבר) ולשרשרת ההיררכיה (project → product):

- `src/lib/spec.functions.ts` · `listSpecs`
  - בנוסף לעמודות הקיימות, להחזיר: `project_id`, `user_id`, ולעשות join: `projects:project_id ( name, products:product_id ( name ) )`, `profile:profiles!spec_documents_user_id_fkey ( display_name )`.
- `src/lib/diagrams.functions.ts` · `listDiagrams`
  - להחזיר `user_id`, `kind`, ו-join ל-`profile`. (לתרשימים אין `project_id` בסכמה — הנתיב יוצג רק עם המחבר; אם יש קשר ל-`chat_threads` עם project, ניגש דרכו רק אם קיים. אחרת — מציגים "—" בנתיב.)
- `src/lib/documents.functions.ts` · `listDocuments`
  - להוסיף join ל-project→product ולפרופיל.
- `src/lib/project.functions.ts` · `listProjects`
  - להוסיף join למוצר ולפרופיל של היוצר.

לכל ה-joins משתמשים ב-`requireSupabaseAuth` הקיים — RLS ממשיכה לחול. לפרופילים מספיק `display_name` כדי לא לחשוף שדות רגישים.

### 2) קליינט — `src/components/global-search-bar.tsx`
- להרחיב את ה-type `Item` עם: `path?: string`, `author?: string`.
- בעת בניית `items`, להרכיב:
  - `project`: `path = product?.name ?? "—"`, `author = profile.display_name`.
  - `document` (spec): `path = [product?.name, project?.name].filter(Boolean).join(" ◂ ")`, `author = profile.display_name`.
  - `diagram`: `path = "—"` (אין לו project ישיר), `author = profile.display_name`. (אם בעתיד נוסיף קשר — נעדכן.)
  - `upload`: `path = [product?.name, project?.name].filter(Boolean).join(" ◂ ")`, `author = profile.display_name`.
- בעיצוב כל שורת תוצאה, להחליף את שורת המטא הקיימת בשורה אחת קומפקטית:
  - `סוג · תאריך · נתיב · מאת מחבר`, עם מפרידי `·`, חיתוך טקסט (`truncate`), ו-`title` לטולטיפ לנתיב.
  - אייקון/צבע הקטגוריה נשמרים כמו היום.

### 3) ללא שינוי במודל הנתונים
לא נוספים שדות לטבלאות; משתמשים רק ב-joins דרך Supabase Client.

## טכני — דוגמת select
```ts
supabase.from("spec_documents").select(
  "id, title, created_at, doc_type, user_id, " +
  "project:projects!spec_documents_project_id_fkey ( name, product:products!projects_product_id_fkey ( name ) ), " +
  "author:profiles!spec_documents_user_id_fkey ( display_name )"
)
```
(שמות ה-FK יותאמו לסכמה בפועל; אם relation לא קיים, נשתמש ב-`projects(name, products(name))` בלי alias מפורש.)

## QA
לאחר השינוי, לרענן את החיפוש בדפדפן ולוודא שכל פריט מציג חמישה שדות בשורה אחת, בלי להישבר ב-RTL. אם פרופיל חסר — להציג "—".
