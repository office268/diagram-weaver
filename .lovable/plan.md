## Diagnosis
- הבעיה המרכזית אינה ירידה באיכות ההפקה, אלא תחביר Mermaid לא תקין שנוצר לפעמים בשלב ה-Activity build/post-process.
- מצאתי דוגמה שמורה במסד הנתונים עם תחביר כמו:
  - `subgraph "עובד"`
  - `style "עובד" fill:...`
- ב-Mermaid פקודת `style` צריכה לקבל מזהה צומת/תת-תרשים תקין, לא כותרת מצוטטת בעברית. זה תואם בדיוק לשגיאת הפרסר שבצילום.
- בנוסף, יש מסלול שגיאה מטעה: המשתמש יכול לראות parse error של Mermaid, אבל בצ'אט מתקבלת הודעת `activity extractor failed to parse process structure`, כך שקשה להבין מה באמת נשבר.

## Plan
1. **לחזק את חוזה ה-Activity Mermaid בלי להחליש איכות**
   - לעדכן את חוקי הייצור ב-`src/lib/activity-diagram-pipeline.server.ts` כך שכל swimlane יקבל מזהה ASCII מפורש ולייבל עברי נפרד, למשל:
     - `subgraph ACTOR1["עובד"]`
   - לדרוש שכל `style` יתייחס למזהה ASCII בלבד, לא לטקסט בעברית.
   - לא לגעת בפרומפטי איכות, עומק חילוץ, ולידציות סמנטיות, self-critique, או מינימומים קיימים.

2. **להוסיף תיקון מבני ממוקד לפלטים שבורים**
   - להרחיב את ה-post-processing/validation כך שיזהה ויתקן פלטים מהסוג:
     - `subgraph "עובד"`
     - `style "עובד" ...`
   - למפות אותם אוטומטית לייצוג Mermaid חוקי עם מזהי ASCII עקביים.
   - להשאיר את תיקוני ה-triple diamond וה-init directive הקיימים, בלי להחליף את לוגיקת ההפקה האיכותית.

3. **להקשיח את הולידציה לפני שמקבלים תרשים**
   - להוסיף בדיקות ב-`src/lib/activity-diagram-pipeline.server.ts` ו-`src/agents/diagrams/activity-swimlane.server.ts` שידחו תרשים אם עדיין יש בו:
     - `style` על שם מצוטט
     - `subgraph` בלי מזהה בטוח
     - דפוסים ידועים ששוברים את Mermaid parser
   - אם יש הפרה, להעביר לתיקון/איטרציה נוספת במקום לשמור תרשים שבור.

4. **לתקן את מסלול הודעת השגיאה**
   - ב-`src/routes/api/chat-message.ts` להפריד בין:
     - כשל אמיתי ב-extractor
     - כשל syntax/build של Mermaid אחרי extraction מוצלח
   - כך המשתמש יקבל הודעת שגיאה מדויקת ולא `activity extractor failed...` כשבפועל הבעיה היא בקוד Mermaid שנבנה.

5. **לאמת על המקרה ששבר כרגע**
   - להריץ מחדש על תהליך בקשת החופשה שכבר נשבר.
   - לוודא שהפלט הסופי נשמר עם swimlanes בעלי מזהי ASCII, style תקין, ושה-render עובר בלי parse error.

## Technical details
- קבצים צפויים:
  - `src/lib/activity-diagram-pipeline.server.ts`
  - `src/agents/diagrams/activity-swimlane.server.ts`
  - `src/routes/api/chat-message.ts`
  - אם יידרש רק לתאימות לאחור בתצוגה: `src/lib/mermaid-utils.ts`
- עיקרון מנחה: **תיקון תחבירי/מבני בלבד, בלי שום החלשה של איכות התוצרים האפיוניים.**