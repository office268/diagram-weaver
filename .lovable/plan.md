# הוספת תיעוד בראש כל קבצי הפרויקט

## היקף מורחב
תיעוד בכל קבצי הקוד והתצורה בפרויקט, כולל מה שהוצא קודם:
- כל `src/` (כולל `components/ui/`)
- קבצי שורש: `vite.config.ts`, `eslint.config.js`, `tsconfig.json` (כהערה לא רלוונטית — ידולג, JSON לא תומך), `components.json` (ידולג), `bunfig.toml`, `.prettierrc` (ידולג)
- `supabase/config.toml`
- `supabase/migrations/*.sql`
- קבצי `.md` בשורש ובתיקיות (README, plan.md)

## פורמט לפי סוג קובץ
- `.ts/.tsx/.js/.jsx`:
  ```
  // ============================================================
  // <נתיב יחסי>
  // <תיאור עברית בשורה-שתיים>
  // ============================================================
  ```
- `.css`: `/* ... */`
- `.sql` / `.toml`: `-- ...` / `# ...`
- `.md`: בלוק HTML comment `<!-- ... -->` בראש הקובץ (לא משבש רינדור).

## חריגים שעדיין לא נוגעים בהם
- `src/routeTree.gen.ts` — מתחדש אוטומטית בכל build, כל הערה תימחק.
- `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts` — auto-generated, ההוראות בפרויקט אוסרות עריכה.
- קבצי JSON (`tsconfig.json`, `components.json`, `package.json`, `.prettierrc`, `.lovable/project.json`) — JSON לא תומך בהערות.
- `.env*` — לא קוד.
- `bun.lockb` / lockfiles.

אם תרצה לכלול בכל זאת את קבצי ה-auto-generated של Supabase — אגיד כן רק אחרי אישור מפורש, כי כל regeneration ימחק.

## כללי שימור
- אם השורה הראשונה היא `"use client"`, `'use server'`, shebang (`#!`), `@ts-...`, או directive דומה — ההערה תיכנס מתחתיה.
- קובץ שכבר יש בו בלוק תיעוד פתיחה (זוהה ע"י הערה ב-3 השורות הראשונות שמכילה את שם הקובץ/הנתיב) — יידלג כדי לא לדרוס תיעוד קיים.
- אין שינוי קוד פונקציונלי.

## ייצור התיאור
תיאור קצר אוטומטי לפי דפוסי הנתיב והשם:
- `routes/api/**` → "HTTP endpoint — ..."
- `routes/_authenticated/**` → "מסך מאומת — ..."
- `*.functions.ts` → "Server function (TanStack createServerFn) — ..."
- `*.server.ts` → "מודול server-only — ..."
- `agents/<x>/index.server.ts` → "סוכן <x> — נקודת כניסה"
- `agents/<x>/system.ts` / `prompt.ts` → "System prompt / Prompt builder לסוכן <x>"
- `components/ui/*.tsx` → "shadcn primitive — <שם>"
- `components/*.tsx` → "רכיב UI — <שם>"
- `hooks/*.ts(x)` → "Hook — <שם>"
- `lib/*` → לפי שם הקובץ
- `supabase/migrations/*.sql` → "Migration — <שם הקובץ>"
- ברירת מחדל: שם הקובץ + תיקייה.

## ביצוע
סקריפט חד-פעמי `scripts/add-file-headers.mjs`:
1. הולך רקורסיבית על השורשים: `src/`, `supabase/`, ושורש הפרויקט (לא רקורסיבית לשורש כדי לא לגעת ב-`node_modules`/`.lovable`/`dist`).
2. מסנן רשימת חריגים + תיעוד קיים.
3. מחשב פורמט הערה לפי סיומת.
4. מוסיף בלוק בראש (מתחת ל-directives אם יש).
5. הסקריפט יישאר ב-repo להרצה חוזרת בעתיד; הוא idempotent.

## אימות
- build עובר.
- בדיקת דגימה: קובץ route, קובץ agent, קובץ shadcn, migration SQL, README.
- ספירה: כמה קבצים תועדו / דולגו, מודפס בסיום הסקריפט.
