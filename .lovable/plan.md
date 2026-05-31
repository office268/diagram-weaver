תיקון ארבעה פריטים מסקירת ה-UX. שינויי frontend בלבד, ללא נגיעה ב-backend/DB.

## 2 — חץ "חזרה" בכיוון נכון ל-RTL
`src/routes/_authenticated/editor.$id.tsx`
- ייבוא `ArrowRight` במקום `ArrowLeft`.
- ה-icon יוטמע בתוך ה-Breadcrumb החדש (סעיף 5) ולא ככפתור נפרד.

## 4 — כפתורי מחיקה גלויים במובייל
החלפת `opacity-0 group-hover:opacity-100` ב-`opacity-100 sm:opacity-0 sm:group-hover:opacity-100` — גלוי תמיד במובייל, hover-only בדסקטופ.
- `src/routes/_authenticated/projects.$projectId.tsx`: 2 מקומות (כפתור מחיקת מסמך בודד, וכפתור מחיקת איטרציה בתוך קבוצה).
- `src/components/editable-text.tsx`: כפתור העיפרון.

## 5 — Breadcrumbs בעורך
`src/routes/_authenticated/editor.$id.tsx`
- החלפת כפתור "חזרה" בסרגל הכלים ברכיב `Breadcrumb` הקיים מ-shadcn.
- מבנה: `פרויקטים` → `{שם הפרויקט}` → `{אייקון סוג מסמך} {כותרת מקוצרת}`.
- שליפת שם הפרויקט עם `useQuery(["project", spec.project_id], getProject)` כאשר קיים `project_id`; אחרת fallback ל-`פרויקטים → {כותרת}`.
- separator מותאם RTL (חץ פונה שמאלה).
- במובייל: הצגת חוליה ראשונה + ellipsis + חוליה אחרונה כדי לחסוך רוחב.

## 7 — אייקון וצבע ייחודיים לכל סוג מסמך
`src/lib/doc-types.ts` — להוסיף `DOC_TYPE_VISUALS` ופונקציית `getDocTypeVisual(key)`:

```text
business_requirements  → Briefcase     amber
technical_requirements → Cpu           sky
initiation             → Rocket        violet
spec_overview          → LayoutTemplate primary
spec_detailed          → FileCode2     emerald
```

החלפת `FileText` הקבוע ב-4 המקומות ב-`projects.$projectId.tsx` (כותרת סקציית סוג, פריט בודד, פריט בקבוצה, ב-type picker) באייקון הדינמי לפי `typeKey`/`doc_type`.
שימוש באייקון גם בתוך ה-Breadcrumb בעורך.
ה-empty state נשאר עם `FileText` גנרי.

## טכני
- אין שינוי schema/migrations/server functions.
- `getProject` הקיים מספיק לשם הפרויקט בעורך.
- צבעי אייקונים: tailwind utility colors בסגנון שכבר בשימוש בפרויקט; שאר הטוקנים נשארים semantic.
