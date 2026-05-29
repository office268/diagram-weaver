## מטרה
בלחיצה על "צור מסמך" — להריץ את אותו פרומפט במקביל על שלושת המודלים, להציג את התוצאות זו לצד זו, ולתת למשתמש לבחור איזה מסמך לשמור (או לבטל).

## המודלים להשוואה
1. `google/gemini-2.5-pro` — נוכחי
2. `google/gemini-3-flash-preview` — Gemini מהיר
3. `openai/gpt-5-mini` — OpenAI

## טיפול ב-structured output
gemini-2.5-pro לא תומך ב-`Output.object` דרך ה-gateway (זו הסיבה שהיצירה נכשלה). כדי שכל שלושת המודלים יעבדו על מסלול אחיד ויציב — מעבר ל-**JSON parsing ידני** לכל השלושה:
- ה-system instruction מורה להחזיר JSON בלבד לפי הסכמה.
- שימוש ב-`generateText` רגיל (בלי `experimental_output`).
- חילוץ JSON מהתשובה (להסיר ```json``` אם המודל הוסיף), `JSON.parse`, ואז `SpecOutputSchema.parse` (ה-Zod שכבר רוכך עם defaults) כ-validation רך.
- אם מודל אחד נכשל, השניים האחרים עדיין מוחזרים.

## שינויים

### 1. `src/lib/ai-spec.functions.ts`
- להחליף את `generateSpecFromPrompt` ב-`generateSpecsFromAllModels`:
  - מקבל `prompt`.
  - מריץ `Promise.allSettled` על 3 קריאות (אחת לכל מודל).
  - כל קריאה: `generateText({ model, system, prompt })`, חילוץ + parse JSON, החזרה.
  - מחזיר `{ results: Array<{ model: string; spec: SpecContent | null; error: string | null }> }`.
- הסרת `Output.object` ו-`experimental_output`.
- ה-system instruction נטען עדיין מ-`ai_settings` (כמו היום), עם תוספת קבועה: "החזר JSON תקני בלבד לפי הסכמה, ללא ```json``` ובלי טקסט נוסף".

### 2. `src/lib/ai-spec-defaults.ts`
- להוסיף `COMPARISON_MODELS = ["google/gemini-2.5-pro", "google/gemini-3-flash-preview", "openai/gpt-5-mini"]`.
- להחליף `SPEC_MODEL` (יחיד) בשימוש בקבוע הזה.

### 3. `src/routes/_authenticated/dashboard.tsx`
- ה-mutation לא יוצר עוד מסמך אוטומטית. במקום זאת:
  - שולח לפונקציה החדשה ומקבל 3 תוצאות.
  - פותח **דיאלוג השוואה חדש** (במקום לנווט לעורך).
- כשהמשתמש בוחר אחד — `createSpec` נקרא עם ה-spec של המודל שנבחר (וגם עם metadata על המודל בכותרת/פרומפט), ואז ניווט לעורך.

### 4. דיאלוג השוואה חדש (קומפוננטה חדשה בתוך `dashboard.tsx` או קובץ נפרד `spec-comparison-dialog.tsx`)
- שלוש כרטיסיות / שלוש עמודות (במובייל — Tabs; בדסקטופ — 3 עמודות).
- כל עמודה מציגה:
  - שם המודל בכותרת.
  - תקציר קצר של המסמך: כותרת, סקירה, מספר דרישות/personas/תרחישים/סיכונים (כדי להבין במבט מהיר).
  - תצוגה מתקפלת של כל הסעיפים (Accordion) למי שרוצה לראות הכל.
  - כפתור "בחר מסמך זה" שיוצר ושומר.
- מצב שגיאה לכל עמודה (אם מודל מסוים נכשל) — הצגת השגיאה והשארת הטקסט במקום ההזנה כדי לאפשר ניסיון חוזר.

### 5. ה-system instruction בעמוד `/settings`
- ללא שינוי מבחינת UI, אבל הטקסט שמוצג כ"תבנית פרומפט" יעודכן לציין שהקריאה רצה מקבילית על 3 מודלים.

## לא משתנה
- מבנה ה-sp