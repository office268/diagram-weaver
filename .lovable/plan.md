## הבעיה

הבקשה האחרונה ב-`/api/chat-message` (יצירת מסמך ניתוח מערכות עבור משרד עורכי דין) נכשלה עם **504 Gateway Timeout** מ-Cloudflare ב-09:19. הסיבה: ה-endpoint רץ סינכרונית — מריץ את כל ה-multi-agent orchestrator (דרישות → ארכיטקטורה → מודל נתונים → use cases → תרשימים → review, עם עד מספר איטרציות שיפור) לפני שהוא מחזיר תגובה. כשהפעולה חורגת מ-~100 שניות, ה-proxy חותך את החיבור ב-504, גם אם השרת ממשיך לעבוד. אין שום log שגיאה ב-orchestrator עצמו — הוא פשוט לא הספיק לסיים בזמן. הודעת ה-assistant לעולם לא נכתבת ל-DB, ולכן המסמך "לא נוצר".

ה-endpoint המקביל `/api/generate-spec` כבר פותר את זה באותה דרך שאני מציע — stream עם heartbeat כל 10 שניות.

## הפתרון

להפוך את `POST /api/chat-message` לתגובת stream שמשדרת תווי heartbeat בזמן שה-orchestrator רץ, ומסיימת ב-marker + JSON של התוצאה. ה-proxy לא ינתק כל עוד הוא רואה bytes זורמים. ה-client יקרא את ה-stream עד הסוף וימשוך את ה-JSON האחרון.

לא נשנה שום לוגיקה עסקית — כתיבת ההודעה ל-DB, יצירת `spec_documents`, עדכון title של ה-thread, חיוב credits, וכל ההתנהגות של מצבי `plan`/`build`/diagram נשארים זהים.

## שינויים

### `src/routes/api/chat-message.ts`
- להחזיר `Response` עם `ReadableStream` במקום `Response.json(...)` עבור שני המסלולים שעלולים להיות איטיים: מצב document ומצב diagram. מצב `plan` (קצר) נשאר JSON רגיל.
- לפני קריאה ל-`runOrchestrator` / `generateText`: לפתוח controller, לשלוח heartbeat (רווח בודד) כל 10 שניות באמצעות `setInterval`, ולאחר שהעבודה מסתיימת לשלוח שורה מסיימת בפורמט:
  ```
  \n__RESULT__\n{json}
  ```
  ואז `controller.close()` ולנקות את ה-interval.
- במקרה של שגיאה: לשלוח `\n__ERROR__\n{message}` במקום לזרוק 500 אחרי שה-headers כבר נשלחו (כל הכתיבות ל-DB של הודעת השגיאה נשמרות כפי שהן).
- Headers: `Content-Type: text/plain; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no` — בדיוק כמו ב-`generate-spec.ts`.

### `src/routes/_authenticated/chat.$threadId.tsx`
- לעדכן את ה-`fetch` ב-`sendMessage` (סביבות שורה 265) לקרוא את גוף ה-stream במקום `res.ok` בלבד:
  - אם `content-type` הוא `text/plain` (mode document/diagram): לקרוא את ה-body chunk-by-chunk, להתעלם מ-heartbeats, ולחפש `__RESULT__` או `__ERROR__` בסוף.
  - אם נמצא `__ERROR__` — להציג toast.
  - אם נמצא `__RESULT__` — לעשות `invalidateQueries` כרגיל.
- ל-`plan` mode התגובה נשארת JSON — `res.json()` כמו היום (לבדוק לפי `content-type`).

## למה זה הפתרון הנכון
- מתאים בדיוק לדפוס שכבר קיים ב-`generate-spec` באותו פרויקט — עקביות.
- שמירה על Cloudflare worker timeout (יש לו תקרה רחבה יותר מ-100s לזרמים פעילים) בלי להעביר את העבודה ל-queue ו-polling.
- אין שינוי DB, אין מיגרציות, אין פגיעה ב-RLS או באבטחה.
- ה-Hebrew UX (toasts, הודעות שגיאה) נשמר.

## מה לא משתנה
- ה-orchestrator עצמו, מספר האיטרציות, ה-models, וה-credit logic.
- מצב `plan` (כבר מהיר — נשאר JSON).
- כל שאר ה-API routes.
