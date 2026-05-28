import mermaid from "mermaid";

let initialized = false;

export function initMermaid() {
  if (initialized) return;
  initialized = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
    flowchart: { curve: "basis", useMaxWidth: true },
    sequence: { useMaxWidth: true },
  });
}

export function setMermaidTheme(dark: boolean) {
  initialized = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? "dark" : "default",
    securityLevel: "loose",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  });
}

let renderCounter = 0;

export async function renderMermaid(code: string): Promise<{ svg: string; error: null } | { svg: null; error: string }> {
  initMermaid();
  try {
    await mermaid.parse(code);
    const id = `m-${Date.now()}-${++renderCounter}`;
    const { svg } = await mermaid.render(id, code);
    return { svg, error: null };
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
