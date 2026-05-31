# מימוש שיפורי "עורך" (9–12)

כל השינויים frontend בלבד, בקובץ `src/routes/_authenticated/editor.$id.tsx` (+ קומפוננטה חדשה אחת). אין שינויי DB/backend.

## 9 — Word & Section Count (Status Bar)

הוספת bar תחתון דביק (`sticky bottom-0`) עם:
- סך מילים במסמך (מצרף את כל הטקסטים מכל הסעיפים — `overview`, `goals`, `personas.description`, requirements `title+description`, `assumptions`, `use_cases`, `risks`, `user_notes`, `user_prompt`).
- סעיפים שהושלמו vs ריקים (סעיף "מלא" = יש בו לפחות פריט אחד עם תוכן או טקסט חופשי לא־ריק).
- helper `countWords(content)` ו-`sectionFillState(key, content)` ב-`useMemo`.

עיצוב: `border-t bg-card/80 backdrop-blur text-xs text-muted-foreground px-4 py-1.5 flex gap-4 justify-between`. אייקונים מ-lucide (`Type`, `ListChecks`).

## 10 — Progress Indicator

בתוך אותו status bar, וגם דק מעל ה-toolbar:
- `Progress` (shadcn) דק (`h-1`) שמראה אחוז סעיפים שמולאו = `filled / visibleSections.length`.
- ב-status bar טקסט מספרי: "5 / 12 סעיפים".
- מתעדכן אוטומטית עם `useMemo` תלוי ב-`content + visibleSections`.

## 11 — Focus Mode

state חדש `focusMode: boolean` שנשמר ב-localStorage (`editor-focus-mode`).
- כפתור ב-toolbar (`Maximize2` / `Minimize2`) + קיצור `f` כשלא בתוך input/textarea.
- כשפעיל:
  - toolbar עם `bg-transparent border-transparent` (שקוף יותר), breadcrumbs מוסתרים.
  - status bar מוסתר.
  - רוחב מסמך גדל (`max-w-4xl` → `max-w-3xl` מרוכז יותר).
  - בכל סעיף — סעיפים אחרים מקבלים `opacity-40` עד שמרחפים מעליהם (`group-hover:opacity-100 transition-opacity`).
  - אירוע `spec-open-section` נשמר כדי שגלילה לסעיף תפתח אותו.

## 12 — Split View (Desktop בלבד)

state `splitSecondaryKey: string | null` ב-`useState`. הפעלה דרך:
- כפתור `Columns2` בכל `SectionShell` (ה-action bar שלצד "מחק/שפר"). לחיצה קובעת את הסעיף כ"משני".
- כאשר `splitSecondaryKey` קיים ויש `lg` (≥1024px): ה-container הופך ל-grid `lg:grid-cols-2 gap-6`, וקומפוננטה חדשה `<SplitPanel sectionKey={splitSecondaryKey} ... />` נדבקת כעמודה ימנית (`lg:sticky lg:top-14 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto`).
- במובייל (<lg) הכפתור מוסתר; אם המסך מצטמצם, ה-split נסגר אוטומטית עם `useEffect` שמאזין ל-`window.matchMedia("(min-width: 1024px)")`.
- כפתור `X` בראש העמודה המשנית כדי לסגור.
- `SplitPanel` מקבל `renderBody(key)` ומציג כותרת + body, ללא drag handle ו-actions (read+edit אך לא מחיקה).

## טכני / מבני

- קומפוננטה חדשה: `src/components/editor-status-bar.tsx` — מקבל `wordCount`, `filledCount`, `totalCount`, `focusMode` (להסתרה).
- helpers חדשים בקובץ העורך (לא קובץ נפרד כי תלויים ב-`SpecContent`):
  ```ts
  function getSectionText(key: string, content: SpecContent, userNotes: string, prompt: string): string
  function countSectionWords(text: string): number
  function isSectionFilled(key: string, content: SpecContent, ...): boolean
  ```
- אין שינוי ל-DB schema, לא ל-server functions, ולא ל-`spec-output-schema`.
- `focusMode` ו-`splitSecondaryKey` נקיים מ-server state — frontend בלבד.
- `Progress` הוא קומפוננטת shadcn קיימת ב-`@/components/ui/progress` (אם חסר — מוסיפים).

## קבצים

- **נוצר**: `src/components/editor-status-bar.tsx`
- **ערוך**: `src/routes/_authenticated/editor.$id.tsx`
- **אולי נוצר** (אם חסר): `src/components/ui/progress.tsx` (shadcn standard)

## תאימות מובייל (384px)

- Status bar: מציג רק מספרים, מסתיר labels (`hidden sm:inline`).
- Focus mode: הכפתור נשאר נגיש; ב-toolbar הצפוף נוסיף `aria-label`.
- Split view: כפתור מוסתר במובייל (`hidden lg:inline-flex`); ב-resize ל-mobile מסגר אוטומטית.
