// ============================================================
// src/lib/export-agents-config.functions.ts
// Server function (createServerFn) — export-agents-config.functions.ts
// נקודת RPC מהלקוח לשרת
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("רק אדמין יכול לייצא תצורת סוכנים");
}

function authHeaders() {
  const lovable = process.env.LOVABLE_API_KEY;
  const conn = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovable) throw new Error("LOVABLE_API_KEY is not configured");
  if (!conn) throw new Error("Google Sheets connection is not linked");
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": conn,
    "Content-Type": "application/json",
  };
}

async function gatewayFetch(path: string, init: RequestInit) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Sheets API ${res.status}: ${body}`);
  }
  return res.json();
}

export const exportAgentsConfigToSheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const [
      { AGENT_TEMPERATURES, DEFAULT_AGENT_MODEL, SCORE_THRESHOLD, MAX_ITERATIONS },
      { REQUIREMENTS_SYSTEM },
      { ARCHITECTURE_SYSTEM },
      { DATA_MODEL_SYSTEM },
      { USE_CASES_SYSTEM },
      { DIAGRAMS_SYSTEM },
      { loadAgentModelOverride },
    ] = await Promise.all([
      import("@/agents/shared/constants"),
      import("@/agents/requirements/system"),
      import("@/agents/architecture/system"),
      import("@/agents/data-model/system"),
      import("@/agents/use-cases/system"),
      import("@/agents/diagrams/system"),
      import("@/lib/ai-model-setting.server"),
    ]);

    const effectiveModel = await loadAgentModelOverride();
    const modelSource =
      effectiveModel === DEFAULT_AGENT_MODEL ? "default" : "global-override";

    type Row = (string | number)[];

    const agentsHeader: Row = [
      "סוכן",
      "תפקיד",
      "מודל",
      "מקור המודל",
      "טמפרטורה",
      "Max output tokens",
      "שלב בצנרת",
      "בלולאה",
      "מילות מפתח ללולאה",
      "אורך system prompt (תווים)",
      "Score threshold",
      "Max iterations",
    ];

    const mk = (
      name: string,
      role: string,
      temp: number,
      stage: string,
      inLoop: boolean,
      keywords: string,
      sysLen: number,
      reviewMeta?: { scoreThreshold: number; maxIterations: number }
    ): Row => [
      name,
      role,
      effectiveModel,
      modelSource,
      temp,
      4000,
      stage,
      inLoop ? "כן" : "לא",
      keywords,
      sysLen,
      reviewMeta?.scoreThreshold ?? "",
      reviewMeta?.maxIterations ?? "",
    ];

    const agentsRows: Row[] = [
      agentsHeader,
      mk("סוכן דרישות", "אנליסט מערכות בכיר", AGENT_TEMPERATURES.requirements,
        "שלב 2 — ראשון בצנרת", true,
        "דרישה, FR, NFR, requirements, מטרה, סיכון, הנחה", REQUIREMENTS_SYSTEM.length),
      mk("סוכן ארכיטקטורה", "ארכיטקט תוכנה בכיר", AGENT_TEMPERATURES.architecture,
        "שלב 3 — מקביל ל-Data Model", true,
        "ארכיטקטורה, architecture, רכיב, diagram, דיאגרמה", ARCHITECTURE_SYSTEM.length),
      mk("סוכן מודל נתונים", "מומחה למודלי נתונים", AGENT_TEMPERATURES.dataModel,
        "שלב 3 — מקביל ל-Architecture", false,
        "", DATA_MODEL_SYSTEM.length),
      mk("סוכן תרחישי שימוש", "חוקר UX ואנליסט עסקי בכיר", AGENT_TEMPERATURES.useCases,
        "שלב 4 — אחרי דרישות וארכיטקטורה", true,
        "תרחיש, use case, persona, משתמש, זרימה", USE_CASES_SYSTEM.length),
      mk("סוכן דיאגרמות", "מומחה לדיאגרמות Mermaid", AGENT_TEMPERATURES.diagrams,
        "שלב 5 — אחרי תרחישי שימוש", true,
        "מופעל יחד עם תיקוני ארכיטקטורה/תרחישי שימוש", DIAGRAMS_SYSTEM.length),
      mk("סוכן בקרת איכות (Review)", "מבקר איכות בכיר", AGENT_TEMPERATURES.review,
        "שלב 7 + לולאת שיפור", true,
        "מפעיל את שאר הסוכנים לפי תוכן ההערות", 800,
        { scoreThreshold: SCORE_THRESHOLD, maxIterations: MAX_ITERATIONS }),
    ];

    const settingsHeader: Row = [
      "הגדרה",
      "סטטוס נוכחי",
      "דינאמי בזמן ריצה?",
      "חייב להיות קבוע מראש?",
      "הערות",
    ];
    const settingsRows: Row[] = [
      settingsHeader,
      ["Model (מודל)", "Override גלובלי דרך admin", "כן — אדמין משנה לכל הסוכנים", "לא", "מומלץ להוסיף per-agent override"],
      ["Temperature", "קבוע per-agent בקוד", "לא כיום", "כן ברירת מחדל, רצוי שאדמין יוכל לכוון", "השפעה מהותית על יצירתיות vs דיוק"],
      ["Max output tokens", "4000 קבוע בקוד", "לא", "כן", "שינוי דורש שיקול עלות/קטיעות"],
      ["In-loop", "קבוע per-agent", "לא", "כן", "מבני — חלק מהארכיטקטורה של הלולאה"],
      ["Loop keywords", "קבוע בקוד", "לא", "כן (כעת)", "ניתן להפוך לדינאמי אם נרצה תיוג חכם יותר"],
      ["System prompt", "קבוע per-agent בקוד", "לא", "כן — איכות תלויה בו ישירות", "שינוי דורש בדיקות איכות מסודרות"],
      ["Shared blocks (Hebrew rules, Mermaid, JSON only)", "קבוע", "לא", "כן", "תשתית — משותף לסוכנים"],
      ["Prompt template structure", "קבוע per-agent", "לא", "כן", "סדר הבלוקים בפרומפט"],
      ["Score threshold (Review)", "7 קבוע", "לא כיום", "מומלץ להפוך לדינאמי per-org", "לפרויקטים קריטיים — להעלות ל-8/9"],
      ["Max iterations (Review)", "3 קבוע", "לא כיום", "מומלץ דינאמי per-org", "תלות בעלות vs איכות"],
      ["Business knowledge", "דינאמי — נשמר per-user", "כן", "לא", "כבר קיים ב-UI"],
      ["Doc-type system instructions", "דינאמי — admin עורך", "כן (admin)", "לא", "כבר קיים ב-UI"],
      ["RAG top-K / similarity threshold", "קבוע בקוד", "לא כיום", "מומלץ דינאמי admin", "השפעה ישירה על איכות ההקשר"],
      ["Few-shot examples", "קבוע per-agent", "לא", "מומלץ דינאמי per-org", "דוגמאות מותאמות לארגון"],
      ["Reasoning effort (low/medium/high)", "לא מיושם", "אם יתווסף — דינאמי", "—", "רלוונטי ל-GPT-5 / Gemini 2.5"],
    ];

    const recHeader: Row = ["#", "המלצה", "השפעה צפויה", "מורכבות"];
    const recRows: Row[] = [
      recHeader,
      [1, "Per-agent model override (לא רק גלובלי)", "התאמת חוזק המודל למשימה — Claude לדרישות, GPT לדיאגרמות", "בינונית"],
      [2, "RAG tuning (top-K, threshold) ב-admin", "שיפור איכות ההקשר ממסמכים", "בינונית"],
      [3, "Score threshold גמיש per-org", "גמישות עלות מול איכות", "נמוכה"],
      [4, "Few-shot examples per-org", "התאמה לסגנון הארגון", "בינונית-גבוהה"],
      [5, "Reasoning effort (low/medium/high)", "שליטה בעומק חשיבה ובעלות", "נמוכה-בינונית"],
    ];

    // 1) Create spreadsheet with 3 sheets
    const created = await gatewayFetch("/spreadsheets", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          title: `תצורת סוכנים — ${new Date().toLocaleString("he-IL")}`,
        },
        sheets: [
          { properties: { title: "סוכנים", rightToLeft: true } },
          { properties: { title: "דינאמי vs קבוע", rightToLeft: true } },
          { properties: { title: "המלצות לשיפור", rightToLeft: true } },
        ],
      }),
    });

    const spreadsheetId = created.spreadsheetId as string;
    const spreadsheetUrl = created.spreadsheetUrl as string;

    // 2) Populate values
    await gatewayFetch(
      `/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: [
            { range: "סוכנים!A1", values: agentsRows },
            { range: "דינאמי vs קבוע!A1", values: settingsRows },
            { range: "המלצות לשיפור!A1", values: recRows },
          ],
        }),
      }
    );

    return { spreadsheetUrl, spreadsheetId };
  });
