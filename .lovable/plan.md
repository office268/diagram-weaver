שינויי frontend בלבד; אין נגיעה ב-backend/DB.

## 8 — Drag & drop לסידור סעיפים בעורך
`src/routes/_authenticated/editor.$id.tsx`
- התקנת `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (סטנדרט React, נגיש כולל מקלדת ו-touch).
- עטיפת רשימת הסעיפים ב-`DndContext` + `SortableContext` (אסטרטגיה אנכית; פריטים = `visibleSections`).
- wrapper `SortableSection` שמשתמש ב-`useSortable(key)` ומעביר drag-handle (`GripVertical`) ל-`SectionShell`. ה-handle ישולב משמאל לחיצים הקיימים, שיישארו כ-fallback נגיש.
- ב-`onDragEnd` עדכון `sectionOrder` — autosave הקיים יתפוס את השינוי.
- `PointerSensor` עם `activationConstraint: { distance: 5 }` כדי שלא יתנגש בקליק על הכותרת/חצים; `KeyboardSensor` לנגישות.

## 11 — חיפוש וסינון
### דף הפרויקטים — `src/routes/_authenticated/projects.index.tsx`
- שדה חיפוש (`Input` + אייקון `Search`) מעל הרשת.
- סינון client-side לפי `name`/`description` (case-insensitive).
- empty state מותאם כשהשאילתה לא תואמת לאף פרויקט.

### בתוך פרויקט — `src/routes/_authenticated/projects.$projectId.tsx`
- שדה חיפוש בראש רשימת המסמכים.
- סינון client-side ברמת קבוצה לפי `title`/`prompt`/label של סוג המסמך. קבוצה תוצג אם פריט בה תואם.
- סקציות של סוגי מסמכים שריקות אחרי סינון מוסתרות.

## 12 — Skeleton loading
שימוש ברכיב הקיים `@/components/ui/skeleton.tsx`. החלפת ה-`Loader2` המרוכז של טעינה ראשונית בלבד; `Loader2` של פעולות חיות (שמירה/יצירה/inline) נשארים.
- `projects.index.tsx`: grid של 6 שלדי-כרטיס.
- `projects.$projectId.tsx`: 2–3 שלדי סקציה (כותרת + שתי שורות).
- `editor.$id.tsx`: שלד toolbar + 4 שלדי סעיפים (כותרת + תוכן).

## 13 — Undo למחיקת סעיף בעורך
`src/routes/_authenticated/editor.$id.tsx`
- ב-`deleteSection`: לשמור snapshot `(key, index)` ולהציג `toast.success("הסעיף נמחק", { action: { label: "בטל", onClick: restore } })`.
- `restore` מחזיר את המפתח ל-`sectionOrder` באותו אינדקס (`splice`). אם בינתיים השתנה — fallback להוספה לסוף. הגנה מפני כפילות.
- משך toast = 8 שניות.
- אין צורך בשחזור תוכן: הסרת מפתח מהסדר אינה מאפסת את `content`/`sectionTitles`.

## טכני
- תלות חדשה: `@dnd-kit/core@^6`, `@dnd-kit/sortable@^8`, `@dnd-kit/utilities@^3`.
- שלדים בנויים מ-tailwind classes על הרכיב הקיים — בלי שינוי `styles.css`.
- אין שינויי schema, server functions או routing.
- אימות חזותי בעורך לאחר ההטמעה (drag handle, skeletons, undo toast).
