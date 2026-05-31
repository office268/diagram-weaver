
## מטרה
לאפשר למשתמש בעל תפקיד `admin` לערוך כל כותרת/הסבר באפליקציה ע"י דאבל-קליק. הטקסטים נשמרים בטבלה גלובלית `site_texts` (מפתח→ערך) ומוצגים לכל המשתמשים.

## מודל נתונים (migration)

1. `app_role` enum: `'admin' | 'user'`
2. טבלה `user_roles(user_id, role)` + `GRANT` + RLS (קריאה: המשתמש שלו; כתיבה: רק `service_role`).
3. פונקציה `has_role(_user_id uuid, _role app_role) returns boolean` עם `SECURITY DEFINER`.
4. טבלה `site_texts`:
   - `key text primary key`
   - `value text not null`
   - `updated_at timestamptz`, `updated_by uuid`
5. RLS על `site_texts`:
   - SELECT: ציבורי (`true`) — כולם רואים את הטקסטים.
   - INSERT/UPDATE: רק `has_role(auth.uid(), 'admin')`.
6. הענקת תפקיד admin למשתמש הראשי — לאחר אישור ה-migration אריץ INSERT ל-`user_roles` (אבקש מהמשתמש את האימייל שלו, או אקח את ה-user שכרגע מחובר).

## Server functions (`src/lib/site-texts.functions.ts`)
- `getSiteTexts()` — קריאה ציבורית, מחזיר `Record<string,string>`. נקרא ב-loader של ה-root כדי להזרים את כל הטקסטים פעם אחת.
- `updateSiteText({ key, value })` — מוגן ב-`requireSupabaseAuth`, בודק `has_role`, עושה `upsert`.
- `getIsAdmin()` — מוגן, מחזיר boolean (לשליטה ב-UI).

## קליינט

### Provider וקונטקסט
- `src/lib/site-texts-context.tsx` — קונטקסט עם:
  - `texts: Record<string,string>` (מהלואדר של ה-root)
  - `isAdmin: boolean`
  - `updateText(key, value)` — קורא ל-server fn + עדכון מקומי אופטימי.
- ב-`__root.tsx` ה-loader יטען `getSiteTexts()` + (כשמחובר) `getIsAdmin()`, וה-Provider יעטוף את ה-Outlet.

### קומפוננטה `<EditableSiteText>`
- props: `textKey`, `defaultValue`, `as?` (h1/h2/p/span), `multiline?`, `className?`.
- מציגה `texts[textKey] ?? defaultValue`.
- אם `isAdmin`:
  - `onDoubleClick` → הופך ל-`<input>`/`<textarea>` במקום (`contentEditable`-like או החלפה ל-Textarea/Input).
  - שמירה אוטומטית ב-`onBlur` או `Enter` (Shift+Enter = שורה חדשה במולטילין). `Esc` = ביטול.
  - אינדיקטור ויזואלי עדין (border-dashed בריחוף) + טוסט "נשמר".
- אם לא admin: רק טקסט רגיל, ללא דאבל-קליק.

### החלפת טקסטים קיימים
החלפה של מחרוזות סטטיות ל-`<EditableSiteText textKey="..." defaultValue="...">` במקומות הבאים:

**Landing (`src/routes/index.tsx`)** — keys: `landing.header.brand`, `landing.hero.badge`, `landing.hero.title`, `landing.hero.subtitle`, `landing.hero.cta`, `landing.features.{1..3}.title/text`, `landing.footer`.

**Dashboard (`src/routes/_authenticated/dashboard.tsx`)** — כותרת הדף, תיאור, טקסטים של empty state וכותרות כרטיסי מסמכים סטטיים (כל מחרוזת UI לא-דינמית).

**Settings (`src/routes/_authenticated/settings.tsx`)** — כותרת `הגדרות AI`, תת-הסבר, כותרות/תיאורי הכרטיסים (`System Instruction`, `תבנית הפרומפט...`, וכו').

**Editor (`src/routes/_authenticated/editor.$id.tsx`)** — כותרות סטטיות וטקסטים מסבירים (לא תוכן המסמך עצמו, שנערך פר-מסמך).

(הערכים הדינמיים — title של מסמך, ביקורת סוכן, הערות משתמש — לא בהיקף.)

## זרימת UX
1. אדמין נכנס לדף → רואה את הטקסטים רגיל; בריחוף על טקסט ניתן לעריכה נדלק border מקווקו עדין + tooltip "דאבל-קליק לעריכה".
2. דאבל-קליק → התא הופך לשדה עריכה במקום, פוקוס + סימון טקסט.
3. Enter / blur → שמירה אוטומטית (`updateSiteText`), טוסט "נשמר", הטקסט מוחלף בכל המשתמשים בטעינה הבאה (אופטימית בקליינט הנוכחי, ולשאר ע"י invalidation של ה-query / רענון).
4. Esc → ביטול.

## פרטים טכניים
- ה-loader של ה-root יקרא `getSiteTexts()` (ציבורי, ללא auth) — בטוח ל-SSR.
- `getIsAdmin()` נקרא רק מתוך `_authenticated` (יש session). מחוץ אליו `isAdmin=false`.
- שמירה אופטימית: ה-Provider מעדכן `texts[key]` מיידית; אם השרת מחזיר שגיאה → revert + toast.error.
- אין שינוי בתיאור/הגדרות אחרות; זו תוספת UI גרידא + טבלה גלובלית + תפקידים.

## סיכום השינויים
- migration: `app_role`, `user_roles`, `has_role`, `site_texts` + RLS + GRANTs.
- server fns: `src/lib/site-texts.functions.ts`.
- context: `src/lib/site-texts-context.tsx`.
- קומפוננטה: `src/components/editable-site-text.tsx`.
- עדכון: `src/routes/__root.tsx`, `src/routes/index.tsx`, `dashboard.tsx`, `settings.tsx`, `editor.$id.tsx`.
- INSERT חד-פעמי ל-`user_roles` כדי לסמן את המשתמש כ-admin (אבקש אימייל לאחר אישור).
