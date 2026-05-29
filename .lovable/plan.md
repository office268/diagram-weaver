## האבחנה

`gemini-2.5-pro` מחזיר JSON שמתחיל תקין אבל ה-stream נחתך באמצע, כך שה-`JSON.parse` בקלינט נכשל. הלוגים בשרת מראים `Invalid state: Controller is already closed` — סימן שגיאה גנרי שמסתיר את הסיבה האמיתית.

זה משאיר אותנו עיוורים לסיבה השורשית (תקרת טוקנים? שגיאת Gateway?), ובמקביל הקלינט מקבל "ניסיון לפרסר JSON חתוך" במקום הודעה ברורה.

## תיקון

### 1. `src/routes/api/generate-spec.ts`
- **להוסיף `maxOutputTokens: 8000`** ב-`streamText` כדי למנוע חיתוך בגלל תקרת ברירת-מחדל נמוכה מצד הספק.
- **לשפר את ה-handler של השגיאות**: לקרוא `await result.finishReason` ו-`await result.usage` אחרי סיום ה-stream, ואם `finishReason !== "stop"` (למשל `"length"` או `"error"`) — לשלוח `__STREAM_ERROR__:סיבה ברורה` לפני סגירה.
- **לתקן את "Controller is already closed"**: לעטוף את ה-`controller.enqueue` ב-`try/catch` ולא להפיל את ה-handler על זה, ולשמור flag `closed` כדי לא לסגור פעמיים.
- **ללוג את ה-`onError`** עם stringify מלא של ה-error (כולל cause/status), כדי שנראה את השורש בלוגים בפעם הבאה.

### 2. `src/routes/_authenticated/dashboard.tsx`
- כשה-`JSON.parse` נכשל — להציג גם את **סוף** התשובה (200 תווים אחרונים) בנוסף להתחלה. ככה רואים מיד אם זה חיתוך (מסתיים באמצע מחרוזת) או JSON שלם עם בעיה אחרת.

## מה לא משתנה
- DB, RLS, שמירה, רשימת מודלים, ברירת system instruction.
- `gemini-3-flash-preview` ממשיך לעבוד כרגיל.

## תוצאה צפויה
- אם הבעיה היא תקרת טוקנים — `maxOutputTokens: 8000` יאפשר ל-`gemini-2.5-pro` להשלים את ה-JSON.
- אם זו שגיאת Gateway — נראה בלוגים את ההודעה האמיתית במקום "Controller closed" ונדע איך לתקן.
- בכל מקרה, הקלינט יקבל הודעת שגיאה אינפורמטיבית במקום נפילת parse.