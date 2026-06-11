// ============================================================
// src/lib/diagrams/mermaid-utils.ts
// ספריית עזר (lib) — mermaid-utils.ts
// ============================================================
import mermaid from "mermaid";
import elkLayouts from "@mermaid-js/layout-elk";
import { sanitizeSvg } from "@/lib/diagrams/svg-sanitize";

let initialized = false;

const MERMAID_CONFIG = {
  startOnLoad: false,
  securityLevel: "strict" as const,
  fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  flowchart: { curve: "basis" as const, useMaxWidth: true, htmlLabels: true },
  sequence: { useMaxWidth: true, htmlLabels: false },
};

export function initMermaid() {
  if (initialized) return;
  initialized = true;
  mermaid.registerLayoutLoaders(elkLayouts);
  mermaid.initialize({ ...MERMAID_CONFIG, theme: "default" });
}

export function setMermaidTheme(dark: boolean) {
  initialized = true;
  mermaid.registerLayoutLoaders(elkLayouts);
  mermaid.initialize({ ...MERMAID_CONFIG, theme: dark ? "dark" : "default" });
}

/** @deprecated use `sanitizeSvg` from "@/lib/diagrams/svg-sanitize" directly. */
export const sanitizeMermaidSvg = sanitizeSvg;

let renderCounter = 0;

/** Repair stored diagrams whose init directive was mangled by an older
 * post-processor (e.g. `%%{{"flowchart": ...}}%%`). Strip any malformed
 * leading `%%...%%` directive — the renderer falls back to defaults. */
function repairMermaidInitDirective(code: string): string {
  const trimmed = code.trimStart();
  if (!trimmed.startsWith("%%")) return code;
  const end = trimmed.indexOf("%%", 2);
  if (end === -1) return code;
  const directive = trimmed.slice(0, end + 2);
  // A valid init directive looks like `%%{init: {...}}%%` (single braces).
  // Anything with `{{` inside the directive is the mangled form.
  if (directive.includes("{{") || directive.includes("}}")) {
    return trimmed.slice(end + 2).trimStart();
  }
  return code;
}

/** Repair diamonds wrapped one level too deep: `{{{label}}}` → `{{label}}`.
 * An older post-processor sometimes double-wrapped decision nodes; Mermaid
 * fails to parse the result with `got 'DIAMOND_START'`. Strip the extra
 * outer braces so legacy saved diagrams still render. */
function repairTripleDiamond(code: string): string {
  return code.replace(/\{\{\{([^{}]+)\}\}\}/g, "{{$1}}");
}

export function normalizeMermaidForValidation(code: string): string {
  return repairTripleDiamond(repairMermaidInitDirective(code));
}

export function getMermaidValidationError(code: string): string | null {
  const normalized = normalizeMermaidForValidation(code);

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return "קוד Mermaid ריק.";

  const subgraphStarts = lines.filter((line) => /^subgraph\b/.test(line)).length;
  const subgraphEnds = lines.filter((line) => line === "end").length;
  if (subgraphStarts !== subgraphEnds) {
    return "מספר פקודות subgraph/end אינו מאוזן.";
  }

  for (const line of lines) {
    if (/^style\s+"/.test(line)) {
      return 'פקודת style מפנה לטקסט מצוטט במקום למזהה ASCII.';
    }
    if (/^subgraph\s+"/.test(line)) {
      return 'subgraph חייב מזהה ASCII לפני התווית, למשל subgraph LANE1["עובד"].';
    }
    if (/\{\{\{/.test(line)) {
      return 'diamond הוגדר עם שלוש שכבות סוגריים במקום שתיים.';
    }
    if (/\bDONE\s*\(\s*\[/.test(line)) {
      return 'צומת הסיום DONE חייב להיכתב עם סוגריים עגולים כפולים.';
    }
    if (/fill:[^,\s]+,[a-z]/i.test(line)) {
      return 'נמצאה פקודת style פגומה עם פסיק/טקסט צמודים.';
    }
  }

  return null;
}

export async function renderMermaid(
  code: string
): Promise<{ svg: string; error: null } | { svg: null; error: string }> {
  initMermaid();
  const safeCode = normalizeMermaidForValidation(code);
  try {
    await mermaid.parse(safeCode);
    const id = `m-${Date.now()}-${++renderCounter}`;
    const { svg } = await mermaid.render(id, safeCode);
    return { svg: sanitizeMermaidSvg(svg), error: null };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { svg: null, error: message };
  }
}


export const DIAGRAM_TEMPLATES: Record<string, { label: string; code: string }> = {
  flowchart: {
    label: "Flowchart",
    code: "graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Continue]\n  B -->|No| D[Stop]",
  },
  sequence: {
    label: "Sequence",
    code: "sequenceDiagram\n  participant A as Alice\n  participant B as Bob\n  A->>B: Hello Bob\n  B-->>A: Hi Alice",
  },
  class: {
    label: "Class",
    code: "classDiagram\n  class Animal {\n    +String name\n    +eat()\n  }\n  class Dog\n  Animal <|-- Dog",
  },
  state: {
    label: "State",
    code: "stateDiagram-v2\n  [*] --> Idle\n  Idle --> Active : start\n  Active --> Idle : stop\n  Active --> [*]",
  },
  er: {
    label: "ER",
    code: "erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  ORDER ||--|{ LINE_ITEM : contains",
  },
  gantt: {
    label: "Gantt",
    code: "gantt\n  title Roadmap\n  dateFormat YYYY-MM-DD\n  section Phase 1\n  Design     :a1, 2025-01-01, 7d\n  Build      :after a1, 14d",
  },
  activity: {
    label: "Activity (swim-lanes)",
    code: "flowchart TB\n  subgraph User\n    U1[Submit form]\n  end\n  subgraph System\n    S1[Validate]\n    S2[Persist]\n  end\n  subgraph Admin\n    A1[Review]\n  end\n  U1 --> S1 --> S2 --> A1",
  },
};
