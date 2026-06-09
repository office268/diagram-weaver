## הבעיה

זו **לא** אותה בעיה כמו הקודמת. ה-pg_net timeout (120s) כבר תוקן. הפעם זה timeout פנימי בקוד:

```
src/lib/diagram-job.server.ts:31
const STEP_TIMEOUT_MS = 90 * 1000;
```

שלב ה-Extractor של activity swimlane (`runExtractorAgent` → Gemini 2.5 Pro + פרומפט עברי + JSON מובנה של עד 16k tokens) חורג לעיתים מ-90 שניות, ו-`withTimeout` זורק `"extractor step timed out after 90s"` עוד לפני שהמודל מסיים. זו השגיאה שהתקבלה.

## התיקון המוצע

1. **להעלות `STEP_TIMEOUT_MS` מ-90s ל-180s** ב-`src/lib/diagram-job.server.ts`.
   - עדיין בטוח: ה-pg_net timeout הוא 120s לכל קריאה, וה-job pipeline מבוצע step-by-step עם lease — כל step שלא נגמר ב-pg_net call אחד פשוט יורם ב-call הבא. הגבול האמיתי הוא ה-Worker CPU/wall-clock של Cloudflare, שמאפשר subrequests ארוכים בהרבה.
   - 180s נותן מרווח נוח גם ל-Extractor של פרומפטים ארוכים וגם ל-Builder ול-Fixer.

2. **עדכון `RF_JSON_LEASE_MS`** מ-2 דק' ל-3.5 דק' כדי שיתאים ל-step timeout החדש (אחרת lease יפוג לפני שה-step יספיק להיכשל ב-timeout שלו עצמו).

3. **לא נוגעים** בפרומפטים, ב-system prompts, ב-schema, ב-validation, ב-self-critique או ב-MAX_FIX_ITERATIONS — בהתאם ל-memory של הפרויקט.

## קבצים שישתנו

- `src/lib/diagram-job.server.ts` — שתי קונסטנטות בלבד (שורות 31-32).

## אימות

לאחר הפריסה — לשלוח בקשת activity swimlane (אותה הודעה שנכשלה) ולוודא שה-Extractor מסיים, שה-stage עובר ל-`building`, ובסוף נשמר SVG עם `diagram_id`.
