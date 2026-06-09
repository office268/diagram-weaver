## הבעיה האמיתית

האבחנה של קלוד שגויה — `LOVABLE_API_KEY` קיים בפרויקט וטעון בקוד. הבעיה במקום אחר לגמרי.

תשובות ה־HTTP של pg_net מראות בדיוק מה קורה:

```
06:33:31 → Timeout of 5000 ms reached (pg_net ניתק)
06:34:01 → {"processed":false} (ג'וב נעול, claim לא תופס)
06:34:31 → {"processed":false}
... וכך עד ש־reset_stuck_diagram_jobs מסמן "stuck timeout" אחרי 5 דקות
```

`pg_net.http_post` ברירת המחדל היא **timeout של 5 שניות**. ה־worker שלנו (`/api/public/hooks/process-diagram-jobs`) מבצע קריאה ל־Gemini 2.5 Pro עם פרומפט עברי ארוך — זה לוקח 30-90 שניות. ה־cron מתנתק אחרי 5 שניות, הג'וב נשאר תקוע ב־`status='processing'`, ולא יש שום worker שיגמור אותו עד שה־reset יזרוק אותו ל־failed.

## התיקון

1. **לעדכן את ה־cron schedule** כך שיקרא ל־`net.http_post` עם `timeout_milliseconds := 120000` (2 דקות), במקום 5000 ברירת המחדל. זה הצעד היחיד שפותר את הבעיה לאמת.

2. **לקצר את חלון ה־reset_stuck_diagram_jobs מ־5 דקות ל־2.5 דקות** — אחרי שה־timeout הוא 2 דקות, אין סיבה לחכות 5 דקות לאישור תקיעה. זה ייתן fail מהיר יותר במקרה אמת של תקיעה.

3. **הוספת logging מינימלי** ב־`runSingleShotJob` בנקודות הקריטיות (לפני/אחרי קריאת ה־LLM, לפני/אחרי insert של diagram) כדי שאם זה ייתקע שוב נראה איפה בדיוק.

## הבהרה חשובה

**לא נוגעים בפרומפטים, ב־system prompts, ב־schema, בולידציה, ב־thinking steps או ב־self-critique** — זה בהתאם ל־memory של הפרויקט. כל השינוי הוא תשתיתי (cron + reset + log).

## קבצים שצפויים להשתנות

- migration חדשה: `unschedule` + `schedule` מחדש של ה־cron עם `timeout_milliseconds`.
- migration חדשה (או באותה): עדכון פרמטר `_stale_minutes` בקריאה ל־`reset_stuck_diagram_jobs` (או הקריאה ב־`process-diagram-jobs.ts`).
- `src/lib/diagram-job.server.ts` או `src/routes/api/public/hooks/process-diagram-jobs.ts`: 3–4 שורות `console.log`.

## אימות

לאחר הפריסה: שולחים פרומפט useCase קצר, מוודאים בלוגי `net._http_response` שאין `timed_out=t`, ובוחנים ב־`diagram_jobs` שהסטטוס הופך ל־`done` עם `diagram_id` ו־`completed_at` מלאים.
