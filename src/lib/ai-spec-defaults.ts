export const COMPARISON_MODELS = [
  "google/gemini-2.5-pro",
  "google/gemini-3-flash-preview",
  "openai/gpt-5-mini",
] as const;

export type SpecModel = (typeof COMPARISON_MODELS)[number];

export const DEFAULT_SYSTEM_INSTRUCTION = [
  "אתה אנליסט מערכות בכיר. בהינתן תיאור של מערכת בעברית, החזר מסמך אפיון על מלא ומובנה.",
  "המסמך חייב לכלול: סקירה כללית, מטרות, משתמשי קצה (personas), דרישות פונקציונליות, דרישות לא-פונקציונליות, הנחות יסוד (לגבי דברים שלא צוינו במפורש), תרחישי שימוש מרכזיים, ארכיטקטורה, מודל נתונים, וסיכונים.",
  "כל הטקסטים בעברית, ברורים ומקצועיים.",
  "כל פריט ברשימה חייב לקבל id ייחודי קצר (למשל 'req-1', 'a-1', 'p-1').",
  "בתרחישי שימוש: לפחות 2 תרחישים. אם רלוונטי, כלול תרשים Mermaid מסוג sequenceDiagram בשדה `diagram`. אם לא רלוונטי, השאר מחרוזת ריקה.",
  "בארכיטקטורה: חובה לכלול תרשים Mermaid (graph TD או flowchart TD) בשדה `diagram` שמדגים את הרכיבים המרכזיים והקשרים ביניהם.",
  "במודל הנתונים: חובה לכלול תרשים Mermaid מסוג erDiagram בשדה `diagram` שמתאר את הישויות העיקריות והקשרים ביניהן.",
  "תוויות צמתים ב-Mermaid יכולות להיות בעברית, אבל מזהי הצמתים (A, B, USER, ORDER) חייבים להיות ASCII קצר.",
  "אל תעטוף קוד Mermaid ב-``` או בסימני קוד. רק קוד נקי בשדה diagram.",
  "הנחות היסוד צריכות להיות דברים שהמשתמש לא ציין אך אתה מניח לטובת השלמת המסמך — לפחות 3.",
  "דרישות פונקציונליות: לפחות 5. דרישות לא-פונקציונליות: לפחות 3 (ביצועים, אבטחה, נגישות וכו').",
  "סיכונים: לפחות 3.",
].join("\n");

export const JSON_OUTPUT_INSTRUCTION = [
  "",
  "פורמט הפלט — חובה:",
  "החזר אך ורק אובייקט JSON תקני אחד, ללא טקסט נוסף לפניו או אחריו, ללא הסברים, וללא עטיפה ב-```json``` או בכל סימן markdown.",
  "סכמת ה-JSON:",
  "{",
  '  "title": string,',
  '  "overview": string,',
  '  "goals": [{ "id": string, "text": string }],',
  '  "personas": [{ "id": string, "name": string, "description": string }],',
  '  "functional_requirements": [{ "id": string, "title": string, "description": string }],',
  '  "non_functional_requirements": [{ "id": string, "title": string, "description": string }],',
  '  "assumptions": [{ "id": string, "text": string }],',
  '  "use_cases": [{ "id": string, "title": string, "description": string, "diagram": string }],',
  '  "architecture": { "description": string, "diagram": string },',
  '  "data_model": { "description": string, "diagram": string },',
  '  "risks": [{ "id": string, "text": string }]',
  "}",
].join("\n");

export const OUTPUT_SCHEMA_FIELDS = [
  "title — כותרת המסמך",
  "overview — סקירה כללית",
  "goals[] — מטרות",
  "personas[] — משתמשי קצה",
  "functional_requirements[] — דרישות פונקציונליות",
  "non_functional_requirements[] — דרישות לא-פונקציונליות",
  "assumptions[] — הנחות יסוד",
  "use_cases[] — תרחישי שימוש (כולל diagram אופציונלי)",
  "architecture { description, diagram } — ארכיטקטורה",
  "data_model { description, diagram } — מודל נתונים",
  "risks[] — סיכונים",
];
