
## מטרה
1. להעביר את כל 6 הסוכנים לשימוש במודל `google/gemini-2.5-pro` (reasoning) במקום `gemini-3-flash-preview`.
2. להוסיף בדף ההגדרות שדה "מודל AI" שרק admin יכול לראות ולערוך, שישלוט בכל הסוכנים.

## שינויים

### 1. טבלה חדשה ב-DB: `ai_model_setting` (singleton, admin-only)
שדות:
- `id text PK default 'singleton'`
- `model text not null default 'google/gemini-2.5-pro'`
- `updated_at`, `updated_by`

RLS:
- קריאה: כל authenticated (כדי שה-server יוכל לטעון, וגם UI להציג ל-admin)
- כתיבה (insert/update): רק `has_role(auth.uid(), 'admin')`
- GRANTs מתאימים ל-authenticated ו-service_role.

### 2. Server functions חדשים: `src/lib/ai-model-setting.functions.ts`
- `getAiModelSetting` — מחזיר את המודל הנוכחי.
- `updateAiModelSetting` — admin-only, מקבל `{ model: string }` מתוך whitelist של מודלים נתמכים, ומעדכן.

### 3. עדכון ברירות מחדל של הסוכנים
ב-`src/agents/shared/constants.ts`:
- `DEFAULT_AGENT_MODEL` → `"google/gemini-2.5-pro"`.
- כל ה-`AGENT_MODELS` ישתמשו ב-default (כולל review שכבר במילא 2.5-pro).

### 4. שילוב המודל הדינמי בזרימה
- ב-`src/routes/api/generate-spec.ts`: לפני קריאת `runOrchestrator`, לטעון את המודל הנבחר מה-DB דרך `supabaseAdmin` ולהעביר אותו כפרמטר חדש `modelOverride`.
- ב-`src/agents/orchestrator/index.server.ts`: לקבל `modelOverride?: string` ולהעביר ל-context.
- בכל הסוכנים (`requirements`, `architecture`, `data-model`, `use-cases`, `diagrams`, `review`): להשתמש ב-`modelOverride ?? AGENT_MODELS.<name>`.
  - דרך נקייה: להוסיף ל-`AgentContext` שדה `model?: string` ולקרוא ממנו בכל סוכן.

### 5. UI בדף ההגדרות (`src/routes/_authenticated/settings.tsx`)
- כרטיס חדש "מודל AI לסוכנים" שמופיע **רק** ל-admin (בדיקה דרך `has_role` כפי שנעשה בשאר חלקי הניהול במערכת).
- `<Select>` עם רשימת מודלי reasoning נתמכים:
  - `google/gemini-2.5-pro` (ברירת מחדל)
  - `google/gemini-3.1-pro-preview`
  - `openai/gpt-5.4`
  - `openai/gpt-5.4-pro`
  - `openai/gpt-5.5`
  - `openai/gpt-5.5-pro`
- כפתור "שמור" שקורא ל-`updateAiModelSetting`.
- טקסט עזר קטן: "המודל ישפיע על כל הסוכנים בעת חילול תוצרים. מודלי reasoning איכותיים יותר אך יקרים יותר."

## פרטים טכניים
- בדיקת admin ב-UI: שאילתת `user_roles` עם `role='admin'` (כפי שנעשה בקומפוננטות אדמין קיימות).
- ולידציה של ערך המודל בצד שרת מול whitelist קשיח כדי למנוע הזרקת שם מודל שרירותי.
- אין שינוי במחירים/חישוב — מערכת ה-usage tracking הקיימת תמשיך לעבוד כי המודל מועבר ל-`tracker.track(model, usage)`.

## מחוץ לסקופ
- לא משנה את מנגנון הסיום (score threshold, iterations).
- לא משנה temperatures.
- לא משנה את סוכן ה-chat (`/api/agent-turn`) שמשתמש ב-gemini-2.5-flash — זה לא חלק מסוכני יצירת התוצרים.
