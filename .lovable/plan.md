## תיקונים 14, 16, 17, 19

### 14 — שחזור סיסמה ב-Login
קובץ: `src/routes/login.tsx` + עמוד חדש `src/routes/reset-password.tsx`.
- בטאב "כניסה" להוסיף קישור "שכחתי סיסמה" שפותח דיאלוג עם שדה אימייל וקורא ל-`supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" })`.
- אגב כך לתרגם את הטקסטים שנותרו באנגלית בעמוד (Email, Password, Sign in/Create account, OR, Continue with Google, ההודעות ב-toast) לעברית — נדרש בכל מקרה לעקביות עם בקשת השפה הקודמת.
- ליצור עמוד ציבורי `/reset-password` (לא תחת `_authenticated`) עם טופס סיסמה חדשה הקורא ל-`supabase.auth.updateUser({ password })`. לאחר הצלחה — toast והפניה ל-`/projects`.

### 16 — היסטוריית פרומפטים לכל סוג סעיף
קובץ: `src/routes/_authenticated/editor.$id.tsx` (רכיב `SectionShell`) + hook חדש `src/hooks/use-prompt-history.ts`.
- `usePromptHistory(key)` שומר ב-`localStorage` עד 5 פרומפטים אחרונים לכל מפתח (`spec-ai-prompt-history:<key>`), dedupe וסדר LRU.
- ב-Popover של ה-AI בכל סעיף: מתחת ל-Textarea להציג רשימת shortcuts (אם קיימים) — כל פריט הוא chip קטן שלחיצה עליו ממלאת את ה-Textarea. כפתור X קטן ליד כל chip להסרה.
- ב-`handleAiSubmit` להוסיף קריאה ל-`addPrompt(instruction)` עם הצלחה.

### 17 — Preview של שינויי AI לפני החלת התוצאה
קובץ: `src/routes/_authenticated/editor.$id.tsx` — `improveSection` + `SectionShell`.
- `improveSection` תחזיר את ה-`value` החדש במקום להחיל מיידית; ה-Shell יציג דיאלוג Preview עם:
  - תצוגת התוצאה החדשה (משתמש ברנדרר הקיים `renderBody`-ל ערך מועמד; לפשטות — `<pre>` עם stringify לערכים מובְנים ו-Markdown/טקסט לערכי טקסט; שימוש ב-renderer הקיים אם אפשרי דרך state מקומי).
  - שני כפתורים: "החל" → `applySectionValue(key, candidate)` + toast עם פעולת "בטל" (משחזרת את הערך הקודם), "בטל" → סוגר ללא שינוי.
- שמירת snapshot של הערך הקודם לתמיכה ב-undo.

### 19 — Toolbar במובייל
קובץ: `src/routes/_authenticated/editor.$id.tsx` — בלוק ה-toolbar (שורות 756–816).
- ב-mobile: ה-Input של הכותרת תופס שורה שלמה מתחת ל-Breadcrumb (`order` ו-`basis-full sm:basis-auto`). ב-sm+ נשארת התנהגות נוכחית.
- אינדיקטור "שמירה אוטומטית" → ב-mobile רק אייקון (טקסט `hidden sm:inline`).
- `sticky top-0` נשאר; להוסיף `backdrop-blur` קל ולוודא `z-30` כדי שלא ידרס ע"י תוכן ארוך.

## פרטים טכניים
- אין שינויי DB / server functions.
- אין dependencies חדשות.
- שינויים פרונט-אנד בלבד: 3 קבצים נערכים, 2 נוצרים (`/reset-password` route, hook).
- אימות ויזואלי במובייל (384px) ובדסקטופ לאחר ההטמעה.
