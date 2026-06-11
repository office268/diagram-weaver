// ============================================================
// src/lib/doc-types/types.ts
// ספריית עזר (lib) — doc-types.ts
// ============================================================
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
  "requirements_combined",
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
}

// Public, client-safe metadata for each document type.
// The AI system instructions per type live in `doc-types.server.ts`.
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
  },
  requirements_combined: {
    key: "requirements_combined",
    label: "מסמך דרישות (עסקי + טכני)",
    description: "מסמך אחד מאוחד: מטרות, KPIs, בעלי עניין, דרישות עסקיות + פונקציונליות, NFRs, ארכיטקטורה ומודל נתונים.",
    sectionOrder: [
      "user_prompt",
      "overview",
      "goals",
      "personas",
      "functional_requirements",
      "non_functional_requirements",
      "architecture",
      "data_model",
      "assumptions",
      "risks",
      "user_notes",
    ],
    sectionTitles: {
      overview: "רקע עסקי ותיאור טכני",
      goals: "מטרות עסקיות ו-KPIs",
      personas: "בעלי עניין ומשתמשי קצה",
      functional_requirements: "דרישות עסקיות ופונקציונליות",
      non_functional_requirements: "דרישות לא־פונקציונליות (NFRs)",
      architecture: "ארכיטקטורה ואינטגרציות",
      data_model: "מודל נתונים",
      assumptions: "הנחות, אילוצים והגבלות",
      risks: "סיכונים (עסקיים וטכניים)",
    },
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
  },
};

export function getDocType(key: string | null | undefined): DocTypeDef {
  if (key && (DOC_TYPE_KEYS as readonly string[]).includes(key)) {
    return DOC_TYPES[key as DocTypeKey];
  }
  return DOC_TYPES.spec_overview;
}

import { Briefcase, Cpu, Rocket, LayoutTemplate, FileCode2, type LucideIcon } from "lucide-react";

export interface DocTypeVisual {
  icon: LucideIcon;
  /** Tailwind text-color class for the icon. */
  colorClass: string;
}

export const DOC_TYPE_VISUALS: Record<DocTypeKey, DocTypeVisual> = {
  business_requirements: { icon: Briefcase, colorClass: "text-amber-500" },
  technical_requirements: { icon: Cpu, colorClass: "text-sky-500" },
  requirements_combined: { icon: Briefcase, colorClass: "text-amber-500" },
  initiation: { icon: Rocket, colorClass: "text-violet-500" },
  spec_overview: { icon: LayoutTemplate, colorClass: "text-primary" },
  spec_detailed: { icon: FileCode2, colorClass: "text-emerald-500" },
};

export function getDocTypeVisual(key: string | null | undefined): DocTypeVisual {
  if (key && (DOC_TYPE_KEYS as readonly string[]).includes(key)) {
    return DOC_TYPE_VISUALS[key as DocTypeKey];
  }
  return DOC_TYPE_VISUALS.spec_overview;
}
