## דף הגדרות — System Instruction & Prompt

### מטרה
דף `/settings` שמציג ומאפשר לערוך את ה-system instruction, ומציג (קריאה בלבד) את תבנית הפרומפט שנשלחת ל-LLM בעת יצירת מסמך אפיון.

### שינויים

**1. טבלה חדשה: `ai_settings`** (לכל משתמש)
- `user_id` (PK, unique)
- `system_instruction` (text)
- RLS: רק הבעלים יכול לקרוא/לעדכן.

**2. ברירת מחדל משותפת (`src/lib/ai-spec-defaults.ts`)**
- מייצא את `DEFAULT_SYSTEM_INSTRUCTION` (המחרוזת שכעת hard-coded ב-`ai-spec.functions.ts` שורות 68-81).
- מייצא את `PROMPT_TEMPLATE` — תיאור קריא של מה נשלח: `{user_prompt}` של המשתמש מועבר as-is כ-user message, יחד עם ה-system instruction וסכמת ה-JSON המובנית. (תצוגה בלבד.)

**3. שרת: `src/lib/ai-settings.functions.ts`**
- `getAiSettings()` — מחזיר את ה-row של המשתמש, או את ברירת המחדל אם אין.
- `updateAiSettings({ system_instruction })` — upsert.
- `resetAiSettings()` — מחיקה / חזרה לברירת מחדל.

**4. עדכון `ai-spec.functions.ts`**
- בתחילת ה-handler: לטעון את ה-system instruction של המשתמש מ-`ai_settings`, ואם לא קיים — להשתמש ב-`DEFAULT_SYSTEM_INSTRUCTION`.
- שאר הלוגיקה (קריאה אחת ל-Gemini 2.5 Pro עם structured output) נשארת זהה.

**5. דף חדש: `src/routes/_authenticated/settings.tsx`**
- כותרת + הסבר קצר.
- **בלוק א — System Instruction**: `Textarea` גדול ערוך, כפתורי "שמור" ו"שחזר לברירת מחדל". מציג גם את ברירת המחדל בקריאה בלבד (collapsible) להשוואה.
- **בלוק ב — תבנית הפרומפט**: כרטיס קריאה-בלבד שמציג:
  - "System message:" (תוכן ה-system instruction הנוכחי)
  - "User message:" — מסביר שזה הפרומפט שהמשתמש מקליד בדיאלוג "מסמך אפיון חדש" (placeholder `{user_prompt}`)
  - "Output schema:" — שמות השדות במסמך המובנה (overview, goals, personas, וכו').
  - "מודל: google/gemini-2.5-pro".

**6. ניווט**
- ב-`src/routes/_authenticated.tsx` להוסיף קישור "הגדרות" בהדר לצד אימייל המשתמש.

### לא משתנה
- מבנה המסמך, ה-editor, ה-dashboard, הזרימה של פנייה אחת ל-LLM.

### קבצים
- חדש: migration `ai_settings`, `src/lib/ai-spec-defaults.ts`, `src/lib/ai-settings.functions.ts`, `src/routes/_authenticated/settings.tsx`
- עריכה: `src/lib/ai-spec.functions.ts`, `src/routes/_authenticated.tsx`
