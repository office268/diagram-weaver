// Definitions of the 5 supported document types.
// Each type has its own AI system instruction + default section list/titles
// that seed the editor's section_order/section_titles on creation.

// All section keys known to the editor. Must stay in sync with
// DEFAULT_SECTIONS in src/routes/_authenticated/editor.$id.tsx.
export const ALL_SECTION_KEYS = [
  "user_prompt",
  "overview",
  "goals",
  "personas",
  "functional_requirements",
  "non_functional_requirements",
  "assumptions",
  "use_cases",
  "architecture",
  "data_model",
  "risks",
  "review",
  "user_notes",
] as const;

export const DEFAULT_SECTION_TITLES: Record<string, string> = {
  user_prompt: "הפרומפט של המשתמש",
  overview: "סקירה כללית",
  goals: "מטרות",
  personas: "משתמשי קצה",
  functional_requirements: "דרישות פונקציונליות",
  non_functional_requirements: "דרישות לא־פונקציונליות",
  assumptions: "הנחות יסוד",
  use_cases: "תרחישי שימוש",
  architecture: "ארכיטקטורה",
  data_model: "מודל נתונים",
  risks: "סיכונים",
  review: "ביקורת הסוכן המבקר",
  user_notes: "ההערות שלי",
};


export const DOC_TYPE_KEYS = [
  "business_requirements",
  "technical_requirements",
  "initiation",
  "spec_overview",
  "spec_detailed",
] as const;

export type DocTypeKey = (typeof DOC_TYPE_KEYS)[number];

export interface DocTypeDef {
  key: DocTypeKey;
  label: string;
  description: string;
  /** Ordered section keys (subset of editor's known keys) shown by default. */
  sectionOrder: string[];
  /** Custom display titles per section for this type. */
  sectionTitles: Record<string, string>;
  /** Extra instructions appended to the AI system prompt for this type. */
  systemInstruction: string;
}

export const DOC_TYPES: Record<DocTypeKey, DocTypeDef> = {
  business_requirements: {
    key: "business_requirements",
    label: "מסמך דרישות עסקי (BRD)",
    description: "מבט עסקי: מטרות, בעלי עניין, תועלות, KPIs ודרישות עסקיות.",
    sectionOrder: [
      "user_prompt",
      "overview",
      "goals",
      "personas",
      "functional_requirements",
      "assumptions",
      "risks",
      "user_notes",
    ],
    sectionTitles: {
      overview: "רקע עסקי וצורך",
      goals: "מטרות עסקיות ו-KPIs",
      personas: "בעלי עניין",
      functional_requirements: "דרישות עסקיות",
      assumptions: "הנחות והגבלות",
      risks: "סיכונים עסקיים",
    },
    systemInstruction: [
      "סוג המסמך: מסמך דרישות עסקי (BRD).",
      "התמקד בצד העסקי: רקע, צורך עסקי, מטרות מדידות (KPIs), בעלי עניין, תועלות צפויות.",
      "אל תכלול ארכיטקטורה טכנית, מודל נתונים או תרשימי מערכת.",
      "ה-personas מתארות בעלי עניין (Stakeholders).",
      "ה-functional_requirements מתארות דרישות עסקיות גבוהות, לא דרישות מערכת.",
    ].join("\n"),
  },
  technical_requirements: {
    key: "technical_requirements",
    label: "מסמך דרישות טכני (TRD)",
    description: "דרישות מערכת, אינטגרציות, תשתית, NFRs ואילוצים טכניים.",
    sectionOrder: [
      "user_prompt",
      "overview",
      "functional_requirements",
      "non_functional_requirements",
      "architecture",
      "data_model",
      "assumptions",
      "risks",
      "user_notes",
    ],
    sectionTitles: {
      overview: "תיאור טכני כללי",
      functional_requirements: "דרישות פונקציונליות (מערכת)",
      non_functional_requirements: "דרישות לא־פונקציונליות",
      architecture: "ארכיטקטורה ואינטגרציות",
      data_model: "מודל נתונים ו-APIs",
      assumptions: "אילוצים והנחות טכניות",
      risks: "סיכונים טכניים",
    },
    systemInstruction: [
      "סוג המסמך: מסמך דרישות טכני (TRD).",
      "התמקד בצד הטכני: דרישות מערכת מפורטות, אינטגרציות, חוזי APIs, מודל נתונים, ארכיטקטורה ואילוצי תשתית.",
      "הקפד על NFRs: ביצועים, אבטחה, זמינות, סקלביליות, נגישות.",
      "תרשים ארכיטקטורה ותרשים ER הם חובה.",
    ].join("\n"),
  },
  initiation: {
    key: "initiation",
    label: "מסמך ייזום (Project Initiation)",
    description: "מטרות הפרויקט, היקף, אבני דרך, תקציב, בעלי עניין וסיכונים.",
    sectionOrder: [
      "user_prompt",
      "overview",
      "goals",
      "personas",
      "assumptions",
      "risks",
      "user_notes",
    ],
    sectionTitles: {
      overview: "רקע ומטרת הפרויקט",
      goals: "יעדים, היקף ואבני דרך",
      personas: "בעלי עניין וצוות",
      assumptions: "תקציב, לוחות זמנים והנחות",
      risks: "סיכוני פרויקט",
    },
    systemInstruction: [
      "סוג המסמך: מסמך ייזום פרויקט.",
      "המסמך הוא ברמת ניהול פרויקט: מטרה, היקף (Scope/Out of Scope), אבני דרך, בעלי עניין, תקציב גס, לוחות זמנים וסיכונים.",
      "אל תכנס לפירוט טכני, ארכיטקטורה או מודל נתונים.",
    ].join("\n"),
  },
  spec_overview: {
    key: "spec_overview",
    label: "מסמך אפיון על (HLD)",
    description: "אפיון מערכת ברמה גבוהה: סקירה, דרישות, ארכיטקטורה ומודל נתונים.",
    sectionOrder: [
      "user_prompt",
      "overview",
      "goals",
      "personas",
      "functional_requirements",
      "non_functional_requirements",
      "assumptions",
      "use_cases",
      "architecture",
      "data_model",
      "risks",
      "user_notes",
    ],
    sectionTitles: {},
    systemInstruction: [
      "סוג המסמך: מסמך אפיון על (High Level Design).",
      "כסה את כל הסעיפים ברמה גבוהה אך מקיפה: סקירה, מטרות, פרסונות, דרישות, תרחישים, ארכיטקטורה ומודל נתונים.",
    ].join("\n"),
  },
  spec_detailed: {
    key: "spec_detailed",
    label: "מסמך אפיון מפורט (LLD)",
    description: "אפיון מעמיק: תרחישי שימוש מפורטים, רכיבים, זרימות ומודל נתונים מלא.",
    sectionOrder: [
      "user_prompt",
      "overview",
      "goals",
      "personas",
      "functional_requirements",
      "non_functional_requirements",
      "assumptions",
      "use_cases",
      "architecture",
      "data_model",
      "risks",
      "user_notes",
    ],
    sectionTitles: {
      overview: "סקירה מפורטת",
      functional_requirements: "דרישות פונקציונליות מפורטות",
      use_cases: "תרחישי שימוש מפורטים (כולל diagrams)",
      architecture: "ארכיטקטורה מפורטת",
      data_model: "מודל נתונים מלא (ER + שדות)",
    },
    systemInstruction: [
      "סוג המסמך: מסמך אפיון מפורט (Low Level Design).",
      "פרט לעומק כל סעיף: דרישות פונקציונליות מפורטות (לפחות 10), לפחות 4 תרחישי שימוש מלאים עם sequence diagrams, ארכיטקטורה מפורטת ומודל נתונים שכולל שדות עיקריים בכל ישות.",
      "השתמש בתיאורים ארוכים וקונקרטיים — לא נקודות כלליות.",
    ].join("\n"),
  },
};

export function getDocType(key: string | null | undefined): DocTypeDef {
  if (key && (DOC_TYPE_KEYS as readonly string[]).includes(key)) {
    return DOC_TYPES[key as DocTypeKey];
  }
  return DOC_TYPES.spec_overview;
}
