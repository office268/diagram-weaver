# הבעיה המדויקת
מצאתי את הבעיה.

זו לא בעיית cron, וזו גם לא בעיית polling בצד הלקוח.

הכשל האמיתי הוא זה:

1. תרשימי `diagram_usecase` / `diagram_sequence` / `diagram_erd` / `diagram_flow` עדיין רצים במסלול `runSingleShotJob` כקריאה אחת ארוכה.
2. במסלול הזה לא נוצרת שום הודעת ביניים בצ׳אט לפני שה־AI מסיים, כי ההודעה ל־`chat_messages` נכתבת רק אחרי שה־AI מחזיר JSON סופי.
3. אם הקריאה הזאת נתקעת או נהרגת בזמן ריצה, ה־job נשאר ב־`processing`, בלי תוצר חלקי, בלי הודעת ביניים, ובסוף פונקציית `reset_stuck_diagram_jobs` מסמנת אותו כ־`failed` עם `stuck timeout`.

לכן המשתמש רואה בדיוק את מה שאתה מתאר:
- הרבה זמן "בטיפול"
- אין תשובת ביניים
- ובסוף רק timeout / תקיעה

# ההוכחה מתוך המערכת
בדקתי את ה־job של השיחה הבעייתית שלך:
- `thread_id = f14653c3-d690-4c3f-a61a-bf5035657576`
- `kind = diagram_usecase`
- הוא הסתיים כ־`failed`
- עם `error_message = stuck timeout`

ובאותה שיחה יש רק:
- הודעת משתמש
- אחר כך הודעת כשל כללית
- אין שום הודעת assistant ביניים עם תרשים או סטטוס מפורט

# איפה בדיוק זה נשבר בקוד
## 1. המסלול הבעייתי
`src/lib/diagram-job.server.ts`

בפונקציה:
```ts
runSingleShotJob(...)
```
הזרימה היא:
```text
קריאת AI ארוכה אחת
-> רק אם הצליחה: insert ל-diagrams
-> רק אז: insert ל-chat_messages
-> רק אז: status=done
```

כלומר, לפני שהקריאה מסתיימת אין בכלל מה להציג למשתמש.

## 2. לכן אין תשובת ביניים
באותו קובץ, במסלול של non-activity diagrams, אין:
- יצירת הודעת "עדיין בעבודה..." בתחילת העיבוד
- עדכון progress תוך כדי
- שמירת תוצר חלקי
- שלבים (`stage`) אמיתיים כמו שעשינו ל־`diagram_activity`

## 3. למה זה נראה תקוע
`src/routes/_authenticated/chat.$threadId.tsx`

ה־UI רק עושה polling על `diagram_jobs.status`.
אבל עבור `diagram_usecase` אין שום artifact חלקי ואין הודעת chat ביניים להציג, אז בפועל יש רק spinner.

# המסקנה
הבעיה היא לא "איפה הוא נתקע" ברמת שורה בודדת בתוך ה־AI call.

הבעיה הארכיטקטונית המדויקת היא:

```text
כל תרשימי RF-JSON עדיין ממומשים כ-single shot job,
ולכן אין יכולת אמיתית להציג intermediate result או progress,
וכשהקריאה הארוכה נתקעת/נהרגת - נשאר רק stuck timeout.
```

# מה צריך לשנות כדי לפתור באמת
לא עוד ניסוי קטן, אלא תיקון ממוקד אחד:

1. לפרק גם את מסלול `runSingleShotJob` לשלבים קצרים, או לפחות
2. לכתוב הודעת assistant ביניים מייד כש־job נלקח לעיבוד,
3. ולעדכן אותה תוך כדי / או לסמן כשל ברור אם לא נוצר תוצר בזמן.

בלי זה, ל־`diagram_usecase` לא תהיה אף פעם תשובת ביניים אמיתית.

# קבצים המעורבים ישירות
- `src/lib/diagram-job.server.ts`
- `src/routes/_authenticated/chat.$threadId.tsx`
- `src/routes/api/public/hooks/process-diagram-jobs.ts`

# מה אני מציע לבצע עכשיו
תיקון ממוקד למסלול RF-JSON בלבד:
- הודעת ביניים מיידית בצ׳אט לכל job
- fail-fast ברור אם job נשאר `processing` בלי artifact
- ובמידת הצורך פיצול גם של RF-JSON לשלבי עבודה קצרים

זה התיקון שיסגור את הבעיה האמיתית, לא עוד ניסיונות סביב timeout.