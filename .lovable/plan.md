## הבעיה

בלוג השרת מופיע:
```
[chat-message] error: SyntaxError: Unexpected token '`', "```json\n{..."
  at runDataModelAgent (src/agents/data-model/index.server.ts:89)
```

הסוכן `data-model` מחזיר JSON עטוף ב-```` ```json ```` שנחתך לפני סיום — כי `maxOutputTokens: 3000` קטן מדי לארגון מורכב. כש-`extractJson` לא מוצא `}` סוגר, הוא משאיר את ה-backticks וה-`JSON.parse` נופל. הריטריי השני קורא לאותו מודל עם אותה מגבלה (3000) → נופל שוב → כל ה-`Promise.all` באורקסטרטור קורס וה-API מחזיר `__ERROR__`.

## התיקון

**1. `src/lib/spec-output-schema.ts` — `extractJson` עמיד לחיתוך**
לפני ה-slice לפי `{...}`: אם יש פתיחת ```` ``` ```` בלי סגירה, להסיר את הפתיחה ידנית. כך גם אם ה-JSON נחתך ללא `}` סוגר, לפחות נחשוף הודעת שגיאה ברורה.

**2. `src/agents/data-model/index.server.ts` — להעלות תקציב טוקנים**
- ניסיון ראשון: `maxOutputTokens: 6000` (במקום 3000).
- ניסיון שני (fallback): `maxOutputTokens: 8000` + טמפ׳ 0 + הוראה מפורשת "JSON only, no markdown fences".

**3. אותה התאמה בסוכנים האחרים שמייצרים JSON ארוך** — `architecture`, `use-cases`, `diagrams`: העלאה ל-6000/8000 כדי למנוע אותה תקלה בעתיד.

**4. שיפור הודעת שגיאה באורקסטרטור** (`src/agents/orchestrator/index.server.ts`)
לעטוף כל קריאת סוכן ב-try/catch עם שם הסוכן בהודעה (`"data-model agent failed: ..."`), כדי שב-`__ERROR__` שמגיע ל-UI נראה איזה סוכן נפל.

## מה לא משתנה
- מבנה ה-streaming של `chat-message.ts` שעובד.
- ה-schema של הפלט.
- שום שינוי DB.

## בדיקה
לאחר היישום: לבקש שוב יצירת מסמך עם אותה פרומפט שנכשלה ולוודא שמסתיים בהצלחה. במקביל לעקוב אחרי `sqlite3 /tmp/sandbox-state.db ...` ל-vite logs כדי לוודא שאין `SyntaxError`.
