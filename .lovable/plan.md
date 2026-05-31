# שיפורי ניווט וארגון

מימוש 4 ההצעות מקטגוריית "ניווט וארגון".

---

## 5. Breadcrumbs בכל דפי האפליקציה

**מצב נוכחי:** ב-editor כבר יש Breadcrumbs (Projects › Project › Doc). חסר בדפי הפרויקטים.

**ליישם:**
- `projects.$projectId.tsx` — להחליף את ה-back-link הקיים בקומפוננטת `Breadcrumb` (פרויקטים › שם פרויקט).
- `settings.tsx` ו-`dashboard.tsx` — Breadcrumbs קצרים בראש הדף.
- ליצור קומפוננטה `src/components/app-breadcrumb.tsx` שמקבלת `items` ומציגה אחיד.

## 6. Command Palette גלובלי (Cmd+K מכל מקום)

**מצב נוכחי:** ב-editor בלבד, רק לחיפוש סעיפים.

**ליישם:**
- ליצור `src/components/global-command-palette.tsx` שמרכיב `CommandDialog` מ-shadcn.
- להוסיף ל-`_authenticated.tsx` (layout) — listener ל-`Cmd/Ctrl+K`, ניהול state, ו-rendering.
- תוכן ה-palette:
  - **פרויקטים** — שולף מ-`useQuery(["projects"])`, ניווט ל-`/projects/$projectId`.
  - **מסמכים אחרונים** — שאילתה חדשה `listRecentDocs` (top 10 לפי `updated_at`), ניווט ל-`/editor/$id`.
  - **פעולות** — "פרויקט חדש", "הגדרות", "החלף ערכה" (theme toggle).
- ב-editor: ה-Cmd+K המקומי הופך לסגמנט נוסף ב-palette הגלובלי כשעורכים מסמך (חיפוש סעיפים בקובץ הנוכחי), או נשאר נפרד כ-`Cmd+/`. **החלטה:** נאחד — אם נמצאים ב-editor, ה-palette יציג גם section "סעיפים במסמך זה".
- כפתור עזר ב-header: "🔍 חיפוש (Cmd+K)" כ-affordance ויזואלי.

## 7. Recent items בדרופ-דאון מה-header

**ליישם:**
- ליצור `src/components/recent-items-menu.tsx` — `DropdownMenu` עם `Clock` icon ב-header.
- מציג top 5 מסמכים אחרונים + top 3 פרויקטים אחרונים.
- מקור נתונים: server fn חדש `listRecentItems` שמחזיר `{ docs: [...], projects: [...] }` (top 5+3 לפי `updated_at`).
- שינוי קל ב-header של `_authenticated.tsx` להוספת הכפתור לפני ThemeToggle.

## 8. Pinned projects

**שינוי DB (migration):**
- הוספת עמודה `pinned_at timestamptz NULL` לטבלת `projects`.
- אינדקס חלקי `(user_id, pinned_at DESC NULLS LAST)`.

**Server functions:**
- עדכון `listProjects` להחזיר `pinned_at` ולסדר: `pinned_at DESC NULLS LAST, updated_at DESC`.
- פעולה חדשה `toggleProjectPin({ id, pinned })` שמעדכנת `pinned_at = now() | null`.

**UI ב-`projects.index.tsx`:**
- כפתור Pin/PinOff בכל כרטיס פרויקט (פינה — ליד Trash).
- מצב מוצמד: ribbon קטן "מוצמד" עם אייקון Pin בצבע primary בראש הכרטיס.
- חלוקה ויזואלית: אם יש פרויקטים מוצמדים, להציג section "מוצמדים" מעל ה-section הרגיל "כל הפרויקטים".

---

## פירוט טכני

**קבצים חדשים:**
- `src/components/app-breadcrumb.tsx`
- `src/components/global-command-palette.tsx`
- `src/components/recent-items-menu.tsx`
- `src/lib/recent.functions.ts` — `listRecentItems`
- migration SQL לעמודת `pinned_at`

**קבצים שיתעדכנו:**
- `src/lib/project.functions.ts` — `listProjects` (select `pinned_at`, ordering), `toggleProjectPin` חדש
- `src/routes/_authenticated.tsx` — Cmd+K global, RecentItemsMenu בheader
- `src/routes/_authenticated/projects.index.tsx` — Pin button, sections (מוצמדים / כללי), Breadcrumb
- `src/routes/_authenticated/projects.$projectId.tsx` — Breadcrumb במקום back-link
- `src/routes/_authenticated/settings.tsx` — Breadcrumb
- `src/routes/_authenticated/dashboard.tsx` — Breadcrumb
- `src/routes/_authenticated/editor.$id.tsx` — להסיר את ה-Cmd+K המקומי (יוצא לגלובלי), או להשאיר את חיפוש הסעיפים בטריגר אחר

**עיצוב:**
- Breadcrumbs: שימוש בקומפוננטת `Breadcrumb` הקיימת מ-shadcn, RTL-friendly (ChevronLeft כמפריד).
- Pinned ribbon: badge עם `bg-primary/10 text-primary` ואייקון `Pin`.
- Command palette: רקע `bg-popover`, חיפוש fuzzy, קיצורי דרך מוצגים מימין.

**עקרונות:**
- אין שינוי בלוגיקה עסקית של ה-AI / generation.
- כל ה-RLS policies על `projects` כבר מכסות את עמודת `pinned_at` (USING user_id).
- אין breaking changes ל-API קיים (רק תוספות).

**אימות:**
- מובייל: Cmd+K הופך לכפתור חיפוש visible (touch).
- Breadcrumbs מתקצרים במובייל (מציגים רק ההורה הקרוב + הדף הנוכחי).
- Pin/Unpin עם optimistic update + invalidate.
