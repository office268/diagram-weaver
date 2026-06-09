
## המטרה
בהעלאת קובץ בצ׳אט, סדר הפעולות יהיה:
1. הקובץ המקורי נשמר באחסון (Storage).
2. הקובץ מופיע מיד ברצועת ה־attachments עם סטטוס "הועלה".
3. רק אז מתחיל חילוץ הטקסט בדפדפן, עם סטטוס "מחלץ טקסט…".
4. כפתור השליחה של תיבת הפרומפט יהיה מושבת (disabled) כל עוד יש קובץ ב־`uploading` או `extracting` — וייפתח רק כשכל הקבצים במצב `ready`.

## שלב 1 — Storage: bucket חדש לקבצי צ׳אט
- ניצור bucket פרטי חדש `chat-attachments` (לא ניתן לפרסום ציבורי; הקבצים שייכים למשתמש).
- ניצור policies על `storage.objects` שמרשים ל־authenticated לקרוא/לכתוב/למחוק רק קבצים תחת prefix של ה־user id שלו (`auth.uid()::text = (storage.foldername(name))[1]`).
- מבנה נתיב: `{userId}/{threadId}/{attachmentId}/{filename}`.

## שלב 2 — מודל ה־Attachment בלקוח
ב־`src/routes/_authenticated/chat.$threadId.tsx`:

- להרחיב את `Attachment`:
  - `status: "uploading" | "uploaded" | "extracting" | "ready" | "failed"`
  - `storagePath?: string`
  - `mimeType?: string`
  - `errorMessage?: string`
- לעדכן את ה־UI ברצועת ה־attachments כך שתציג:
  - `uploading` — ספינר + "מעלה…"
  - `uploaded` — צ׳ק קטן + שם הקובץ + "הועלה"
  - `extracting` — ספינר עדין + "מחלץ טקסט…"
  - `ready` — אייקון paperclip רגיל (כמו היום)
  - `failed` — אייקון שגיאה + טקסט שגיאה קצר; X להסרה.

## שלב 3 — זרימת ההעלאה ב־`uploadFiles`
לכל קובץ במקביל:
1. יצירת `id` ו־`storagePath = {userId}/{threadId}/{id}/{fileName}` והוספה ל־state כ־`uploading`.
2. בדיקות גודל/סוג (כמו היום: עד 10MB; סוגים נתמכים בלבד).
3. `supabase.storage.from("chat-attachments").upload(storagePath, file, { contentType, upsert: false })`.
   - בכישלון: סטטוס `failed` + הודעת שגיאה ב־toast, הקובץ נשאר ברצועה עם כפתור X.
4. עדכון סטטוס ל־`uploaded` (כאן המשתמש כבר רואה "הקובץ עלה").
5. מעבר ל־`extracting` ואז קריאה ל־`extractTextFromFile(file)` כפי שנעשה כיום (חילוץ בדפדפן בלבד).
6. חיתוך ל־`MAX_CHARS = 60_000`, ועדכון ל־`ready` עם `text` ו־`truncated`.
7. בכישלון של החילוץ: סטטוס `failed`; הקובץ נשאר באחסון (כדי לאפשר התייחסות עתידית/הורדה) אבל לא ייכלל בשליחה.

הערה: אנחנו לא משנים את `/api/chat-attach`, את `text-extractor.server.ts`, או את לוגיקת ה־RAG — החילוץ ממשיך להיות בלקוח כפי שתוקן.

## שלב 4 — כפתור השליחה ולוגיקת שליחה
ב־`handleSend` וב־`disabled` של כפתור השליחה:
- "ממתין" יחושב כ־`attachments.some(a => a.status === "uploading" || a.status === "extracting")`.
- כפתור השליחה יהיה `disabled` אם:
  - `sending`, או
  - יש קובץ "ממתין" כלשהו, או
  - אין טקסט וגם אין אף קובץ ב־`ready`.
- מסירים את ה־toast "ממתין לסיום העלאת קבצים..." — הכפתור פשוט מושבת, ללא לחיצות סרק.
- ה־payload להודעה ישתמש רק ב־attachments במצב `ready` (כמו היום).

## שלב 5 — ניקוי במחיקת attachment
- `removeAttachment`: אם יש `storagePath`, גם להריץ `supabase.storage.from("chat-attachments").remove([storagePath])` ברקע (best effort, לא חוסם UI).

## קבצים שיתעדכנו
- מיגרציה חדשה: bucket `chat-attachments` + policies על `storage.objects`.
- `src/routes/_authenticated/chat.$threadId.tsx`: מודל Attachment, `uploadFiles`, רינדור הרצועה, `handleSend`, ה־`disabled` של הכפתור, `removeAttachment`.

## מה לא משתנה (שמירה על איכות תוצרים)
- ה־system prompts, סכמות הוולידציה, ה־RAG ingest, ה־`text-extractor.client.ts`, וכל ה־thinking/self-critique של הסוכנים — לא נוגעים.
