# תוכנית סידור: payments.functions + ניקוי components/ui

## מטרה
שתי הזזות קטנות וממוקדות שמורידות חיכוך בקריאה ובתחזוקה, בלי לשנות שום לוגיקה:
1. להעביר `src/utils/payments.functions.ts` ל-`src/lib/payments/` (איפה שכל שאר ה-`.functions.ts` יושבים).
2. להוציא מ-`src/components/ui/` רכיבים שהם **לא** shadcn primitives, כדי שהתיקייה תישאר נקייה (קונבנציית shadcn: `ui/` = auto-generated, לא נוגעים).

## שלב 1 — `payments.functions.ts`

**מקור:** `src/utils/payments.functions.ts`
**יעד:** `src/lib/payments/payments.functions.ts`

פעולות:
- `mv` של הקובץ.
- חיפוש כל ה-imports בפרויקט (`from "@/utils/payments.functions"` או נתיב יחסי) ועדכון ל-`@/lib/payments/payments.functions`.
- אם `src/utils/` נשאר ריק — מחיקת התיקייה.

סיכון: נמוך. רק שינוי נתיב, אין שינוי API.

## שלב 2 — ניקוי `components/ui/`

הרכיבים הבאים נמצאים ב-`ui/` אבל אינם shadcn primitives:

| קובץ נוכחי | יעד מוצע |
|---|---|
| `src/components/ui/editable-text.tsx` | `src/components/common/editable-text.tsx` |
| `src/components/ui/editable-site-text.tsx` | `src/components/common/editable-site-text.tsx` |
| `src/components/ui/empty-state.tsx` | `src/components/common/empty-state.tsx` |
| `src/components/ui/pull-to-refresh-indicator.tsx` | `src/components/common/pull-to-refresh-indicator.tsx` |
| `src/components/ui/swipeable-row.tsx` | `src/components/common/swipeable-row.tsx` |
| `src/components/ui/theme-toggle.tsx` | `src/components/common/theme-toggle.tsx` |

(אם תעדיף שם תיקייה אחר כמו `shared/` במקום `common/` — תגיד, אני מתאים.)

פעולות לכל קובץ:
- `mv` ליעד החדש.
- עדכון כל ה-imports בפרויקט (`@/components/ui/<name>` → `@/components/common/<name>`).
- אימות שאף `components.json` של shadcn לא מצביע על הקבצים האלה (הם לא רשומים שם — נוצרו ידנית).

סיכון: נמוך. הרכיבים האלה לא חלק מ-shadcn registry, אז עדכון shadcn עתידי לא יגע בהם.

## מה לא נכלל בתוכנית הזו (במפורש)

- **לא** משנים מבנה של `agents/`, `routes/`, `lib/` (חוץ מ-payments), `hooks/`, או `integrations/`.
- **לא** נוגעים ב-`routeTree.gen.ts` (יתחדש אוטומטית אם תאנסטאק תרצה).
- **לא** משנים שום system prompt / schema / ולידציה / agent logic — רק הזזות קבצים ועדכון imports.
- **לא** מאחדים `lib/doc-types/types.ts` עם `types.server.ts` (העלית כאפשרות אבל זה stylistic — אם תרצה, נפרד).
- **לא** מקבצים את דפי ה-marketing תחת layout — שינוי משמעותי יותר, שווה דיון נפרד.

## אימות

- בנייה עוברת (TanStack Router יחדש את `routeTree.gen.ts` אוטומטית, אם בכלל צריך — אף route לא הוזז).
- חיפוש `rg "utils/payments.functions"` ו-`rg "components/ui/(editable-text|editable-site-text|empty-state|pull-to-refresh-indicator|swipeable-row|theme-toggle)"` — צריך לחזור 0 תוצאות אחרי העדכון.
- preview עולה בלי שגיאות runtime.

## הערה טכנית

ל-`.functions.ts` חשוב להישאר במסלול client-safe (לא תחת `src/server/`) — `src/lib/payments/` עומד בזה. תוכן הקובץ לא משתנה, רק המיקום.
