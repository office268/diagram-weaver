## הוספת שם ארגון ליד אייקון המשתמש

הצגת שם הארגון של המשתמש המחובר ליד האייקון העגול בשורה העליונה של ה-header, עם תשתית רב-ארגונית (multi-tenant) מלאה.

### שלב 1 — תשתית נתונים (DB)

טבלאות חדשות:
- `organizations` — `id`, `name`, `slug`, `created_at`
- `organization_members` — `org_id`, `user_id`, `role` (owner/admin/member), `created_at`, unique(org_id, user_id)

כל טבלה תקבל RLS + GRANTs מתאימים. פונקציית `has_org_role(_user_id, _org_id, _role)` בסגנון SECURITY DEFINER לבדיקות הרשאה (כמו `has_role` הקיים), כדי למנוע רקורסיה ב-RLS.

Seed: יצירת ארגון "עיר דוד" וצירוף המשתמש הנוכחי כ-owner, כדי שיהיה מה להציג מיד.

### שלב 2 — שליפה בצד שרת

`src/lib/organizations.functions.ts` עם server function `getCurrentOrganization` (משתמש ב-`requireSupabaseAuth`) שמחזירה את הארגון הראשי של המשתמש המחובר (או את הארגון הפעיל, ראה שלב 4).

### שלב 3 — Hook ותצוגה ב-header

- `src/hooks/use-current-organization.ts` — עוטף את ה-server function עם `useQuery`.
- ב-`src/routes/_authenticated.tsx`, בשורה העליונה (זו שמכילה כרגע את `UserMenu`), להוסיף ליד האייקון `<span>` עם שם הארגון. סטיילינג עדין (טקסט קטן, `text-muted-foreground` או `font-medium`), עם skeleton בזמן טעינה ו-fallback ריק אם אין ארגון.

### שלב 4 — מוכנות לריבוי ארגונים

- אם למשתמש יש יותר מארגון אחד, שם הארגון הופך לכפתור שפותח dropdown לבחירת ארגון פעיל.
- הארגון הפעיל נשמר ב-`localStorage` (`active_org_id`) ומסונכרן ב-context קל (`OrganizationProvider`) כדי שכל ה-app יוכל לקרוא אותו.
- ה-server functions העתידיות יקבלו `orgId` מהקליינט (או יקראו את ברירת המחדל מה-DB) — כך כל שאילתת נתונים תהיה תחומה לארגון.

בשלב הראשון יוצג רק שם, ללא dropdown, כי יש ארגון אחד בלבד. ה-context וה-hook יהיו מוכנים להרחבה.

### פרטים טכניים

מיקום ב-header (RTL, השורה העליונה):
```text
[ אייקון משתמש ]  עיר דוד
```
שני האלמנטים בתוך אותו `<div>` עם `gap-2` ו-`items-center`. ה-`UserMenu` נשאר כמו שהוא; שם הארגון מוצג כ-`<span>` נפרד מימינו (בפועל משמאלו ויזואלית ב-RTL... לפי הצד הנוכחי).

ללא שינוי ב-`UserMenu` עצמו, ללא שינוי בעיצוב הכרטיסים בפנים. ההוספה מינימלית ולא נוגעת בלוגיקת התפריט.
