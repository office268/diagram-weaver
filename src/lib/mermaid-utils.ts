import mermaid from "mermaid";
import elkLayouts from "@mermaid-js/layout-elk";

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

/**
 * Targeted SVG sanitizer for Mermaid output.
 *
 * Why not DOMPurify? Mermaid v11 renders node labels as `<foreignObject>`
 * containing `<div xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel">…</span></div>`
 * and ships a `<style>` block whose CSS rules style those inner spans. DOMPurify's
 * SVG/HTML profile combinations repeatedly stripped one of: the foreignObject,
 * the inner HTML elements, or the style block — making labels invisible. The
 * back-and-forth on profile flags has been the recurring source of regressions.
 *
 * Instead we parse the SVG and remove only the dangerous bits. Mermaid runs
 * with `securityLevel: 'strict'`, which already HTML-escapes any user content
 * inside labels — so the remaining risk surface is: <script> tags, event-handler
 * attributes (onclick, onload, …), and javascript:/data: URLs in href/xlink:href.
 */
function sanitizeMermaidSvg(svg: string): string {
  if (typeof window === "undefined") return svg;

  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.nodeName === "parsererror") return "";

  // Walk every element and strip script tags + dangerous attributes.
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const toRemove: Element[] = [];
  // visit the root explicitly too
  const visit = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "script") {
      toRemove.push(el);
      return;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (
        (name === "href" || name === "xlink:href") &&
        /^\s*(javascript|data):/i.test(value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  };
  visit(root);
  let n: Node | null = walker.nextNode();
  while (n) {
    visit(n as Element);
    n = walker.nextNode();
  }
  for (const el of toRemove) el.remove();

  return new XMLSerializer().serializeToString(root);
}

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

export async function renderMermaid(
  code: string
): Promise<{ svg: string; error: null } | { svg: null; error: string }> {
  initMermaid();
  const safeCode = repairTripleDiamond(repairMermaidInitDirective(code));
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
