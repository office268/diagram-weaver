## מטרה
להחזיר יצירה תקינה של תרשימי Activity בלי להוריד מאיכות התוצרים האפיוניים ובלי לרכך prompts / schemas / validation קיימים.

## מה אתקן
1. לייצב את שלב חילוץ מבנה התהליך כך שלא ייפול על JSON חלקי/קטוע או עטוף ב-markdown.
2. להפריד חד-משמעית בין כשל חילוץ, כשל בניית Mermaid, וכשל parse/render — כדי שהשגיאה למשתמש תהיה נכונה.
3. להוסיף בדיקת Mermaid מחייבת לפני שמירה, כדי לא לשמור תרשים שבפועל לא ניתן לרנדר.
4. להקשיח תיקונים תחביריים נקודתיים ל-Activity בלבד, בלי לפגוע בעושר/איכות התרשים.
5. לאמת end-to-end על אותו prompt מה-session replay של בקשת החופשה.

## שינויים מתוכננים
### 1) חיזוק extractor ל-Activity
**קבצים:** `src/agents/diagrams/activity-swimlane.server.ts`, `src/lib/activity-diagram-pipeline.server.ts`
- אוסיף חילוץ JSON קשיח יותר: הסרת code fences, איתור אובייקט JSON מאוזן, ניקוי תקלות נפוצות, וזיהוי פלט קטוע.
- אם זוהה truncation / JSON לא שלם, אחזיר שגיאת extractor מדויקת או retry ממוקד — לא `null` גנרי.
- אשאיר את רמת הדרישה גבוהה; לא אוריד מינימום מידע, לא ארכך schema, ולא אפחית בדיקות איכות.

### 2) ולידציית Mermaid לפני שמירה
**קבצים:** `src/routes/api/chat-message.ts`, `src/lib/mermaid-utils.ts`
- לפני insert לטבלת הדיאגרמות, אבצע parse/validation על קוד Mermaid שנוצר ל-Activity.
- אם ה-generation הצליח אבל Mermaid לא תקין, הבקשה תיכשל עם הודעה מדויקת על קוד Mermaid לא תקין — במקום להיראות ככשל extractor.
- אשמור backward compatibility לתרשימים ישנים דרך repair נקודתי בלבד, בלי "להחליק" שגיאות חדשות בשקט.

### 3) שיפור אבחון כשלי Activity
**קבצים:** `src/agents/diagrams/activity-swimlane.server.ts`, `src/routes/api/chat-message.ts`
- אפריד בין:
  - כשל בחילוץ מבנה התהליך
  - כשל בבניית Mermaid
  - כשל ב-parse/render של Mermaid
- אעדכן את שרשור השגיאה כך שהמשתמש יקבל סיבה אמיתית ויהיה אפשר לדבג מהר יותר.

### 4) הקשחת post-process / validation התחביריים
**קבצים:** `src/lib/activity-diagram-pipeline.server.ts`
- אטפל רק בדפוסים התחביריים שעדיין שוברים Mermaid ב-Activity (IDs, subgraph/style references, diamonds, labels/quotes, malformed directives) בלי לשנות את הלוגיקה האפיונית.
- אעדיף תיקונים דטרמיניסטיים ומצומצמים על פני שינויי prompt רחבים.

### 5) אימות סופי
- אריץ בדיקה על הניסוח מה-session replay: תהליך אישור בקשת חופשה עם עובד / מנהל ישיר / משאבי אנוש.
- אאמת שהבקשה יוצרת artifact תקין ושאפשר לרנדר אותו בתצוגה.
- אבדוק שהודעת שגיאה, אם קיימת, מצביעה על השלב הנכון.

## פרטים טכניים
- לא יבוצע שום שינוי שמחליש איכות: אין הורדת דרישות, אין קיצור prompts, אין הקלת validation, ואין ביטול self-checks.
- אם יידרש שינוי ב-system prompt, הוא יהיה רק תוספת תחבירית קשיחה לשמירת תקינות Mermaid — לא שינוי שמפחית איכות אפיונית.
- המיקוד הוא במסלול `diagram_activity` בלבד; לא ארחיב שינויי התנהגות לסוגי תוצרים אחרים אלא אם יש תלות ישירה.