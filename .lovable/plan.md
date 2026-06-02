
# החזרת הסוכן המבקר ל-`/api/generate-spec`

## המטרה
להחזיר את שלב הביקורת לתוך אותה בקשת יצירה, בלי לחזור ל-timeout של ה-upstream proxy (60 שניות).

## הרעיון
היום כל ה-pipeline רץ בתוך `runOrchestrator` כבלוק אחד, וה-heartbeat (רווחים) שומר על החיבור פתוח. הבעיה ב-timeout לא הייתה החיבור — אלא שהמודל `gemini-2.5-pro` של המבקר לבדו לקח יותר מדי זמן בתוך אותה קריאה, ולפעמים חצה את גבול ה-edge proxy לפני שה-JSON הסופי נשלח.

הפתרון: לשנות את החוזה של ה-endpoint כך שישלח **שני מטענים מובחנים בתוך אותו stream**, עם מפרידים ברורים:

```
{ ...spec JSON... }
__REVIEW__
{ ...review JSON... }
```

הספק (spec) נשלח **מיד כשהוא מוכן** (לפני הביקורת), אז אם הביקורת תיכשל או תיחתך — הלקוח כבר קיבל את המסמך השלם. הביקורת היא "תוספת" שמגיעה אחר כך באותו חיבור.

## שינויים נדרשים

### 1. `src/lib/agents/orchestrator.server.ts`
- להוסיף callback חדש `onSpecReady?: (spec: SpecOutput) => void` ל-`RunParams`
- בתוך `runOrchestrator`, מיד אחרי `assemble(...)` הראשון (לפני `runReviewAgent`), לקרוא ל-`onSpecReady(currentSpec)` אם הוגדר
- להחזיר את `skipReview: false` כברירת מחדל (קוד הביקורת כבר קיים, רק ה-flag שמדלג עליו ב-API ייעלם)

### 2. `src/routes/api/generate-spec.ts`
- להסיר את `skipReview: true` ו-`maxIterations: 1`
- להעביר `onSpecReady` שעושה:
  ```
  safeEnqueue(JSON.stringify(spec));
  safeEnqueue("\n__REVIEW__\n");
  ```
- אחרי שה-orchestrator מסיים, לשלוח את `result.review` כ-JSON שני
- ה-heartbeat נשאר כפי שהוא, ושומר על החיבור פתוח בזמן שהמבקר רץ

### 3. הלקוח שצורך את `/api/generate-spec` (לאתר ב-`src/lib/spec.functions.ts` או באזור ה-editor)
- לפצל את התשובה לפי המפריד `__REVIEW__`
- לפענח את החלק הראשון כ-spec (כמו היום) ולהציג אותו מיד
- אם קיים חלק שני — לפענח אותו כ-review ולעדכן את ה-state של הביקורת
- ה-endpoint הנפרד `/api/review-spec` נשאר זמין ל"הרץ ביקורת שוב"

## למה זה פותר את ה-timeout
ה-upstream proxy מתחיל לספור timeout מהבייט הראשון שלא הגיע. כל עוד ה-stream שולח **משהו** (heartbeat או נתונים אמיתיים) כל פחות מ-60 שניות — החיבור חי. עכשיו ה-spec יישלח מוקדם מאוד (תוך ~15-25 שניות), ואז יש לנו את כל החלון לביקורת בלי שהלקוח "מחכה לכלום".

## הערות
- `maxIterations` חוזר ל-`MAX_ITERATIONS = 2` הדיפולטי (אפשר לשמר את הלולאה, או להגביל ל-1 אם רוצים — נחליט לפי הזמן בפועל)
- אם נרצה זהירות מוגברת, אפשר להשאיר `maxIterations: 1` ולוודא שרק קריאת ביקורת אחת רצה — ככה בטוח לא נחרוג מהזמן
