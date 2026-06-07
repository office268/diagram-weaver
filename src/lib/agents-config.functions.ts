import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AGENT_MODELS,
  AGENT_TEMPERATURES,
  DEFAULT_AGENT_MODEL,
  SCORE_THRESHOLD,
  MAX_ITERATIONS,
} from "@/agents/shared/constants";
import {
  HEBREW_WRITING_RULES,
  SPEC_QUALITY_CRITERIA,
  MERMAID_RULES,
  JSON_ONLY_INSTRUCTION,
} from "@/agents/shared/prompt-helpers";
import { REQUIREMENTS_SYSTEM } from "@/agents/requirements/system";
import { ARCHITECTURE_SYSTEM } from "@/agents/architecture/system";
import { DATA_MODEL_SYSTEM } from "@/agents/data-model/system";
import { USE_CASES_SYSTEM } from "@/agents/use-cases/system";
import { DIAGRAMS_SYSTEM } from "@/agents/diagrams/system";

export type AgentConfig = {
  key: string;
  name: string;
  description: string;
  role: string;
  model: string;
  modelSource: "global-override" | "default";
  temperature: number;
  maxOutputTokens: number;
  pipelineStage: string;
  inLoop: boolean;
  loopKeywords?: string[];
  systemPrompt: string;
  sharedBlocks: { name: string; content: string }[];
  promptTemplate: string[];
  reviewMeta?: {
    scoreThreshold: number;
    maxIterations: number;
  };
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("רק אדמין יכול לצפות בדף זה");
}

export const getAgentsConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { loadAgentModelOverride } = await import(
      "@/lib/ai-model-setting.server"
    );
    const effectiveModel = await loadAgentModelOverride();
    const modelSource: "global-override" | "default" =
      effectiveModel === DEFAULT_AGENT_MODEL ? "default" : "global-override";

    const REQ_TEMPLATE = [
      "knowledgeBlock — ידע ארגוני/עסקי של המשתמש (אם קיים)",
      "ragContext — קטעים רלוונטיים ממסמכים שהמשתמש העלה (RAG)",
      "Thinking — שאלות הכוונה לחשיבה לפני כתיבה",
      "Positive / Negative examples — דוגמה טובה ודוגמה גרועה לדרישה",
      "Revision block — הערות שיפור מהמבקר (רק במצב revision)",
      "User prompt — בקשת המשתמש המקורית",
      "Output schema — סכמת JSON עם מינימומים (goals≥3, FR≥5, NFR≥3...)",
      "JSON-only instruction — להחזיר רק JSON תקני",
      "Self-critique — בדיקות עצמיות לפני סיום",
    ];

    const ARCH_TEMPLATE = [
      "knowledgeBlock + ragContext",
      "דרישות שכבר נוצרו (functional + non-functional)",
      "Revision block — הערות מהמבקר (אם זה ריצת שיפור)",
      "User prompt",
      "Output schema לארכיטקטורה (components, integrations, tech stack)",
      "JSON-only instruction",
    ];

    const DATA_TEMPLATE = [
      "knowledgeBlock + ragContext",
      "דרישות פונקציונליות שכבר נוצרו",
      "User prompt",
      "Output schema למודל נתונים (entities, fields, relationships)",
      "JSON-only instruction",
    ];

    const UC_TEMPLATE = [
      "knowledgeBlock + ragContext",
      "דרישות שכבר נוצרו",
      "Revision block (במצב שיפור)",
      "User prompt",
      "Output schema לתרחישי שימוש (personas, use cases, flows)",
      "JSON-only instruction",
    ];

    const DIAG_TEMPLATE = [
      "use cases + architecture + data model שכבר נוצרו",
      "בקשה ליצירת קוד Mermaid עבור: sequence, activity (כ-flowchart TD), usecase, architecture, ER",
      "Output schema של דיאגרמות עם title + mermaid code",
      "JSON-only instruction",
    ];

    const REVIEW_TEMPLATE = [
      "פרומפט המשתמש המקורי",
      "מסמך האפיון המלא (JSON)",
      "בקשה לציון 1-10 + עד 8 הערות שיפור עם רמת חשיבות 1-10",
    ];

    const agents: AgentConfig[] = [
      {
        key: "requirements",
        name: "סוכן דרישות (Requirements)",
        description:
          "מייצר מטרות, דרישות פונקציונליות (FR), דרישות לא-פונקציונליות (NFR), הנחות וסיכונים — כולן מעוגנות בפרומפט המשתמש.",
        role: "אנליסט מערכות בכיר",
        model: effectiveModel,
        modelSource,
        temperature: AGENT_TEMPERATURES.requirements,
        maxOutputTokens: 4000,
        pipelineStage: "שלב 2 — ראשון בצנרת. תוצאתו מזינה את שאר הסוכנים.",
        inLoop: true,
        loopKeywords: ["דרישה", "FR", "NFR", "requirements", "מטרה", "סיכון", "הנחה"],
        systemPrompt: REQUIREMENTS_SYSTEM,
        sharedBlocks: [
          { name: "HEBREW_WRITING_RULES", content: HEBREW_WRITING_RULES },
          { name: "SPEC_QUALITY_CRITERIA", content: SPEC_QUALITY_CRITERIA },
          { name: "JSON_ONLY_INSTRUCTION", content: JSON_ONLY_INSTRUCTION },
        ],
        promptTemplate: REQ_TEMPLATE,
      },
      {
        key: "architecture",
        name: "סוכן ארכיטקטורה (Architecture)",
        description:
          "מעצב את הארכיטקטורה: רכיבים, אינטגרציות וסטאק טכנולוגי — כשכל רכיב מוצדק על ידי דרישה.",
        role: "ארכיטקט תוכנה בכיר",
        model: effectiveModel,
        modelSource,
        temperature: AGENT_TEMPERATURES.architecture,
        maxOutputTokens: 4000,
        pipelineStage: "שלב 3 — רץ במקביל ל-Data Model, אחרי הדרישות.",
        inLoop: true,
        loopKeywords: ["ארכיטקטורה", "architecture", "רכיב", "diagram", "דיאגרמה"],
        systemPrompt: ARCHITECTURE_SYSTEM,
        sharedBlocks: [
          { name: "HEBREW_WRITING_RULES", content: HEBREW_WRITING_RULES },
          { name: "MERMAID_RULES", content: MERMAID_RULES },
          { name: "JSON_ONLY_INSTRUCTION", content: JSON_ONLY_INSTRUCTION },
        ],
        promptTemplate: ARCH_TEMPLATE,
      },
      {
        key: "data-model",
        name: "סוכן מודל נתונים (Data Model)",
        description:
          "מעצב ישויות, שדות וקשרים. כל ישות מוצדקת על ידי דרישה פונקציונלית — אין המצאות.",
        role: "מומחה למודלי נתונים ובסיסי נתונים",
        model: effectiveModel,
        modelSource,
        temperature: AGENT_TEMPERATURES.dataModel,
        maxOutputTokens: 4000,
        pipelineStage: "שלב 3 — רץ במקביל ל-Architecture, אחרי הדרישות.",
        inLoop: false,
        systemPrompt: DATA_MODEL_SYSTEM,
        sharedBlocks: [
          { name: "HEBREW_WRITING_RULES", content: HEBREW_WRITING_RULES },
          { name: "MERMAID_RULES", content: MERMAID_RULES },
          { name: "JSON_ONLY_INSTRUCTION", content: JSON_ONLY_INSTRUCTION },
        ],
        promptTemplate: DATA_TEMPLATE,
      },
      {
        key: "use-cases",
        name: "סוכן תרחישי שימוש (Use Cases)",
        description:
          "כותב personas ותרחישי שימוש ריאליסטיים: מי עושה מה, מתי, ומה התוצאה.",
        role: "חוקר UX ואנליסט עסקי בכיר",
        model: effectiveModel,
        modelSource,
        temperature: AGENT_TEMPERATURES.useCases,
        maxOutputTokens: 4000,
        pipelineStage: "שלב 4 — אחרי דרישות וארכיטקטורה.",
        inLoop: true,
        loopKeywords: ["תרחיש", "use case", "persona", "משתמש", "זרימה"],
        systemPrompt: USE_CASES_SYSTEM,
        sharedBlocks: [
          { name: "HEBREW_WRITING_RULES", content: HEBREW_WRITING_RULES },
          { name: "JSON_ONLY_INSTRUCTION", content: JSON_ONLY_INSTRUCTION },
        ],
        promptTemplate: UC_TEMPLATE,
      },
      {
        key: "diagrams",
        name: "סוכן דיאגרמות (Diagrams)",
        description:
          "מייצר קוד Mermaid תקין: sequence, activity, use-case, architecture ו-ER.",
        role: "מומחה לדיאגרמות Mermaid",
        model: effectiveModel,
        modelSource,
        temperature: AGENT_TEMPERATURES.diagrams,
        maxOutputTokens: 4000,
        pipelineStage: "שלב 5 — אחרי תרחישי שימוש, ארכיטקטורה ומודל נתונים.",
        inLoop: true,
        loopKeywords: ["מופעל יחד עם תיקוני ארכיטקטורה או תרחישי שימוש"],
        systemPrompt: DIAGRAMS_SYSTEM,
        sharedBlocks: [
          { name: "MERMAID_RULES", content: MERMAID_RULES },
          { name: "JSON_ONLY_INSTRUCTION", content: JSON_ONLY_INSTRUCTION },
        ],
        promptTemplate: DIAG_TEMPLATE,
      },
      {
        key: "review",
        name: "סוכן בקרת איכות (Review)",
        description:
          "מבקר את המסמך המלא, נותן ציון 1-10 ועד 8 הערות שיפור מדורגות. מפעיל לולאת שיפור עד לציון הסף.",
        role: "מבקר איכות בכיר של מסמכי אפיון",
        model: effectiveModel,
        modelSource,
        temperature: AGENT_TEMPERATURES.review,
        maxOutputTokens: 2000,
        pipelineStage: "שלב 7 + לולאת שיפור — מופעל אחרי הרכבת המסמך השלם.",
        inLoop: true,
        loopKeywords: ["מפעיל את שאר הסוכנים לפי תוכן ההערות"],
        systemPrompt: [
          "אתה מבקר איכות בכיר של מסמכי אפיון מערכת.",
          "קיבלת את הפרומפט המקורי של המשתמש ואת מסמך האפיון (JSON).",
          "",
          "תפקידך: לדרג את המסמך בציון שלם בין 1 ל-10 על בסיס:",
          "- שלמות (כל הסעיפים מלאים?)",
          "- עקביות (אין סתירות בין סעיפים?)",
          "- רמת פירוט (דרישות מדידות? תרחישים ברורים?)",
          "- כיסוי הפרומפט (המסמך עונה על מה שהתבקש?)",
          "- איכות דיאגרמות Mermaid (תקניות? מייצגות?)",
          "",
          "כתוב עד 8 הערות שיפור — קצרות, קונקרטיות, מעשיות, בעברית.",
          "לכל הערה: דירוג חשיבות 1 (שולי) עד 10 (קריטי).",
          "אם המסמך מצוין — החזר notes ריק.",
          "",
          "בדיקות עקביות שחובה לבצע:",
          "- כל FR: מופיע בלפחות use case אחד?",
          "- כל persona: יש לה לפחות use case אחד?",
          "- דיאגרמות: מזהי צמתים ASCII?",
        ].join("\n"),
        sharedBlocks: [],
        promptTemplate: REVIEW_TEMPLATE,
        reviewMeta: {
          scoreThreshold: SCORE_THRESHOLD,
          maxIterations: MAX_ITERATIONS,
        },
      },
    ];

    return {
      agents,
      defaultModel: DEFAULT_AGENT_MODEL,
      allDefaults: AGENT_MODELS,
    };
  });
