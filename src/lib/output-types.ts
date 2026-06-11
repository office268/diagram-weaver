// ============================================================
// src/lib/output-types.ts
// ספריית עזר (lib) — output-types.ts
// ============================================================
// Unified catalog of all "output types" a user can create from the home tiles:
// document types (BRD/TRD/initiation/spec) + diagram types (mermaid).
import {
  Briefcase,
  Cpu,
  Rocket,
  LayoutTemplate,
  FileCode2,
  GitBranch,
  Users,
  ArrowRightLeft,
  Activity,
  Server,
  Database,
  BookOpen,
  Mic,
  Workflow,
  List,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

export type DocumentOutputKey =
  | "business_requirements"
  | "technical_requirements"
  | "requirements_combined"
  | "initiation"
  | "spec_overview"
  | "spec_detailed"
  | "user_guide"
  | "meeting_summary"
  | "user_story"
  | "dashboard";



export type DiagramOutputKey =
  | "diagram_flow"
  | "diagram_usecase"
  | "diagram_sequence"
  | "diagram_state"
  | "diagram_deployment"
  | "diagram_erd"
  | "diagram_activity";


export type OutputKey = DocumentOutputKey | DiagramOutputKey;

export type OutputCategory = "document" | "diagram";

export interface OutputTypeDef {
  key: OutputKey;
  category: OutputCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  colorClass: string;
  /** For diagram types only — Mermaid header (e.g. "flowchart TD") */
  mermaidHint?: string;
}

// Order chosen to mirror a typical analysis workflow:
// initiation → business → use-cases → technical → spec overview →
// flow → sequence → spec detailed → state → deployment.
export const OUTPUT_TYPES: Record<OutputKey, OutputTypeDef> = {
  initiation: {
    key: "initiation",
    category: "document",
    label: "מסמך ייזום",
    description: "רקע, מטרות, היקף, אבני דרך וסיכוני פרויקט.",
    icon: Rocket,
    colorClass: "text-violet-500",
  },
  business_requirements: {
    key: "business_requirements",
    category: "document",
    label: "מסמך דרישות עסקי / טכני",
    description: "מטרות עסקיות, KPIs, בעלי עניין ודרישות עסקיות.",
    icon: Briefcase,
    colorClass: "text-amber-500",
  },
  diagram_usecase: {
    key: "diagram_usecase",
    category: "diagram",
    label: "useCase diagram",
    description: "מי המשתמשים, אילו פעולות הם מבצעים והאינטראקציות.",
    icon: Users,
    colorClass: "text-amber-500",
    mermaidHint: "flowchart LR",
  },
  technical_requirements: {
    key: "technical_requirements",
    category: "document",
    label: "מסמך דרישות טכני",
    description: "דרישות מערכת, אינטגרציות, NFRs ואילוצים טכניים.",
    icon: Cpu,
    colorClass: "text-sky-500",
  },
  requirements_combined: {
    key: "requirements_combined",
    category: "document",
    label: "מסמך דרישות\n(עסקי + טכני)",
    description: "",
    icon: Briefcase,
    colorClass: "text-amber-500",
  },

  spec_overview: {
    key: "spec_overview",
    category: "document",
    label: "אפיון על",
    description: "אפיון מערכת ברמה גבוהה: דרישות, ארכיטקטורה ומודל נתונים.",
    icon: LayoutTemplate,
    colorClass: "text-primary",
  },
  diagram_flow: {
    key: "diagram_flow",
    category: "diagram",
    label: "Flow Chart",
    description: "זרימת תהליך עסקי או טכני עם החלטות וצעדים.",
    icon: GitBranch,
    colorClass: "text-primary",
    mermaidHint: "flowchart TD",
  },
  diagram_sequence: {
    key: "diagram_sequence",
    category: "diagram",
    label: "sequence diagram",
    description: "סדר הקריאות בין רכיבים/שחקנים לאורך זמן.",
    icon: ArrowRightLeft,
    colorClass: "text-sky-500",
    mermaidHint: "sequenceDiagram",
  },
  spec_detailed: {
    key: "spec_detailed",
    category: "document",
    label: "אפיון מפורט",
    description: "אפיון מעמיק: תרחישי שימוש, רכיבים, מודל נתונים מלא.",
    icon: FileCode2,
    colorClass: "text-emerald-500",
  },
  diagram_state: {
    key: "diagram_state",
    category: "diagram",
    label: "state diagram",
    description: "מצבים והמעברים ביניהם של ישות במערכת.",
    icon: Activity,
    colorClass: "text-emerald-500",
    mermaidHint: "stateDiagram-v2",
  },
  diagram_deployment: {
    key: "diagram_deployment",
    category: "diagram",
    label: "deployment diagram",
    description: "טופולוגיית פריסה: שרתים, רשתות ורכיבים.",
    icon: Server,
    colorClass: "text-violet-500",
    mermaidHint: "flowchart TB",
  },
  diagram_erd: {
    key: "diagram_erd",
    category: "diagram",
    label: "ERD",
    description: "ישויות, שדות והקשרים ביניהן במודל הנתונים.",
    icon: Database,
    colorClass: "text-rose-500",
    mermaidHint: "erDiagram",
  },
  diagram_activity: {
    key: "diagram_activity",
    category: "diagram",
    label: "activity diagram",
    description: "תרחישי פעילות, זרימות עבודה ותהליכים עסקיים עם התפצלויות.",
    icon: Workflow,
    colorClass: "text-orange-500",
    mermaidHint: "flowchart RL",
  },
  user_guide: {
    key: "user_guide",
    category: "document",
    label: "מדריך למשתמש",
    description: "הסבר צעד-אחר-צעד לשימוש במערכת עבור משתמשי הקצה.",
    icon: BookOpen,
    colorClass: "text-teal-500",
  },
  meeting_summary: {
    key: "meeting_summary",
    category: "document",
    label: "תמלול וסיכום ישיבה",
    description: "",
    icon: Mic,
    colorClass: "text-rose-500",
  },
  user_story: {
    key: "user_story",
    category: "document",
    label: "User Story",
    description: "(azure/jira)",
    icon: List,
    colorClass: "text-fuchsia-500",
  },
  dashboard: {
    key: "dashboard",
    category: "document",
    label: "Dashboard",
    description: "",
    icon: LayoutDashboard,
    colorClass: "text-cyan-500",
  },
};

// Display order on the home page tiles (primary, most-used).
export const OUTPUT_TYPE_ORDER: OutputKey[] = [
  "initiation",
  "requirements_combined",
  "diagram_usecase",
  "spec_overview",
  "diagram_flow",
  "diagram_sequence",
  "diagram_erd",
  "spec_detailed",
  "diagram_activity",
  "meeting_summary",
  "user_story",
  "dashboard",
];


// Less common types — shown inside the "More…" tile.
export const OUTPUT_TYPE_EXTRAS: OutputKey[] = [
  "business_requirements",
  "technical_requirements",
  "diagram_state",
  "diagram_deployment",
  "user_guide",
];




export function getOutputType(key: string | null | undefined): OutputTypeDef | null {
  if (!key) return null;
  return (OUTPUT_TYPES as Record<string, OutputTypeDef>)[key] ?? null;
}

export function isDocumentType(key: OutputKey): key is DocumentOutputKey {
  return OUTPUT_TYPES[key].category === "document";
}

export function isDiagramType(key: OutputKey): key is DiagramOutputKey {
  return OUTPUT_TYPES[key].category === "diagram";
}
