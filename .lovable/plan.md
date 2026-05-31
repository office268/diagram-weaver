## הוספת ידע ארגוני/עסקי ברמת המשתמש וברמת הפרויקט

### מה המשתמש יקבל
- שדה "ידע ארגוני / עסקי" אישי בהגדרות (חל על כל המסמכים של המשתמש).
- שדה "ידע על הפרויקט" בתוך כל פרויקט (חל רק על מסמכים בפרויקט הזה).
- בעת יצירת/שיפור/ביקורת מסמך אפיון — הידע הזה נשלח אוטומטית למודל כקונטקסט נוסף, כך שהפלט מותאם לעסק ולפרויקט.

### שינויי מסד נתונים (מיגרציה)
- `ai_settings`: הוספת עמודה `business_knowledge text not null default ''` (עד ~10,000 תווים — נאכף בולידציה).
- `projects`: הוספת עמודה `business_knowledge text not null default ''`.
- אין צורך בשינויי RLS — המדיניות הקיימת על שתי הטבלאות כבר מגנה לפי `user_id`.

### Backend (server functions + API)
1. `src/lib/ai-settings.functions.ts` — להרחיב את `getAiSettings`/`updateAiSettings` עם שדה `business_knowledge` (Zod: `max(10000)`, מאפשר ריק).
2. `src/lib/project.functions.ts` — להוסיף `updateProjectKnowledge({ projectId, businessKnowledge })` ולהחזיר את השדה גם ב-`getProject`.
3. `src/routes/api/generate-spec.ts` (וגם `review-spec.ts`, `improve-section.ts`):
   - להוסיף ל-Body: `projectId?: uuid`.
   - לפני הקריאה למודל, לטעון מ-Supabase (admin client): `ai_settings.business_knowledge` של המשתמש, וכן `projects.business_knowledge` (רק אם ה-projectId שייך למשתמש).
   - להזריק לפני ה-userPrompt בלוק:
     ```
     ## ידע ארגוני של המשתמש
     {user.business_knowledge}

     ## ידע על הפרויקט
     {project.business_knowledge}
     ```
     רק אם השדה לא ריק. נשאר לפני הפרומפט המקורי של המשתמש כדי שלא להחליף את ה-system instruction של סוג המסמך.
4. בקריאות לקליינט (יצירה/שיפור/ביקורת) — להעביר את `projectId` הקיים (זמין בעמוד הפרויקט/העורך).

### UI
1. רכיב חדש `src/components/business-knowledge-card.tsx` — `Textarea` עם כותרת/תיאור/שמירה (debounced) + טוסט.
2. `src/routes/_authenticated/settings.tsx` — להוסיף סקשן "ידע ארגוני / עסקי שלי" עם הרכיב במצב user-level (גם למשתמשים שאינם אדמין).
3. `src/routes/_authenticated/projects.$projectId.tsx` — להוסיף סקשן "ידע על הפרויקט" עם אותו רכיב במצב project-level.
4. UX: placeholder עם דוגמאות (תחום, מוצרים, מונחים פנימיים, אילוצים רגולטוריים), מונה תווים, ומידע שזה נשלח ל-AI עם כל יצירה.

### נקודות שכדאי לוודא איתי לפני בנייה
- מגבלת אורך: 10,000 תווים לכל שדה — מתאים, או להגדיל/להקטין?
- האם להוסיף שדה "ידע עסקי" גם כקטע ערוך לכל מסמך, או לעצור ברמות user + project?
