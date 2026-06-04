
## מה בונים

מערכת חדשה בדף ההגדרות לניהול "משתמשי מערכת" — סוכני AI עם פרסונה (שם, תפקיד, ידע, כלים), והאדמין מנהל ביניהם שיחות צ'אט מתוזמרות שבהן הוא בוחר מי מדבר בכל תור. כל מה שנאמר נשמר בבסיס הנתונים.

## חוויית משתמש

### בדף ההגדרות (לאדמין בלבד)
קולפס חדש בשם **"משתמשי מערכת (סוכני AI)"** עם:
- כפתור **"הקמת משתמש מערכת חדש"** → פותח דיאלוג עם השדות:
  - שם
  - שיוך ארגוני (dropdown מהארגונים של האדמין)
  - תפקיד (טקסט קצר, למשל "אנליסט מערכות בכיר")
  - תיאור מפורט של התפקיד (textarea — זה ה-system prompt של הסוכן)
  - ידע שעומד לרשותו (textarea — מידע רקע)
  - כלים (checkboxes: גישה למסמכי הפרויקט, חיפוש ידע ארגוני, יצירת אפיון וכו' — להתחלה: רק "ידע ארגוני")
- רשימת הסוכנים הקיימים עם עריכה/מחיקה

### דף שיחות סוכנים חדש (`/agent-conversations`)
- רשימת שיחות בצד + כפתור "שיחה חדשה"
- בעת יצירת שיחה: האדמין נותן כותרת + נושא פתיחה + בוחר אילו סוכנים משתתפים (multi-select)
- מסך השיחה (צ'אט):
  - הודעות מוצגות כבועות עם שם הסוכן + תפקיד + אווטאר צבעוני
  - האדמין יכול להוסיף הודעת הקשר משלו (כ"מנחה")
  - בתחתית: dropdown "מי ידבר עכשיו?" עם רשימת המשתתפים + כפתור "צור תגובה"
  - לחיצה מפעילה את הסוכן הנבחר עם ההיסטוריה המלאה + הפרסונה שלו, התשובה נשמרת ומוצגת
  - כפתור "המשך אוטומטי" (אופציונלי) — סבב אחד שבו כל סוכן מגיב לפי הסדר

### ניווט
קישור חדש בתפריט הצדדי "שיחות סוכנים" (גלוי רק לאדמין).

## מודל נתונים

ארבע טבלאות חדשות, כולן עם RLS שמגביל לאדמין בלבד (`has_role(auth.uid(), 'admin')`):

1. **`agent_personas`** — הסוכנים
   - `name`, `org_id` (FK organizations), `role_title`, `role_description`, `knowledge`, `tools` (jsonb), `color`, `created_by`
2. **`agent_conversations`** — השיחות
   - `title`, `topic`, `created_by`
3. **`agent_conversation_participants`** — מי משתתף בכל שיחה
   - `conversation_id`, `persona_id` (unique pair)
4. **`agent_messages`** — ההודעות
   - `conversation_id`, `persona_id` (nullable — null = הודעת אדמין/מנחה), `role` ('agent'|'moderator'), `content`, `created_at`

GRANTs ל-authenticated + service_role; policies מצמצמות ל-admin בלבד.

## Backend (server functions + route)

חדש ב-`src/lib/agents.functions.ts`:
- `listAgentPersonas`, `createAgentPersona`, `updateAgentPersona`, `deleteAgentPersona`
- `listAgentConversations`, `createAgentConversation`, `getAgentConversation`
- `addModeratorMessage`, `listConversationMessages`

ראוט חדש: **`src/routes/api/agent-turn.ts`** — מקבל `{conversationId, personaId}`, טוען פרסונה + היסטוריה + ידע ארגוני, בונה system prompt מהפרסונה, קורא ל-Lovable AI (gemini-2.5-flash), שומר את התגובה כ-`agent_messages` ומחזיר אותה. מתעד שימוש דרך `logAiUsage`.

## Frontend

קומפוננטות חדשות:
- `src/components/agent-personas-card.tsx` — הקולפס בהגדרות (CRUD לפרסונות)
- `src/components/agent-persona-dialog.tsx` — דיאלוג יצירה/עריכה
- `src/routes/_authenticated/agent-conversations.tsx` — רשימת שיחות
- `src/routes/_authenticated/agent-conversations.$id.tsx` — מסך הצ'אט עם בחירת דובר
- עדכון `src/routes/_authenticated/settings.tsx` — הוספת הקולפס (תחת `isAdmin`)
- עדכון תפריט הניווט להוסיף "שיחות סוכנים" לאדמין

## מה לא נכלל בשלב הזה (לאשר/לדחות)
- אינטגרציה של "כלים" אמיתיים (קריאה ל-RAG, יצירת מסמכים) — בשלב ראשון רק שדה הגדרה טקסטואלי שייכנס ל-system prompt. נוסיף קישוריות בפועל בשלב הבא.
- מצב "אוטומטי מלא" שבו הסוכנים מדברים ביניהם ללא התערבות — נוסיף רק את "סבב אחד".
- הרשאות שאינן אדמין — בשלב זה רק האדמין רואה ומשתמש בכלל המערכת.

האם להמשיך לבנייה?
