
## המטרה
לפצל את הפייפליין של `activity_swimlane` על פני קריאות cron מרובות, כך שכל שלב רץ בקריאת cron נפרדת (תחת מגבלת ה-Worker), והמשתמש רואה את התוצר החלקי מיד כשהוא מוכן — עם הודעה "עדיין בעבודה, משפר תרשים..." עד שהפייפליין מסיים.

## חוויית המשתמש
1. המשתמש שולח פרומפט → הודעת assistant נוצרת מיד עם סטטוס "בטיפול".
2. תוך 30-90 שנ' (אחרי Builder) — ההודעה מתעדכנת עם **התרשים הראשוני (SVG)** + כיתוב "תרשים ראשוני מוכן, ממשיך לשפר..."
3. כל איטרציית Validator+Fixer שמסתיימת מחליפה את ה-SVG בהודעה בגרסה משופרת + עדכון הכיתוב ("שיפור 1/2 הושלם...").
4. בסיום — הכיתוב נעלם, הודעת toast/notification "התרשים מוכן".
5. אם שלב נכשל — מוצג ה-SVG הטוב ביותר עד כה + הסבר.

## שלבים טכניים (תקציר)

### א. סכמת `diagram_jobs` — הוספת עמודות שלב
- `stage` (`extracting`/`building`/`validating_1`/`fixing_1`/`validating_2`/`fixing_2`/`done`)
- `process_map_json` — תוצר Extractor
- `current_svg` — ה-SVG הטוב ביותר עד כה
- `current_violations` — מערך הפרות מהוולידציה האחרונה
- `iteration` (0..maxFixIterations)
- `next_run_at` — מתי ה-cron יוכל לתפוס שוב

### ב. פיצול `runDiagramJob` ל-`runDiagramJobStep`
כל קריאה מבצעת **שלב יחיד** (קריאת LLM אחת), מעדכנת את `diagram_jobs` עם התוצר החלקי, ומחזירה. אם נשארו שלבים — `status='processing'`, `next_run_at=now()`. cron הבא יתפוס אותה.

טבלת מעברים:
```
pending     → extracting   (Extractor)
extracting  → building     (Builder) — כותב current_svg ראשון
building    → validating_1 (Validator)
validating_1→ done (אם 0 הפרות) או fixing_1 (Fixer) — מעדכן current_svg
fixing_1    → validating_2
validating_2→ done או fixing_2
fixing_2    → done
```

### ג. עדכון `claim_diagram_job` במסד
לתפוס גם jobs עם `status='processing'` ו-`next_run_at <= now()` (לא רק `pending`), כך שאיטרציות ממשיכות.

### ד. תצוגה בצ׳אט
- כשנוצר `current_svg` ראשון — להוסיף `chat_messages` עם `artifact_kind='diagram'` ו-`artifact_id` (או placeholder). השלבים הבאים **לא** מוסיפים הודעה חדשה — הם מעדכנים את ה-`diagrams` row באותו `id` (`mermaid_code = svg_חדש`).
- ההודעה תקבל שדה חדש `pending_stage` (טקסט קצר) שיוצג מתחת לתרשים. כשהשלב האחרון מסתיים — מאופס ל-NULL.
- ב-`chat.$threadId.tsx` הפולינג הקיים על `diagram_jobs` כבר ירענן את ה-diagram + הודעה, צריך רק להציג את הכיתוב.

### ה. שלב Extractor + Builder
אם Extractor או Builder נכשלים → אין מה להציג, הודעת שגיאה כרגיל.
אחרי Builder יש תרשים — מכאן והלאה כשל ב-Validator/Fixer **לא** מוחק את התוצר; שומרים את הטוב ביותר.

### ו. הגנות
- timeout לכל שלב יחיד: 90 שנ' (נמוך מ-Worker limit).
- `reset_stuck_diagram_jobs` ימשיך לזהות jobs שתקועים בשלב אחד יותר מ-3 דק'.
- מגבלת איטרציות נשארת 2 (כמו היום).

## קבצים שיושפעו
- `supabase/migrations/...` — עמודות חדשות + עדכון `claim_diagram_job` + `reset_stuck_diagram_jobs`.
- `src/lib/diagram-job.server.ts` — פיצול ל-`runDiagramJobStep` per-stage.
- `src/routes/api/public/hooks/process-diagram-jobs.ts` — קריאה ל-step במקום לפייפליין שלם.
- `src/agents/diagrams/activity-swimlane.server.ts` — לחשוף כל סוכן בנפרד (כבר מיוצא).
- `src/routes/_authenticated/chat.$threadId.tsx` — תצוגת `pending_stage` מתחת לתרשים חי.

## אישור
נדרש אישורך לפני התחלת הביצוע, כי זה משנה את ה-job runner מהותית (לא מוריד איכות — אותן קריאות LLM, אותם פרומפטים, אותן 2 איטרציות validator/fixer).
