## מה משתנה בדף `agent-conversations/$id`

מסירים את כל שורת הבקרים התחתונה (בוחר דובר + "בחר דובר וצור תגובה" + "סבב מלא"). נשארת רק תיבת הודעת המנחה עם כפתור השליחה.

## התנהגות חדשה

לאחר שליחת הודעת מנחה: אוטומטית מריצים `pickNextSpeaker` כדי שה-LLM יבחר מי ידבר (תוך התחשבות בהודעת המנחה — אם המשתמש כתב "אני רוצה שX יענה", המודל יזהה ויבחר), ואז קוראים ל-`/api/agent-turn` כדי לייצר תגובה. אם המשתמש שולח הודעת מנחה ריקה — לא נתמך יותר (אין כפתור נפרד); המשתמש חייב לכתוב משהו.

> שאלה: האם זה מקובל שאי אפשר יותר "להריץ סיבוב" בלי לכתוב הודעה? אם רוצים גם דרך לדחוף סוכן בלי טקסט — אפשר להשאיר כפתור קטן "המשך" שמפעיל pick+generate בלי הודעה. אחרת — נסיר לגמרי.

## קוד למחיקה

ב-`src/routes/_authenticated/agent-conversations.$id.tsx`:
- state: `speakerId`, `picking`
- imports: `Select*`, `Sparkles`, `pickNextSpeaker`, `pickFn`
- `useEffect` של ברירת מחדל ל-speakerId
- פונקציות `pickAndGenerate`, `runRound`
- ה-`useEffect` שמגדיר speakerId ראשוני
- שורת ה-`<Select>` + כפתורי "בחר דובר וצור תגובה" + "סבב מלא"

## קוד שמתווסף

ב-`sendModerator.onSuccess`: אחרי `invalidateQueries`, מפעילים:
1. `pickFn({ data: { conversationId: id } })` → מקבלים personaId
2. `generateTurn(personaId)` — הקיים, רק נשאיר אותו (לא מוסר).

`generating` עדיין מוצג בזמן יצירת התגובה.
