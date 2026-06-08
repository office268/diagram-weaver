## הבעיה
יצירת ה-activity לא נכשלה בקוד — היא נקטעה. שרת ה-dev אותחל (`exited with code 143`) באמצע ריצת האורקסטרטור, ה-stream נסגר ללקוח (`תגובת השרת נקטעה`), והאורקסטרטור פשוט מת. ה-`try/catch` שמתעד `status:'failed'` לא רץ כי לא הייתה זריקת חריגה — התהליך הופסק.

לכן: טוקנים נצרכו, אבל אין שום רשומה ב-`ai_usage_events`.

## מטרה
שכל בקשה שמתחילה ליצור artifact תייצר רשומת עלות סופית, גם אם החיבור נקטע / השרת מת / המשתמש סגר את הטאב.

## פתרון
ב-`src/routes/api/chat-message.ts`, סביב ה-diagram path וה-spec_document path:

1. **מאזין לקטיעה**: לרשום `request.signal.addEventListener('abort', ...)` בתחילת ה-handler. בקריאה: לקרוא `tracker.totals()` ולבצע `logAiUsage` עם `status:'failed'`, `errorMessage:'stream aborted'`.
2. **דגל "כבר תועד"**: בוליאני `usageLogged` שמסומן ב-true אחרי כל קריאה ל-`logAiUsage` (הצלחה / כשל / abort). ה-handler של abort בודק את הדגל ולא מתעד פעמיים.
3. **`finally` נוסף**: בבלוק ה-`finally` הקיים (שעושה `clearInterval(heartbeat); close()`), אם `usageLogged === false` וה-tracker צבר טוקנים — לרשום `status:'failed'` עם `errorMessage:'incomplete'`. זה תופס גם את המקרה של SIGTERM שלא מפעיל את ה-abort signal.
4. **מעבירים את ה-tracker למעלה**: כרגע `diagramTracker` נוצר בתוך ה-`else` של ה-diagram path. צריך להקדים את היצירה שלו ושל ה-tracker של ה-spec_document לפני ה-`try` החיצוני, כדי שה-abort handler וה-`finally` יוכלו לגשת אליהם.

## קבצים
- `src/routes/api/chat-message.ts` — בלבד. שינוי מינימלי, לא נוגע ב-pipelines של ה-AI עצמם, לא משנה פרומפטים/סכמות/ולידציה.

## מה לא נעשה
- לא נוגעים ב-`activity-swimlane.server.ts`, ב-`activity-diagram-pipeline.server.ts`, ב-`rf-json.server.ts` — איכות התוצרים האפיוניים נשמרת.
- לא נוגעים בסכמת ה-DB — `status` ו-`error_message` כבר קיימים.
- לא נוגעים ב-UI — ה-badge "נכשל" כבר ידע להציג את הרשומה החדשה.
