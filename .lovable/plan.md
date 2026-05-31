# שיפורים ויזואליים וחווייתיים

מימוש 4 ההצעות מקטגוריית "ויזואלי וחווייתי" באופן רוחבי, ללא שינוי לוגיקה עסקית.

---

## 1. Empty States מאוירים

**איפה:**
- `projects.index.tsx` — כשאין פרויקטים
- `projects.$projectId.tsx` — כשאין מסמכים בפרויקט
- `editor.$id.tsx` — סעיפים ריקים / אין הצעות AI

**איך:**
- ליצור קומפוננטה משותפת `src/components/empty-state.tsx` עם props: `icon`, `title`, `description`, `action`.
- שימוש באייקוני Lucide גדולים (size 48-64) עטופים במעגל עם רקע `bg-muted/50` ו-`text-muted-foreground`.
- מתחת: כותרת + תיאור קצר + כפתור CTA primary.
- אנימציית כניסה: `animate-fade-in`.

## 2. Skeleton Loaders

**איפה (להחליף `Loader2` / `animate-spin`):**
- `projects.index.tsx` — רשת של 6 skeleton cards
- `projects.$projectId.tsx` — רשימת skeleton items למסמכים
- `editor.$id.tsx` — skeleton למבנה הסעיפים (כותרת + 3 שורות)
- `review-suggestions-panel.tsx` — skeleton להצעות

**איך:**
- שימוש בקומפוננטת `Skeleton` הקיימת מ-shadcn (`@/components/ui/skeleton`).
- ליצור 2 קומפוננטות עזר: `src/components/skeletons/project-card-skeleton.tsx` ו-`document-row-skeleton.tsx`.
- להציג בזמן `isLoading` במקום ספינר.

## 3. Micro-interactions

**איפה:**
- כרטיסי פרויקט (`projects.index.tsx`) ומסמך (`projects.$projectId.tsx`)
- כפתורי פעולה ראשיים
- פריטי רשימה (סעיפים בעורך, הצעות review)

**איך:**
- כרטיסים: להוסיף `transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30`.
- כפתורים: כבר יש transitions ב-shadcn; להוסיף `active:scale-95` ל-CTAs ראשיים.
- פריטי רשימה: `transition-colors hover:bg-accent/50`.
- מעברים בין מצבים (פתיחת popover/dialog): כבר מטופל ע"י Radix; לוודא `animate-in fade-in-0 zoom-in-95`.
- אנימציות כניסה לרשימות: `animate-fade-in` על כרטיסים עם `style={{ animationDelay: ${i * 50}ms }}` עד 6 פריטים.

## 4. Gradient Accents

**איפה:**
- כפתורי primary CTA ראשיים (יצירת פרויקט/מסמך, "בנה איתי")
- כותרת hero בלנדינג (`index.tsx`)
- Header של דפי פרויקט/עורך

**איך:**
- להוסיף ל-`src/styles.css` תחת `@theme`:
  - `--gradient-primary: linear-gradient(135deg, oklch(from var(--primary) l c h), oklch(from var(--primary) calc(l + 0.08) c calc(h + 20)))`
  - `--gradient-subtle: linear-gradient(180deg, oklch(from var(--background) l c h), oklch(from var(--muted) l c h))`
- ליצור variant חדש `premium` בכפתור (או class utility `.btn-gradient`): `bg-[image:var(--gradient-primary)] text-primary-foreground shadow-md hover:shadow-lg hover:brightness-110`.
- כותרת hero בלנדינג: `bg-gradient-to-l from-primary via-primary to-primary/70 bg-clip-text text-transparent` (RTL-friendly).
- רקע hero: שכבת `bg-[image:var(--gradient-subtle)]` עדינה.

---

## פירוט טכני

**קבצים שייווצרו:**
- `src/components/empty-state.tsx`
- `src/components/skeletons/project-card-skeleton.tsx`
- `src/components/skeletons/document-row-skeleton.tsx`

**קבצים שיתעדכנו:**
- `src/styles.css` — gradient tokens
- `src/components/ui/button.tsx` — variant `gradient` (אופציונלי, אם לא — class utility)
- `src/routes/index.tsx` — gradient hero
- `src/routes/_authenticated/projects.index.tsx` — empty state, skeletons, hover micro-interactions, stagger
- `src/routes/_authenticated/projects.$projectId.tsx` — אותו דבר למסמכים
- `src/routes/_authenticated/editor.$id.tsx` — skeleton למבנה + hover עדין לסעיפים
- `src/components/review-suggestions-panel.tsx` — skeleton להצעות

**עקרונות:**
- שימוש בטוקנים סמנטיים בלבד (אין צבעים hardcoded).
- כל האנימציות עד 300ms, `ease-out`.
- תמיכה מלאה ב-RTL וב-dark mode (gradients משתמשים בטוקני oklch).
- אין שינוי בלוגיקה עסקית / API / DB.

**אימות:**
- בדיקה במובייל (384px) ובדסקטופ.
- וידוא ש-skeletons תואמים את הגובה האמיתי (אין layout shift).
- בדיקת ניגודיות gradient text במצב כהה ובהיר.
