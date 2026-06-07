## הבעיה

יצירת "תרשים Activity" סיימה בהצלחה בצד השרת (הודעת assistant נשמרה ב-DB), אבל הפלט שהמודל החזיר התחיל ב-`activityDiagram` עם תחביר PlantUML (`start`, `:פעולה;`, `if (...) then (כן) ... endif`). Mermaid לא תומך ב-`activityDiagram` — ולכן ה-preview בלקוח נכשל ב-render והמשתמש רואה "לא הצלחתי ליצור".

מקור הבלבול בקוד:
1. `src/agents/diagrams/system.ts` כותב מפורש: `"- activityDiagram (flowchart TD): לזרימות תהליך"` — שם תחבירי שלא קיים.
2. `src/lib/agents-config.functions.ts` (שורות 107, 205) מציין "activity" ברשימת סוגי Mermaid הנתמכים בלי לקבע ש-Mermaid ממפה אותו ל-`flowchart TD`.
3. ב-`src/routes/api/chat-message.ts` ה-system prompt ליצירת תרשים בודד מזריק `mermaidHint` (עבור `diagram_activity` = `flowchart TD`), אבל לא אוסר על `activityDiagram` ולא מסביר שזה לא תחביר קיים.

אין שום שגיאת שרת בלוגים — המסמך נכתב, פשוט לא חוקי Mermaid.

## התיקון

### 1. `src/routes/api/chat-message.ts` — לחזק את ה-system prompt לתרשים בודד
להוסיף שתי שורות מפורשות:
- "ב-Mermaid אין `activityDiagram`. עבור תרשים Activity חובה להשתמש ב-`flowchart TD` עם החלטות `{...}` ותווי תהליך `[...]`."
- "אסור להתחיל ב-`activityDiagram`, `start`, או `:label;` (זה PlantUML, לא Mermaid)."

וכן: כשה-`mermaidHint` קיים — לחייב שהשורה הראשונה של הקוד תהיה בדיוק הוא.

### 2. `src/agents/diagrams/system.ts` — לתקן את ההנחיה המטעה
לשנות את השורה `"- activityDiagram (flowchart TD): לזרימות תהליך"` ל:
`"- זרימות תהליך / Activity: השתמש ב-flowchart TD בלבד (Mermaid לא תומך ב-activityDiagram)"`

### 3. `src/lib/agents-config.functions.ts` — להבהיר באותו אופן
בשתי השורות (107, 205) להחליף את "activity" ב-"activity (כ-flowchart TD)" כדי שלא יישמר במסד נתונים כקונפיג ישן ומטעה.

### 4. שיפור הודעת השגיאה למשתמש (אופציונלי, קטן)
ב-`extractMermaid` או אחריו: אם הטקסט מתחיל ב-`activityDiagram`/`start`/`:` — להחליף את ההודעה ל-"המודל החזיר תחביר לא תקין, מנסה שוב…" ולעשות retry יחיד עם הוראה מחמירה יותר. אם גם הריטריי נכשל — לשמור כפי שהוא ולהציג שגיאת render ידידותית.

## מה לא משתנה
- אין שינוי DB.
- אין שינוי בזרימת הסטרימינג / heartbeat.
- אין שינוי ב-orchestrator (זה נתיב היחיד של "תרשים בודד" מהצ'אט, לא מסמך מלא).

## בדיקה
לאחר היישום: לפתוח שיחה חדשה, לבחור "תרשים Activity", להזין את אותה בקשה (משרד עו"ד) ולוודא שהפלט מתחיל ב-`flowchart TD` ו-mermaid-preview מציג את התרשים בלי שגיאה.
