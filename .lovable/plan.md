## מטרה
להחליף את אזור המודל הריק בראש כרטיס הצ'אט בשני שדות טקסט חופשיים — **שם מוצר** ו**שם פרויקט** — שיוצרים/מאתרים את הרשומות בפועל ב-DB ומשייכים אליהן את ה-thread ואת כל התוצרים האפיוניים שנוצרים בשיחה.

## UI (`src/routes/_authenticated/chat.$threadId.tsx`)
- בראש כרטיס הצ'אט (במקום שסומן באדום), שורת flex עם שני `Input` קטנים:
  - שדה ימני — "שם מוצר", ברירת מחדל `Product-00001`
  - שדה שמאלי — "שם פרויקט", ברירת מחדל `Project-00001`
- שני השדות פתוחים לעריכה חופשית. שמירה ב-blur או ב-Enter (debounce).
- ה-defaults נטענים מ-thread קיים אם כבר משויך (נשלף עם `getChatThread`); אחרת `Product-00001` / `Project-00001`.
- אינדיקציה דיסקרטית בזמן שמירה (spinner קטן ליד השדה הרלוונטי).

## Backend — סכמת DB
מיגרציה אחת:
- `ALTER TABLE public.chat_threads ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;`
- אינדקס `(user_id, project_id)`.
- פונקציית `SECURITY DEFINER` חדשה `public.ensure_product_and_project(_org_id uuid, _product_name text, _project_name text)` המחזירה `(product_id uuid, project_id uuid)`:
  - מוודאת `is_org_member(auth.uid(), _org_id)` — אחרת raise.
  - אם קיים מוצר ב-org עם השם → משתמשת בו; אחרת `INSERT` (עוקפת את מדיניות ה-RLS שמחייבת admin/owner — זו הסיבה ל-SECURITY DEFINER, ומכאן שהבדיקה הידנית של חברות בארגון חיונית).
  - אם קיים פרויקט של המשתמש תחת המוצר עם השם → משתמשת בו; אחרת `INSERT` (`user_id = auth.uid()`, `product_id = ...`).
  - מחזירה את שני ה-IDs.
- `GRANT EXECUTE ... TO authenticated`.

## Server functions
- `src/lib/chat.functions.ts` — חדש: `assignChatThreadProductProject({ threadId, productName, projectName })`:
  1. שולף את `currentOrgId` של המשתמש (כמו `useCurrentOrganization` בשרת — או מקבל אותו כ-input מהקליינט שכבר משתמש בהוק).
  2. קורא ל-RPC `ensure_product_and_project`.
  3. מעדכן `chat_threads.project_id` עבור ה-thread של המשתמש.
  4. מחזיר `{ productId, projectId, productName, projectName }`.
- `src/routes/api/chat-message.ts` (שורה 243): להחליף את `projectId: null` ב-`project_id` שנשלף מ-`chat_threads` של ה-thread הנוכחי, כך שכל יצירת `spec_documents` דרך הצ'אט תקבל שיוך אוטומטי.

## Defaults אוטומטיים
- בעת יצירת thread חדש (`createChatThread`) — לא משייכים אוטומטית. השיוך נוצר ברגע שהמשתמש שולח הודעה ראשונה או בטעינה ראשונה של הצ'אט (lazy ensure עם השמות `Product-00001` / `Project-00001` אם השדות ריקים).
- כך אין יצירת מוצרים ריקים בכל פעם שהמשתמש פותח דיאלוג בלי להתחיל שיחה.

## הערות
- לא נוגעים בפרומפטים, ב-system prompts או בלוגיקת ה-agents — שינוי UI + שיוך נתונים בלבד.
- לא מסירים שדה `model_override` הקיים; רק החלפת מיקום ה-UI שנעשתה כבר.
- שמירת השם המעודכן של מוצר/פרויקט קיים: עריכת הטקסט יוצרת/מאתרת לפי שם חדש (לא משנה את שם המוצר/פרויקט המקורי). זה מונע שינויים גורפים בטעות.

## קבצים שיתעדכנו
- מיגרציה חדשה (project_id ב-chat_threads + פונקציית RPC).
- `src/lib/chat.functions.ts`
- `src/routes/api/chat-message.ts`
- `src/routes/_authenticated/chat.$threadId.tsx`
