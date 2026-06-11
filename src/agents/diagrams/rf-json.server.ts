// ============================================================
// src/agents/diagrams/rf-json.server.ts
// מודול server-only — rf-json.server.ts
// מורץ רק בצד השרת (TanStack Start)
// ============================================================
// Unified RF-JSON diagram agent — produces React Flow JSON directly via
// constrained decoding. Preserves ALL quality safeguards from the prior
// Mermaid path: content rules, minimums, self-critique, retry on validation
// failure. Zod-based constrained decoding replaces brittle regex checks.

import { generateText, Output } from "ai";
import type { DiagramOutputKey } from "@/lib/output-types";
import {
  DiagramAiOutputSchema,
  buildDiagramRF,
  validateDiagramAiOutput,
  type DiagramAiOutput,
  type DiagramRFData,
} from "@/lib/diagram-rf";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { AGENT_TEMPERATURES, DEFAULT_AGENT_MODEL } from "@/agents/shared/constants";
import type { UsageTracker } from "@/lib/ai-usage.server";
import { buildSelfCritiqueInstruction } from "@/agents/shared/prompt-helpers";

// ── Per-kind config ──────────────────────────────────────────────────────────

type KindConfig = {
  /** Short Hebrew label of the diagram type, used in system prompt. */
  label: string;
  /** Allowed node types and the rules around them — included verbatim in prompt. */
  contentRules: string;
  /** One-shot example output (JSON), matching DiagramAiOutputSchema exactly. */
  example: DiagramAiOutput;
  /** Self-critique questions specific to the kind. */
  critique: string[];
};

const FLOW_EXAMPLE: DiagramAiOutput = {
  kind: "diagram_flow",
  nodes: [
    { id: "S", type: "start", label: "" },
    { id: "T1", type: "task", label: "קליטת בקשת לקוח" },
    { id: "D1", type: "decision", label: "פרטים תקינים?" },
    { id: "T2", type: "task", label: "החזרה לתיקון" },
    { id: "T3", type: "task", label: "אישור הבקשה" },
    { id: "E", type: "end", label: "" },
  ],
  edges: [
    { id: "e1", source: "S", target: "T1" },
    { id: "e2", source: "T1", target: "D1" },
    { id: "e3", source: "D1", target: "T2", label: "לא" },
    { id: "e4", source: "D1", target: "T3", label: "כן" },
    { id: "e5", source: "T2", target: "T1" },
    { id: "e6", source: "T3", target: "E" },
  ],
};

const USECASE_EXAMPLE: DiagramAiOutput = {
  kind: "diagram_usecase",
  nodes: [
    { id: "A1", type: "actor", label: "לקוח" },
    { id: "A2", type: "actor", label: "מנהל מערכת" },
    { id: "EXT", type: "actor", label: "מערכת תשלום", stereotype: "external" },
    { id: "SYS", type: "systemBoundary", label: "מערכת הזמנות" },
    { id: "UC1", type: "useCase", label: "חיפוש מוצרים" },
    { id: "UC2", type: "useCase", label: "ביצוע הזמנה" },
    { id: "UC3", type: "useCase", label: "תשלום" },
    { id: "UC4", type: "useCase", label: "אימות משתמש" },
    { id: "UC5", type: "useCase", label: "ניהול קטלוג" },
  ],
  edges: [
    { id: "a1", source: "A1", target: "UC1", style: "association" },
    { id: "a2", source: "A1", target: "UC2", style: "association" },
    { id: "a3", source: "A2", target: "UC5", style: "association" },
    { id: "a4", source: "UC3", target: "EXT", style: "association" },
    { id: "i1", source: "UC2", target: "UC3", style: "include", label: "«include»" },
    { id: "i2", source: "UC2", target: "UC4", style: "include", label: "«include»" },
  ],
};

const SEQUENCE_EXAMPLE: DiagramAiOutput = {
  kind: "diagram_sequence",
  nodes: [
    { id: "L1", type: "lifeline", label: "לקוח", laneIndex: 0 },
    { id: "L2", type: "lifeline", label: "UI", laneIndex: 1 },
    { id: "L3", type: "lifeline", label: "API", laneIndex: 2 },
    { id: "L4", type: "lifeline", label: "DB", laneIndex: 3 },
  ],
  edges: [
    { id: "m1", source: "L1", target: "L2", label: "הזנת פרטים", style: "sync" },
    { id: "m2", source: "L2", target: "L3", label: "POST /orders", style: "sync" },
    { id: "m3", source: "L3", target: "L4", label: "INSERT order", style: "sync" },
    { id: "m4", source: "L4", target: "L3", label: "order_id", style: "return" },
    { id: "m5", source: "L3", target: "L2", label: "201 Created", style: "return" },
    { id: "m6", source: "L2", target: "L1", label: "אישור", style: "return" },
  ],
};

const STATE_EXAMPLE: DiagramAiOutput = {
  kind: "diagram_state",
  nodes: [
    { id: "I", type: "stateInitial", label: "" },
    { id: "S1", type: "state", label: "טיוטה" },
    { id: "S2", type: "state", label: "ממתין לאישור" },
    { id: "S3", type: "state", label: "אושר" },
    { id: "S4", type: "state", label: "נדחה" },
    { id: "F", type: "stateFinal", label: "" },
  ],
  edges: [
    { id: "t1", source: "I", target: "S1" },
    { id: "t2", source: "S1", target: "S2", label: "שליחה" },
    { id: "t3", source: "S2", target: "S3", label: "אישור" },
    { id: "t4", source: "S2", target: "S4", label: "דחייה" },
    { id: "t5", source: "S3", target: "F" },
    { id: "t6", source: "S4", target: "S1", label: "ערוך מחדש" },
  ],
};

const DEPLOYMENT_EXAMPLE: DiagramAiOutput = {
  kind: "diagram_deployment",
  nodes: [
    { id: "N1", type: "deploymentNode", label: "Browser", stereotype: "device" },
    { id: "N2", type: "deploymentNode", label: "Web Server", stereotype: "server" },
    { id: "N3", type: "deploymentNode", label: "DB Cluster", stereotype: "server" },
    { id: "C1", type: "component", label: "React SPA" },
    { id: "C2", type: "component", label: "API Service" },
    { id: "C3", type: "component", label: "Postgres" },
  ],
  edges: [
    { id: "d1", source: "N1", target: "C1" },
    { id: "d2", source: "N2", target: "C2" },
    { id: "d3", source: "N3", target: "C3" },
    { id: "d4", source: "C1", target: "C2", label: "HTTPS" },
    { id: "d5", source: "C2", target: "C3", label: "SQL" },
  ],
};

const ERD_EXAMPLE: DiagramAiOutput = {
  kind: "diagram_erd",
  nodes: [
    {
      id: "Customer",
      type: "entity",
      label: "Customer",
      attributes: ["id PK", "name string", "email string"],
    },
    {
      id: "Order",
      type: "entity",
      label: "Order",
      attributes: ["id PK", "customer_id FK", "total decimal", "status enum"],
    },
    {
      id: "Product",
      type: "entity",
      label: "Product",
      attributes: ["id PK", "name string", "price decimal"],
    },
    {
      id: "OrderItem",
      type: "entity",
      label: "OrderItem",
      attributes: ["order_id FK", "product_id FK", "qty int"],
    },
  ],
  edges: [
    { id: "r1", source: "Customer", target: "Order", label: "1..*" },
    { id: "r2", source: "Order", target: "OrderItem", label: "1..*" },
    { id: "r3", source: "Product", target: "OrderItem", label: "1..*" },
  ],
};

const KIND_CONFIG: Record<Exclude<DiagramOutputKey, "diagram_activity">, KindConfig> = {
  diagram_flow: {
    label: "תרשים זרימה (Flow Chart)",
    contentRules: [
      "תרשים זרימה דינמי המתאר תהליך עם שלבים והחלטות.",
      "סוגי צמתים מותרים: start (התחלה), end (סיום), task (פעולה/שלב), decision (החלטה).",
      "חובה: בדיוק צומת start אחד וצומת end אחד (לפחות). פעולות = task. החלטה = diamond decision.",
      "כל קצה (edge) שמגיע מ-decision חייב label עברי קצר (לדוגמה: \"כן\" / \"לא\" / \"אחרת\").",
      "label של start ו-end ריק (\"\"). label של task — שם פעולה קצר בעברית.",
    ].join("\n"),
    example: FLOW_EXAMPLE,
    critique: [
      "האם יש בדיוק צומת start אחד וצומת end אחד?",
      "האם כל קצה היוצא מ-decision מתויג בעברית?",
      "האם כל id ייחודי ב-ASCII?",
      "האם כל source/target קיימים ב-nodes?",
    ],
  },
  diagram_usecase: {
    label: "תרשים Use Case (UML)",
    contentRules: [
      "תרשים Use Case הוא סטטי: מי משתמש במערכת ואילו פעולות הוא יכול לבצע. לא תהליך, לא זרימה, לא החלטות.",
      "אם המשתמש מתאר תהליך — הפשט אותו ל-use cases (פעולות מנקודת מבט המשתמש) ולזהה actors.",
      "סוגי צמתים מותרים: actor (שחקן — אדם או מערכת חיצונית), useCase (פעולה), systemBoundary (גבול המערכת — אחד בלבד).",
      "מינימום: 2 actors, 4 use cases, ו-systemBoundary אחד.",
      "actors מחוץ ל-systemBoundary; use cases רעיונית בתוכו.",
      "edges מותרים: style=\"association\" (actor↔useCase), style=\"include\" (useCase→useCase), style=\"extend\" (useCase→useCase). labels ל-include/extend: \"«include»\" או \"«extend»\".",
      "אסור: צמתי start/end/decision/task. אסור lanes. אסור פעלים-בהווה-מתמשך (\"בודק...\"). השתמש בשם פעולה מופשט (\"ביצוע הזמנה\").",
      "אם actor הוא מערכת/שירות חיצוני (לא בן-אדם) — סמן אותו עם stereotype=\"external\". דוגמה: מערכת תשלום, שירות SMS, מערכת CRM חיצונית, API חיצוני.",
    ].join("\n"),
    example: USECASE_EXAMPLE,
    critique: [
      "האם יש לפחות 2 actors ו-4 use cases?",
      "האם יש systemBoundary אחד?",
      "האם אין decisions / tasks / start / end?",
      "האם כל include/extend בין שני use cases (לא בין actor ל-useCase)?",
      "האם כל actor שאינו אנושי (מערכת/שירות חיצוני) סומן עם stereotype=\"external\"?",
    ],
  },
  diagram_sequence: {
    label: "תרשים Sequence (UML)",
    contentRules: [
      "תרשים Sequence: סדר ההודעות בין lifelines (שחקנים/רכיבים) לאורך זמן.",
      "סוגי צמתים: lifeline בלבד. שדה laneIndex (0-based) קובע את הסדר שמאל→ימין.",
      "מינימום: 2 lifelines ו-2 הודעות.",
      "edges הם הודעות. style: \"sync\" (חץ מוצק), \"async\" (חץ דק/אנימציה), \"return\" (חץ מקווקו לתשובה).",
      "label של edge — שם הקריאה / מתודה / תשובה.",
      "סדר ה-edges במערך הוא סדר ההודעות בזמן (מלמעלה למטה).",
    ].join("\n"),
    example: SEQUENCE_EXAMPLE,
    critique: [
      "האם לכל lifeline יש laneIndex ייחודי וסדור?",
      "האם יש לפחות 2 lifelines ו-2 הודעות?",
      "האם לכל edge יש label?",
      "האם תשובות מסומנות style=\"return\"?",
    ],
  },
  diagram_state: {
    label: "תרשים State (UML state machine)",
    contentRules: [
      "תרשים State: מצבים של ישות אחת והמעברים ביניהם.",
      "סוגי צמתים: stateInitial (נקודה מלאה — אחד), state (מצב — מלבן מעוגל), stateFinal (עיגול עם נקודה), choice (יהלום אופציונלי).",
      "מינימום: צומת stateInitial אחד, לפחות 3 מצבים (state).",
      "edges הם מעברים. label מתאר את הטריגר/אירוע (\"שליחה\", \"אישור\", וכו'); אופציונלי אך מומלץ.",
      "labels של stateInitial / stateFinal ריקים (\"\").",
    ].join("\n"),
    example: STATE_EXAMPLE,
    critique: [
      "האם יש stateInitial אחד וצומת אחד או יותר של stateFinal?",
      "האם יש לפחות 3 מצבים מסוג state?",
      "האם רוב המעברים מתויגים בטריגר?",
    ],
  },
  diagram_deployment: {
    label: "תרשים Deployment",
    contentRules: [
      "תרשים Deployment: טופולוגיית פריסה — שרתים, התקנים, ורכיבים שרצים עליהם.",
      "סוגי צמתים: deploymentNode (סביבת ריצה — שרת, מכונה, דפדפן), component (רכיב שרץ על node).",
      "מינימום: 3 צמתים בסה\"כ.",
      "stereotype אופציונלי: \"server\", \"device\", \"container\", \"db\".",
      "edges: בין deploymentNode ל-component (\"מארח את\") או בין components (פרוטוקול תקשורת כ-label, למשל HTTPS, gRPC, SQL).",
    ].join("\n"),
    example: DEPLOYMENT_EXAMPLE,
    critique: [
      "האם יש לפחות 3 צמתים?",
      "האם כל component משויך ל-deploymentNode כלשהו?",
      "האם קישורי תקשורת בין components נושאים פרוטוקול?",
    ],
  },
  diagram_erd: {
    label: "תרשים ERD",
    contentRules: [
      "ERD: ישויות (entities) והקשרים ביניהן במודל הנתונים.",
      "סוג צומת יחיד: entity. שדה attributes הוא מערך מחרוזות בפורמט \"name type\" (לדוגמה: \"id PK\", \"email string\", \"customer_id FK\").",
      "מינימום: 2 entities; לכל entity לפחות attribute אחד.",
      "edges הם relationships. label מתאר את ה-cardinality: \"1..1\", \"1..*\", \"*..*\".",
      "שמות entities ו-attributes באנגלית (זה השם הטכני בסכמה); תיאורים תוכניים יכולים להופיע ב-label של edge בעברית.",
    ].join("\n"),
    example: ERD_EXAMPLE,
    critique: [
      "האם לכל entity יש לפחות attribute אחד עם PK?",
      "האם FK מסומן ב-attributes של הצד ה\"תלוי\"?",
      "האם קשרים מתויגים ב-cardinality?",
    ],
  },
};

// ── Agent ────────────────────────────────────────────────────────────────────

export interface RfJsonAgentInput {
  kind: Exclude<DiagramOutputKey, "diagram_activity">;
  userPrompt: string;
  history: { role: "user" | "assistant"; content: string }[];
  lovableApiKey: string;
  modelOverride?: string;
  tracker?: UsageTracker;
}

export interface RfJsonAgentResult {
  /** Fully positioned RF JSON (string, ready to store in diagrams.mermaid_code). */
  json: string;
  /** Parsed RF data — convenient for callers. */
  rf: DiagramRFData;
}

export async function runRfJsonDiagramAgent(
  input: RfJsonAgentInput,
): Promise<RfJsonAgentResult> {
  const cfg = KIND_CONFIG[input.kind];
  const model = input.modelOverride ?? DEFAULT_AGENT_MODEL;
  const provider = createLovableAiGatewayProvider(input.lovableApiKey);

  const system = buildSystemPrompt(input.kind, cfg);
  const messages = [
    ...input.history,
    { role: "user" as const, content: input.userPrompt },
  ];

  // Attempt 1 — constrained decoding via Output.object(schema).
  let out: DiagramAiOutput;
  let lastErrors: string[] = [];
  try {
    const r = await generateText({
      model: provider(model),
      system,
      messages,
      temperature: AGENT_TEMPERATURES.diagrams,
      maxOutputTokens: 8000,
      experimental_output: Output.object({ schema: DiagramAiOutputSchema }),
    });
    input.tracker?.track(model, r.usage);
    out = r.experimental_output as DiagramAiOutput;
    // Force kind — schema allows any kind, we must guarantee it matches.
    out.kind = input.kind;
    lastErrors = validateDiagramAiOutput(out);
  } catch (err) {
    lastErrors = [err instanceof Error ? err.message : String(err)];
    out = { ...cfg.example, kind: input.kind } as DiagramAiOutput;
  }

  // Attempt 2 — retry with explicit error feedback if validation failed.
  if (lastErrors.length > 0) {
    try {
      const retrySystem =
        system +
        "\n\nהפלט הקודם נכשל בוולידציה. תיקונים נדרשים:\n- " +
        lastErrors.join("\n- ") +
        "\n\nצור מחדש את התרשים תוך תיקון כל הבעיות הללו. עמוד בכל הכללים והמינימומים.";
      const r2 = await generateText({
        model: provider(model),
        system: retrySystem,
        messages,
        temperature: 0,
        maxOutputTokens: 8000,
        experimental_output: Output.object({ schema: DiagramAiOutputSchema }),
      });
      input.tracker?.track(model, r2.usage);
      const out2 = r2.experimental_output as DiagramAiOutput;
      out2.kind = input.kind;
      const errs2 = validateDiagramAiOutput(out2);
      if (errs2.length === 0) {
        out = out2;
        lastErrors = [];
      } else {
        // Keep best effort: use attempt 2 if it has more nodes than attempt 1.
        if (out2.nodes.length >= out.nodes.length) out = out2;
        lastErrors = errs2;
      }
    } catch {
      /* swallow — fall through to whatever we have */
    }
  }

  if (lastErrors.length > 0) {
    // Last-resort: throw so the caller surfaces a clear error to the user.
    throw new Error(
      `התרשים שנוצר לא עבר ולידציה לאחר ניסיון חוזר:\n- ${lastErrors.join("\n- ")}`,
    );
  }

  const rf = buildDiagramRF(out);
  return { json: JSON.stringify(rf), rf };
}

// ── Prompt assembly ──────────────────────────────────────────────────────────

function buildSystemPrompt(kind: DiagramOutputKey, cfg: KindConfig): string {
  const exampleJson = JSON.stringify(cfg.example, null, 2);
  return [
    `אתה מומחה לבניית ${cfg.label} עבור אנליסטים. אתה מייצר אובייקט JSON תקני בלבד, ללא טקסט מסביב.`,
    "",
    "## כללי תוכן",
    cfg.contentRules,
    "",
    "## כללי תחביר חובה",
    "- kind חייב להיות בדיוק: " + kind,
    "- כל id: ASCII קצר, ייחודי (אותיות אנגליות + ספרות). תוויות (label) — בעברית מותר.",
    "- כל edge.source ו-edge.target חייבים להתאים ל-id קיים במערך nodes.",
    "- ללא תווים מיוחדים בתוך label שעלולים לשבור פרסר (גרשיים כפולים מותרים).",
    "",
    "## דוגמה תקינה ומלאה (העתק את המבנה, לא את התוכן)",
    "```json",
    exampleJson,
    "```",
    "",
    buildSelfCritiqueInstruction(cfg.critique),
  ].join("\n");
}
