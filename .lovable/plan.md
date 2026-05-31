# מימוש שיפורי מובייל (16–18)

כל השינויים frontend בלבד, ללא DB ו-ללא server functions חדשים. מותאם לעיצוב הקיים (semantic tokens מ-`src/styles.css`).

## 16 — Bottom Navigation במובייל

יצירת `src/components/mobile-bottom-nav.tsx` עם bar קבוע בתחתית שמוצג רק במובייל (`md:hidden`).

- מבנה: `fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur` עם `safe-area-inset-bottom` ו-`pb-[env(safe-area-inset-bottom)]`.
- 4 כפתורים שווי-רוחב: **פרויקטים** (`Folder`), **חיפוש** (`Search` — פותח Cmd+K), **אחרונים** (`Clock` — פותח sheet), **הגדרות** (`Settings`).
- מצב פעיל לפי `useRouterState({ select: s => s.location.pathname })` עם `text-primary` ו-bar עליון דק.
- כל פריט: `flex flex-col items-center gap-0.5 py-2 text-[10px]` + אייקון 20px.

ב-`src/routes/_authenticated.tsx`:
- מוסיפים `<MobileBottomNav />` מתחת ל-`<Outlet />`.
- ב-`<main>` מוסיפים `pb-16 md:pb-0` כדי שתוכן לא יוסתר.
- ב-header: מסתירים `<CommandTriggerButton />` ו-`<RecentItemsMenu />` במובייל (`hidden md:inline-flex` סביב ה-wrapper שלהם) כי הם כבר ב-bottom nav.
- ה-footer מוסתר במובייל (`hidden md:block`) — bottom nav תופס את התפקיד.

## 17 — Swipe Actions ברשימות

יצירת `src/components/swipeable-row.tsx` — wrapper גנרי עם touch handlers:

- state פנימי `dragX`, מאזין ל-`onTouchStart/Move/End`.
- swipe שמאלה (>72px) חושף כפתור destructive אדום ברוחב 80px בצד שמאל (RTL — `left-0`).
- threshold מלא (>140px) → קורא ל-`onDelete()` של ה-prop ומתאפס.
- אנימציה: `transform: translateX(...)` עם `transition-transform` כשמשחררים.
- מציג כפתור רק במובייל (`md:hidden` על overlay layer); ב-desktop ה-wrapper פשוט מרנדר children.
- `onDelete` אופציונלי; אם לא מועבר, אין swipe.
- כפתור הפעולה: `Trash2` + label "מחק".

שימושים:
- `src/routes/_authenticated/projects.index.tsx` — עוטף כל card של פרויקט; `onDelete={() => setDeleteId(project.id)}` (פותח את ה-AlertDialog הקיים).
- `src/routes/_authenticated/projects.$projectId.tsx` — עוטף כל שורת מסמך/קבוצה ברשימה; קורא ל-`setDeleteId` / `setDeleteGroupId` הקיימים.

## 18 — Pull-to-Refresh ברשימת פרויקטים

יצירת hook `src/hooks/use-pull-to-refresh.ts`:

- מחזיר `{ bind, pullDistance, refreshing }`.
- `bind` = `onTouchStart/Move/End` שמוחל על container ראשי של דף הרשימה.
- מופעל רק כש-`window.scrollY === 0` ו-`window.matchMedia("(max-width: 767px)").matches`.
- threshold: 72px — כשמשחררים מעליו, קורא ל-`onRefresh()` async ומציג spinner עד ש-resolve.
- אחרת מחזיר חלק עם transition.

יצירת `src/components/pull-to-refresh-indicator.tsx` — אינדיקטור עליון:
- `absolute top-0 inset-x-0 flex justify-center` עם `transform: translateY(${Math.min(pullDistance, 80)}px)`.
- מציג `Loader2` (מסתובב כשרענון) או `ArrowDown` שמסתובב לפי `pullDistance/threshold`.

שילוב ב-`src/routes/_authenticated/projects.index.tsx`:
- `const { bind, pullDistance, refreshing } = usePullToRefresh({ onRefresh: () => queryClient.invalidateQueries({ queryKey: ["projects"] }) });`
- עוטף את ה-root div של הדף ב-`{...bind}` ומציב את ה-indicator בתוכו.

## טכני / מבני

- אין שינויי DB, אין server functions, אין תלויות חדשות.
- `Cmd+K` open בכפתור החיפוש ב-bottom nav: `window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))` (כפי שמשמש כבר ב-`CommandTriggerButton`).
- "אחרונים" ב-bottom nav: מאחר ש-`RecentItemsMenu` הוא dropdown מותנה ב-trigger, נשכפל את הלוגיקה לתוך `Sheet` (bottom sheet) שנפתח מהכפתור — או שנעטוף את `RecentItemsMenu` הקיים ונחשוף trigger חיצוני. **הבחירה**: נעדכן את `RecentItemsMenu` לקבל `trigger?: ReactNode` (אופציונלי) ולהסתיר את כפתור ברירת המחדל כשמועבר trigger מותאם. ב-bottom nav נעביר את הכפתור שלנו כ-trigger.
- כל הטקסטים ב-RTL/עברית, semantic tokens בלבד (`text-foreground`, `text-muted-foreground`, `text-primary`, `bg-card`, `border-border`).
- safe-area: ב-`src/styles.css` כבר אין הגדרה — נסתמך על CSS env() inline.

## קבצים

**נוצרים:**
- `src/components/mobile-bottom-nav.tsx`
- `src/components/swipeable-row.tsx`
- `src/components/pull-to-refresh-indicator.tsx`
- `src/hooks/use-pull-to-refresh.ts`

**עורכים:**
- `src/routes/_authenticated.tsx` — הוספת bottom nav, הסתרת footer במובייל, padding ל-main.
- `src/routes/_authenticated/projects.index.tsx` — עטיפת cards ב-SwipeableRow + pull-to-refresh על ה-container.
- `src/routes/_authenticated/projects.$projectId.tsx` — עטיפת שורות מסמכים ב-SwipeableRow.
- `src/components/recent-items-menu.tsx` — תמיכה ב-prop `trigger` חיצוני.

## תאימות

- Desktop (≥768px): bottom nav, swipe overlay, pull-to-refresh — כולם מושבתים. UX זהה לקיים.
- Mobile (<768px): bottom nav מופיע, swipe-to-delete פעיל, pull-to-refresh פעיל ברשימת פרויקטים.
- iOS safe-area: bottom nav מתחשב ב-`env(safe-area-inset-bottom)`.
