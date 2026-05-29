# הבעיה

הקריאה `generateSpecsFromAllModels` נכשלת עם **504 upstream request timeout** אחרי ~45 שניות. הסיבה: שלושת המודלים רצים בתוך serverFn אחד עם `Promise.allSettled`, והזמן הכולל = הזמן של המודל האיטי ביותר (Gemini 2.5 Pro על פרומפט מורכב בעברית יכול לקחת 60+ שניות). ה-Worker/Gateway חותך את הבקשה לפני שהיא מסתיימת, אז כל שלושת התוצאות הולכות לאיבוד — גם אלו שהספיקו.

# הפתרון

לפצל לקריאה לכל מודל בנפרד מהלקוח, במקביל. ככה:
- כל בקשה היא serverFn עצמאי עם timeout משלה
- מודלים מהירים (Gemini Flash, GPT-5 mini) מחזירים תוצאה תוך 10-20 שניות ומוצגים מיד
- אם Gemini 2.5 Pro נופל ב-timeout, השניים האחרים עדיין נשמרים
- המשתמש רואה loading per-model ויכול לבחור גם לפני שכולם הסתיימו

# שינויים

### 1. `src/lib/ai-spec.functions.ts`
- להחליף את `generateSpecsFromAllModels` ב-serverFn יחיד `generateSpecFromModel` שמקבל `{ prompt, model }` ומחזיר תוצאה למודל אחד בלבד
- להוסיף `AbortSignal` עם timeout של 55 שניות (קצת פחות מה-60s של ה-gateway) כדי לקבל הודעת שגיאה ברורה במקום 504

### 2. `src/routes/_authenticated/dashboard.tsx`
- במקום קריאה אחת ל-`generateSpecsFromAllModels`, להריץ 3 קריאות `Promise.allSettled` בלקוח, כל אחת ל-`generateSpecFromModel` עם מודל אחר
- להחזיק state של `Record<model, { status: 'loading' | 'success' | 'error', data?, error? }>`
- לעדכן state אינקרמנטלית כשכל קריאה חוזרת (לא לחכות לכולן)
- ב-`ComparisonDialog`: כל טאב מציג מצב משלו — loading spinner / תוצאה / הודעת שגיאה + כפתור "נסה שוב" שמריץ רק את המודל הזה
- כפתור "בחר" זמין ברגע שהמודל הספציפי הצליח, גם אם האחרים עדיין רצים

# למה זה עובד

- ה-504 נגרם מבקשה אחת ארוכה. שלוש בקשות קצרות יותר לא נחתכות.
- חוויית משתמש משתפרת: רואים תוצאות ראשונות תוך שניות במקום לחכות לאיטי
- עמידות: כשל של מודל אחד לא הורס את האחרים

# ללא שינוי
- סכימת DB, RLS, `createSpec`, `ai-spec-defaults.ts`, מסך ההגדרות
