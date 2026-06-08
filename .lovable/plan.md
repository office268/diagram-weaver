## מטרה
באזור שמסומן בצילום (מעל הכרטיס "אני מסייע AI מומחה...") להציג את המודל ש-ייעשה בו שימוש לחילול התוצר, ולאפשר למשתמש להחליף ל-מודל reasoning אחר עבור השיחה הספציפית הזו.

## אופן הפעולה
- **ברירת המחדל** ממשיכה להישלט על ידי האדמין דרך `ai_model_setting` (singleton).
- **לכל שיחה (thread)** ניתן להגדיר `model_override` שגובר על ברירת המחדל הגלובלית. אם השדה ריק — נופלים חזרה להגדרת האדמין.
- ההגדרה רלוונטית הן לחילול דיאגרמות (דרך `diagram_jobs.model_override`) והן לחילול מסמכים (דרך הזרימה הקיימת).
- כל מודל שניתן לבחור חייב להיות ברשימה הלבנה `ALLOWED_AGENT_MODELS` (אותה רשימה שבהגדרות האדמין), כדי לשמור על איכות התוצרים.

## שינויים

### 1. בסיס נתונים
- מיגרציה: הוספת עמודה `model_override TEXT NULL` ל-`chat_threads`. ללא ברירת מחדל. ללא שינוי במדיניות RLS — בעלות על השיחה כבר חוסמת קריאה/כתיבה לזרים.

### 2. שרת
- `src/lib/chat.functions.ts`: פונקציה חדשה `updateChatThreadModel({ threadId, model })` (server fn) שמוודאת בעלות, מאמתת ש-`model` שייך ל-`ALLOWED_AGENT_MODELS` או `null`, ומעדכנת את השיחה.
- `src/lib/ai-model-setting.functions.ts`: פונקציה חדשה `listAvailableAgentModels()` שמחזירה את `ALLOWED_AGENT_MODELS`, ה-default של האדמין, ותוויות (אותה מפה שכבר קיימת בקומפוננטת ההגדרות — תועבר לקובץ משותף `src/lib/ai-model-labels.ts`).
- `src/lib/ai-model-setting.server.ts`: חתימה חדשה `loadEffectiveModelForThread(threadId)` שמחזירה את `thread.model_override` אם תקין, אחרת `loadAgentModelOverride()`.
- `src/routes/api/chat-message.ts`: במקום `loadAgentModelOverride()` להשתמש ב-`loadEffectiveModelForThread(threadId)` בשני המקומות (נתיב מסמך + נתיב דיאגרמה). שינוי לוגי בלבד, ללא פגיעה בפרומפטים, סכמות, ולידציה, מינימומים או self-critique של הסוכנים.

### 3. UI
- קומפוננטה חדשה: `src/components/thread-model-selector.tsx` — צ'יפ קטן עם אייקון Cpu/Sparkles + שם תצוגה קצר של המודל הנוכחי + חץ. בלחיצה נפתח Popover עם רשימת המודלים המותרים (אותן תוויות כמו במסך האדמין), מסומן הנבחר. אופציה ראשונה: "ברירת מחדל של המערכת (X)" — כותב `null` ל-DB.
- `src/routes/_authenticated/chat.$threadId.tsx`:
  - באזור ה-empty state (הכרטיס המרכזי עם האייקון והכיתוב "אני מסייע AI מומחה..."), מעל הכותרת, להוסיף את ה-`ThreadModelSelector` עם תווית קטנה "מודל:". זה המקום שסומן בצילום.
  - גם בראש השיחה (אחרי שיש הודעות) להציג גרסה מינימליסטית של אותו צ'יפ כך שניתן יהיה להחליף מודל גם תוך כדי שיחה.
  - אחרי שמירה — invalidation של ה-thread query כך שהמחולל הבא ישתמש במודל החדש.

### 4. תוויות מודלים
- `src/lib/ai-model-labels.ts` (חדש): export של `MODEL_LABELS` שעבר מ-`ai-model-setting-card.tsx`. שתי הקומפוננטות (האדמין והשיחה) ישתמשו באותו מקור אמת.

## הגנות איכות
- אין כל שינוי בפרומפטים, system prompts, סכמות JSON, מינימומים, self-critique או thinking steps של הסוכנים — רק החלפת מחרוזת ה-model שמועברת ל-gateway.
- ולידציית whitelist גם בצד שרת (zod enum) וגם בצד DB (לא נדרשת constraint נוספת כי השרת חוסם).
- אם המודל השמור בשיחה הוסר אי-פעם מה-whitelist, ה-server יחזור אוטומטית לברירת המחדל של האדמין.

## טכני
```text
DB:
  ALTER TABLE chat_threads ADD COLUMN model_override TEXT NULL;

Server fn flow:
  chat-message POST
    → loadEffectiveModelForThread(threadId)
        → thread.model_override (if ALLOWED) || loadAgentModelOverride()
    → orchestrator / diagram_jobs.insert(model_override = effective)

UI flow:
  empty-state → <ThreadModelSelector threadId currentOverride/>
              → mutation updateChatThreadModel → invalidate ["chat-thread", id]
```
