# מטרה
לתקן את כשל יצירת ה‑activity diagram כך שהשרת יחזיר תרשים תקין ולא יקטע את התגובה.

# מה הבעיה
מצאתי בלוג השרת שהבקשה עדיין נופלת על ולידציית Mermaid ישנה:
- `ActivityDiagramGenerationError: ... חסר flowchart RL`
- מקור השגיאה: `src/routes/api/chat-message.ts` סביב שורה 349

בפועל ה‑activity pipeline כבר מחזיר `SVG`, לא Mermaid, ולכן נשארה במסלול הזה בדיקה לא נכונה שממשיכה לצפות ל־`flowchart RL`.

# תוכנית עבודה
1. לעדכן את מסלול `diagram_activity` ב־`src/routes/api/chat-message.ts`
   - להסיר לחלוטין את ולידציית Mermaid מהמסלול של activity.
   - לוודא שלא נשארים import/branches ישנים של `getActivityMermaidValidationError` עבור activity.

2. ליישר את הייצוג של פלט activity מול ה־UI והאחסון
   - לוודא שה־SVG נשמר ומועבר הלאה בלי עטיפת Mermaid שמבלבלת את הצרכן downstream.
   - לבדוק שה־assistant message/renderer מתייחסים ל־activity כ־SVG ולא כקוד Mermaid רגיל.

3. לאמת את הזרימה מקצה לקצה
   - לשחזר בקשה עם prompt דומה לזה שנכשל.
   - לבדוק שאין יותר `תגובת השרת נקטעה` ושנוצר artifact תקין.
   - אם יישאר כשל, להשתמש בלוגי שרת כדי לאתר את הנקודה הבאה בשרשרת.

# פרטים טכניים
- קבצים מרכזיים:
  - `src/routes/api/chat-message.ts`
  - `src/agents/diagrams/activity-swimlane.server.ts`
  - `src/lib/activity-diagram-pipeline.server.ts`
  - `src/routes/_authenticated/diagram.$id.tsx`
- הסיבה הסבירה ביותר: קוד ישן של Mermaid validation עדיין מופעל במסלול activity למרות שהפלט הוחלף ל־SVG.
- לא אגע באיכות התוצרים האפיוניים או בפרומפטים מעבר למה שחייב כדי להסיר את הכשל.