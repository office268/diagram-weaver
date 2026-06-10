
# תוכנית: ייצוא תצורת הסוכנים ל-Google Sheets

## מטרה
להוסיף בדף `/agents` (אדמין בלבד) כפתור "ייצא ל-Google Sheets" שייצר גיליון חדש המכיל את רשימת ההגדרות של הסוכנים + סיכום של "דינאמי vs קבוע" שכתבתי בתשובה הקודמת.

## הבהרה חשובה לפני בנייה
ה-connector של Google Sheets ב-Lovable מתחבר לחשבון **של בעל הסביבה (אתה)**, לא לחשבון של כל משתמש קצה. כלומר כל הגיליונות שייווצרו יהיו ב-Drive שלך. זה מתאים לפיצ'ר אדמין-בלבד כמו זה. אם תרצה שכל משתמש יוכל לייצא ל-Drive שלו — צריך OAuth-per-user נפרד (פלואו שונה ומורכב יותר, לא חלק מהתוכנית הזו).

## תוכן הגיליון
הגיליון ייווצר עם 3 worksheets:

1. **"סוכנים"** — שורה לכל סוכן, עמודות:
   - שם, תפקיד, מודל, מקור המודל (default/override), טמפרטורה, max tokens, שלב בצנרת, in-loop (כן/לא), מילות מפתח ללולאה, מספר shared blocks, אורך system prompt (תווים), score threshold (ל-review בלבד), max iterations (ל-review בלבד)

2. **"הגדרות דינאמיות vs קבועות"** — טבלת סיכום:
   - שם הגדרה | סטטוס נוכחי | דינאמי בזמן ריצה? | חייב להיות קבוע מראש? | הערות
   - (Model, Temperature, Max tokens, In-loop, Loop keywords, System prompt, Shared blocks, Prompt template, Score threshold, Max iterations, Business knowledge, Doc-type instructions, RAG top-K/threshold, Few-shot examples, Reasoning effort)

3. **"המלצות לשיפור"** — 5 ההמלצות שציינתי (per-agent model override, RAG tuning, score threshold גמיש, few-shot per-org, reasoning effort).

## שינויים טכניים

### 1. חיבור Google Sheets connector
שימוש בכלי `standard_connectors--connect` עם `connector_id: "google_sheets"` — תתבקש לאשר חיבור פעם אחת.

### 2. server function חדשה
קובץ חדש: `src/lib/export-agents-config.functions.ts`
- `createServerFn({ method: "POST" })` עם `requireSupabaseAuth` middleware
- בדיקת `assertAdmin` (לפי הזיכרון: server fn לפעולות אדמין חייב לבדוק בעצמו)
- שליפת תצורת הסוכנים (אותו לוגיקה כמו `getAgentsConfig`)
- קריאה ל-Google Sheets API דרך ה-connector gateway:
  - `POST https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets` ליצירת spreadsheet עם 3 sheets
  - `POST .../values:batchUpdate` למילוי הנתונים
- שימוש בכותרות `Authorization: Bearer $LOVABLE_API_KEY` + `X-Connection-Api-Key: $GOOGLE_SHEETS_API_KEY`
- החזרת `{ spreadsheetUrl }` ללקוח

### 3. כפתור ב-UI
ב-`src/routes/_authenticated/agents.tsx`:
- כפתור "ייצא ל-Google Sheets" ליד כותרת הדף
- בלחיצה: קריאה ל-server function, הצגת toast עם קישור לפתיחת הגיליון בטאב חדש
- מצב loading + טיפול בשגיאות

## ללא שינוי
- אין נגיעה בפרומפטים, סכמות, ולידציה, מינימומים, או איכות התוצרים — רק שכבת ייצוא חדשה.
- אין שינוי DB.

## אישור
לאשר את התוכנית והאם נכון שהגיליונות ייווצרו ב-Drive שלך (כי החיבור הוא workspace-level).
