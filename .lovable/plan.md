# תיקון: מסמך לא נוצר

## מה קרה
בלוגי השרת רואים שגיאה ברורה:
```
[chat-message] error: APICallError [AI_APICallError]: Invalid JSON response
at runReviewAgent ... at runOrchestrator ... at POST /api/chat-message
```

ה-AI gateway החזיר תשובה ריקה (רק רווחים ו-newlines) לסוכן הביקורת (`runReviewAgent`). זה קורה לפעמים תחת עומס/timeout.

הבעיה: השגיאה זרקה מתוך `generateText` עצמו (לפני שה-`try/catch` הקיים בקוד הספיק לטפל בה), וכך ה-orchestrator כולו קרס — והמסמך, שכבר נוצר ע"י כל הסוכנים הקודמים, **לא נשמר**.

## התיקון
הוספת הגנה כך ששגיאה זמנית באחד הסוכנים לא תפיל את כל יצירת המסמך:

1. **`src/agents/review/index.server.ts`** — לעטוף את `generateText` עצמו ב-`try/catch`. אם נכשל, להחזיר ברירת מחדל (`score: 8, notes: []`) — מספיק גבוה כדי לדלג על לולאת השיפור. כך המסמך כן נשמר.

2. **`src/agents/orchestrator/index.server.ts`** — לעטוף את קריאת ה-review (שורה 75 ושיפורים בלולאה) ב-`try/catch` נוסף ליתר ביטחון, כך שכשל ביקורת אף פעם לא יבטל מסמך שכבר הורכב.

3. **`src/routes/api/chat-message.ts`** — כאשר ה-orchestrator נכשל אחרי שצריכת קרדיטים כבר בוצעה, להחזיר את הקרדיטים למשתמש (השלמה ל-RPC `consume_credits`), כדי שלא יחויב על מסמך שלא נוצר.

## מחוץ לתחום
- אופטימיזציה כללית של כמות קריאות ה-AI / ירידה במספר האיטרציות — בעיית ביצועים נפרדת שאפשר לטפל בה בהמשך אם נמשיך לראות timeouts.
