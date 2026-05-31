## מטרה
לעבור ממודל "רשימת מסמכים שטוחה" למודל **פרויקטים**: המשתמש פותח פרויקט, ובתוכו יוצר ומנהל את כל סוגי המסמכים (BRD, TRD, ייזום, HLD, LLD) ואת כל הגרסאות (variants/group_id) של כל מסמך.

## מבנה היררכי חדש

```text
User
└── Project (חדש)
    └── Document by type (BRD / TRD / Initiation / HLD / LLD)
        └── Versions (group_id + variant — קיים)
```

## שינויי DB

טבלה חדשה `projects`:
- `id`, `user_id`, `name`, `description`, `created_at`, `updated_at`
- RLS: המשתמש רואה/עורך/מוחק רק פרויקטים שלו
- GRANT ל-authenticated ו-service_role

עדכון `spec_documents`:
- הוספת עמודה `project_id uuid` (nullable בהתחלה לתאימות לאחור; מסמכים קיימים יועברו ל-"פרויקט ברירת מחדל" אוטומטית עבור כל משתמש במיגרציה)
- אינדקס על `(project_id, doc_type, group_id)`

## שינויי UI/ניווט

**מסלולים חדשים** תחת `_authenticated`:
- `/projects` — רשימת הפרויקטים של המשתמש + כפתור "פרויקט חדש"
- `/projects/$projectId` — מסך הפרויקט: מציג את 5 סוגי המסמכים ככרטיסים. לכל סוג מוצגות הגרסאות הקיימות (group_id) + כפתור "צור מסמך מסוג זה"
- `/projects/$projectId/$docType` — מסך מפורט לסוג מסמך בתוך הפרויקט: רשימת כל הקבוצות (group_id) + הגרסאות (variant) של כל קבוצה, עם מעבר לעורך

**שינויים בקיים**:
- `dashboard.tsx` הופך לעמוד פרויקטים (או redirect ל-`/projects`)
- דיאלוג בחירת סוג מסמך נשאר — אבל נפתח מתוך מסך הפרויקט במקום מהדשבורד הכללי, ויוצר מסמך עם `project_id` משויך
- `editor.$id.tsx` מקבל breadcrumb: פרויקט → סוג מסמך → גרסה

## שינויי קוד שרת

`src/lib/project.functions.ts` (חדש):
- `listProjects`, `createProject`, `updateProject`, `deleteProject`, `getProject` (כולל aggregation של מסמכים מקובצים לפי `doc_type` ו-`group_id`)

`src/lib/spec.functions.ts`:
- `createSpec` מקבל `projectId` ושומר אותו
- `listSpecs` מסונן לפי `projectId`
- מחיקת פרויקט = cascade למסמכים שלו (או חסימה אם יש מסמכים — נחליט: **cascade** עם אישור)

`src/routes/api/generate-spec.ts`:
- ללא שינוי לוגי, רק מעביר `project_id` כשיוצר ספק חדש

## מיגרציית נתונים קיימים

עבור כל משתמש שיש לו מסמכים ללא `project_id` — ייווצר פרויקט "המסמכים שלי" ויקושר אליהם. אחרי המיגרציה ניתן להפוך את `project_id` ל-NOT NULL בשלב הבא.

## נקודות לבירור (אם רלוונטי)

1. שם ברירת מחדל לפרויקט אוטומטי — "המסמכים שלי" — בסדר?
2. מחיקת פרויקט: cascade למסמכים, נכון?
3. שדות נוספים בפרויקט (תאריך יעד, סטטוס, תגיות) — מחוץ להיקף הנוכחי?
