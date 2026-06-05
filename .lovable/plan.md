# דף סוכנים — תצוגת תצורה

הוספת דף חדש שמרכז את כל 6 הסוכנים של הצנרת ליצירת מסמכי אפיון, כך שתוכל לראות במבט אחד מה בעצם מגדיר את ההתנהגות והאיכות של כל סוכן.

## הסוכנים שיוצגו

1. **Requirements** — דרישות פונקציונליות, NFR, מטרות, סיכונים
2. **Architecture** — ארכיטקטורה ורכיבים
3. **Data Model** — מודל נתונים (ERD)
4. **Use Cases** — תרחישי שימוש ו-personas
5. **Diagrams** — דיאגרמות Mermaid
6. **Review** — מבקר איכות (loop עד ציון סף)

## מה יוצג לכל סוכן

כרטיס מורחב (Accordion / Collapsible) עם השדות שמשפיעים על איכות הפלט:

- **שם ותיאור התפקיד** — משפט הסבר קצר.
- **מודל** — המודל בפועל (לפי הגדרת ה-admin מ-`ai_model_setting`, אם קיימת — אחרת ברירת מחדל `google/gemini-2.5-pro`). יוצג גם המקור (גלובלי vs ברירת מחדל).
- **Temperature** — מתוך `AGENT_TEMPERATURES`.
- **System Prompt** — תוכן ה-`*_SYSTEM` המלא (Requirements / Architecture / Data Model / Use Cases / Diagrams / Review) בבלוק קוד.
- **בלוקים משותפים בפרומפט** — תצוגת `HEBREW_WRITING_RULES`, `SPEC_QUALITY_CRITERIA`, `MERMAID_RULES`, `JSON_ONLY_INSTRUCTION` המוטמעים.
- **User-prompt template** — עבור Requirements: רכיבי ה-prompt (THINKING / POSITIVE_EXAMPLE / NEGATIVE_EXAMPLE / OUTPUT_SCHEMA / SELF_CRITIQUE). לשאר הסוכנים: סיכום קצר של מה נכלל בפרומפט (knowledge block, RAG, revision notes, output schema).
- **תקרת tokens** (`maxOutputTokens`) — למשל 4000 לדרישות, 2000 לביקורת.
- **מיקום בצנרת** — שלב במסגרת ה-orchestrator (שלב 2 / מקבילי בשלב 3 / וכו'), והאם משתתף ב-loop השיפור.
- **תפקיד ב-loop השיפור** — אילו keywords מהביקורת מפעילים אותו (`reqKeywords` / `archKeywords` / `useCaseKeywords`).

לסוכן **Review** יוצג בנוסף:
- **סף ציון** (`SCORE_THRESHOLD` = 7) ו-**מקסימום iterations** (`MAX_ITERATIONS` = 3).
- **קריטריוני הציון** (מתוך ה-system prompt).

## גישה והרשאות

- הדף יהיה תחת `_authenticated` ויידרש להיות **admin** (אותה בדיקת `has_role` שמשמשת בכרטיס המודל בהגדרות).
- אם המשתמש אינו admin → הודעה "דף זה זמין לאדמין בלבד".
- זה דף **קריאה בלבד** — אין עריכה של פרומפטים או טמפרטורות בשלב הזה. רק תצוגה.

## מבנה טכני

- **ראוט חדש**: `src/routes/_authenticated/agents.tsx`.
- **server function חדש** `src/lib/agents-config.functions.ts` עם `getAgentsConfig`:
  - admin-only.
  - מחזיר מערך של 6 אובייקטים `{ key, name, description, role, model, temperature, maxOutputTokens, systemPrompt, sharedBlocks, promptTemplate, pipelineStage, loopKeywords?, reviewMeta? }`.
  - קורא את המודל האפקטיבי דרך helper שכבר קיים `loadAgentModelOverride` (`src/lib/ai-model-setting.server.ts`), עם fallback ל-`DEFAULT_AGENT_MODEL`.
  - המקור עצמו (system prompts, טמפרטורות, schemas) מיובא מ-`src/agents/**` ומ-`src/agents/shared/*`.
- **קומפוננטה** `src/components/agent-config-card.tsx` — כרטיס לכל סוכן עם Accordion סעיפים (פרומפט מערכת / בלוקים משותפים / תבנית פרומפט-משתמש / מטא-נתונים).
- **קישור ניווט**: הוספת קישור "סוכנים" בתפריט (אותו מקום שבו מופיע "שיחות סוכנים"), מוצג רק ל-admin.

## מה לא נכלל (מחוץ לסקופ)

- עריכה של פרומפטים / טמפרטורות / מודלים פר-סוכן (היום קיים רק override גלובלי).
- הצגת שיחות / היסטוריית הרצות / metrics (יש לכך כבר ai-usage).
- שינוי כלשהו בהתנהגות ה-orchestrator או הסוכנים עצמם.
