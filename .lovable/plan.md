## מה נוסיף

בדיאלוג "פרויקט חדש" (src/routes/_authenticated/projects.index.tsx), ליד שדה התיאור — כפתור קטן "✨ רעיון מה-AI" שמופיע **רק למנהל** (`isAdmin` מ-`useSiteTexts()`, אותו דפוס שמשתמשים בו כבר ב-settings.tsx).

לחיצה → קריאת serverFn → Lovable AI Gateway (`google/gemini-3-flash-preview`) → מקבל **שם פרויקט קצר + תיאור של בדיוק 3 משפטים** של מערכת מידע אקראית/מעניינת, וממלא את שדות `name` ו-`description` בטופס.

## שלבים

1. **serverFn חדשה** — `src/lib/project-ideas.functions.ts`
   - `generateProjectIdea` עם `createServerFn({ method: "POST" })` + `requireSupabaseAuth` middleware
   - בתוך ההנדלר: לוודא ש-המשתמש הוא admin (שאילתת `user_roles` עם `supabaseAdmin`, כמו ב-`login-log.functions.ts`); אם לא — לזרוק 403
   - להשתמש ב-`createLovableAiGatewayProvider` + `generateText` עם `Output.object` (Zod: `{ name: string, description: string }`)
   - System prompt בעברית: "החזר רעיון למערכת מידע ארגונית. name: 3-6 מילים. description: בדיוק 3 משפטים, עברית, ממוקד בערך עסקי + משתמשים + פיצ'ר מרכזי."

2. **UI** — `src/routes/_authenticated/projects.index.tsx`
   - להוסיף `const { isAdmin } = useSiteTexts()`
   - מעל ה-Textarea של description, אם `isAdmin` → כפתור `<Button variant="outline" size="sm">` עם אייקון `Sparkles` (lucide-react כבר בשימוש)
   - `useMutation` שקוראת ל-serverFn ומבצעת `setName(...)` ו-`setDescription(...)`; loading state עם spinner; toast לשגיאות

## סיכון/הערות

- אין שינויי DB. אין מיגרציה.
- הבדיקה היא כפולה: UI מסתיר את הכפתור, וה-serverFn גם בודקת admin (אבטחה אמיתית).
- עלות: קריאה אחת ל-Lovable AI לכל לחיצה.
