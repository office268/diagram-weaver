// ============================================================
// src/lib/diagrams/diagram-rf.ts
// ספריית עזר (lib) — diagram-rf.ts
// ============================================================
// Unified React-Flow JSON schema for ALL diagram kinds.
// rfVersion: 2 = the new schema. rfVersion: 1 = legacy activity (still readable).

import type { Node, Edge } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import { z } from "zod";

// ── Kinds ────────────────────────────────────────────────────────────────────

export type DiagramKind =
  | "diagram_flow"
  | "diagram_usecase"
  | "diagram_sequence"
  | "diagram_state"
  | "diagram_deployment"
  | "diagram_erd"
  | "diagram_activity";

export type DiagramNodeType =
  // shared / activity / flow
  | "task"
  | "decision"
  | "start"
  | "end"
  | "joinBar"
  | "lane"
  | "actor"
  // usecase
  | "useCase"
  | "systemBoundary"
  // sequence
  | "lifeline"
  // state
  | "state"
  | "stateInitial"
  | "stateFinal"
  | "choice"
  // erd
  | "entity"
  // deployment
  | "deploymentNode"
  | "component";

export interface DiagramNodeData extends Record<string, unknown> {
  label: string;
  nodeType: DiagramNodeType;
  attributes?: string[];   // entity attributes ("id PK", "name string")
  stereotype?: string;     // <<component>>, <<actor>>, "primary key" etc.
  laneIndex?: number;      // activity / sequence
  barWidth?: number;       // joinBar
  width?: number;
  height?: number;
}

export interface DiagramRFData {
  rfVersion: 2;
  kind: DiagramKind;
  nodes: Node<DiagramNodeData>[];
  edges: Edge[];
}

// Legacy activity (rfVersion: 1) — kept for read-only back-compat.
export interface LegacyActivityRFData {
  rfVersion: 1;
  lanes: Array<{ label: string; x: number; width: number }>;
  nodes: Node<DiagramNodeData>[];
  edges: Edge[];
  svgWidth: number;
  svgHeight: number;
}

// ── Detection ────────────────────────────────────────────────────────────────

export function isDiagramRF(code: string): boolean {
  const t = code.trimStart();
  if (!t.startsWith("{")) return false;
  try {
    const obj = JSON.parse(t) as { rfVersion?: number; nodes?: unknown };
    return (obj.rfVersion === 1 || obj.rfVersion === 2) && Array.isArray(obj.nodes);
  } catch {
    return false;
  }
}

export function parseDiagramRF(code: string): DiagramRFData | LegacyActivityRFData | null {
  try {
    const parsed = JSON.parse(code) as DiagramRFData | LegacyActivityRFData;
    if (parsed.rfVersion !== 1 && parsed.rfVersion !== 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── Zod schemas — used by the AI agent for constrained decoding ─────────────

const NodeTypeSchema = z.enum([
  "task", "decision", "start", "end", "joinBar", "lane", "actor",
  "useCase", "systemBoundary",
  "lifeline",
  "state", "stateInitial", "stateFinal", "choice",
  "entity",
  "deploymentNode", "component",
]);

const NodeSchema = z.object({
  id: z.string().min(1).max(60),
  type: NodeTypeSchema,
  label: z.string().min(0).max(200),
  attributes: z.array(z.string().min(1).max(120)).max(40).optional(),
  stereotype: z.string().min(1).max(40).optional(),
  laneIndex: z.number().int().min(0).max(20).optional(),
});

const EdgeSchema = z.object({
  id: z.string().min(1).max(60),
  source: z.string().min(1).max(60),
  target: z.string().min(1).max(60),
  label: z.string().max(120).optional(),
  /** Optional UML edge style: "sync" | "async" | "return" | "include" | "extend" | "association" | "inheritance" */
  style: z.string().max(20).optional(),
});

/** AI-facing schema: nodes + edges only, no positions (auto-layout adds them). */
export const DiagramAiOutputSchema = z.object({
  kind: z.enum([
    "diagram_flow",
    "diagram_usecase",
    "diagram_sequence",
    "diagram_state",
    "diagram_deployment",
    "diagram_erd",
    "diagram_activity",
  ]),
  nodes: z.array(NodeSchema).min(2).max(120),
  edges: z.array(EdgeSchema).min(0).max(300),
  /** Activity / sequence only — ordered list of lane labels (left→right). */
  lanes: z.array(z.string().min(1).max(60)).max(12).optional(),
});

export type DiagramAiOutput = z.infer<typeof DiagramAiOutputSchema>;

// ── Per-kind validators (minimums + structural rules) ───────────────────────

export function validateDiagramAiOutput(out: DiagramAiOutput): string[] {
  const errs: string[] = [];
  const ids = new Set(out.nodes.map((n) => n.id));
  if (ids.size !== out.nodes.length) errs.push("מזהי צמתים חוזרים על עצמם.");
  for (const e of out.edges) {
    if (!ids.has(e.source)) errs.push(`edge ${e.id}: source ${e.source} לא קיים.`);
    if (!ids.has(e.target)) errs.push(`edge ${e.id}: target ${e.target} לא קיים.`);
  }

  const nonStructural = out.nodes.filter(
    (n) => n.type !== "lane" && n.type !== "systemBoundary",
  );

  switch (out.kind) {
    case "diagram_flow":
      if (nonStructural.length < 3) errs.push("flow chart דורש לפחות 3 צמתים.");
      if (!out.nodes.some((n) => n.type === "start")) errs.push("חסר צומת start.");
      if (!out.nodes.some((n) => n.type === "end")) errs.push("חסר צומת end.");
      break;
    case "diagram_activity":
      if (nonStructural.length < 4) errs.push("activity דורש לפחות 4 פעולות.");
      if (!out.lanes || out.lanes.length < 2) errs.push("activity דורש לפחות 2 lanes.");
      if (!out.nodes.some((n) => n.type === "start")) errs.push("חסר צומת start.");
      break;
    case "diagram_usecase": {
      const actors = out.nodes.filter((n) => n.type === "actor").length;
      const useCases = out.nodes.filter((n) => n.type === "useCase").length;
      if (actors < 2) errs.push("use-case דורש לפחות 2 actors.");
      if (useCases < 4) errs.push("use-case דורש לפחות 4 use cases.");
      if (!out.nodes.some((n) => n.type === "systemBoundary"))
        errs.push("use-case דורש systemBoundary אחד.");
      break;
    }
    case "diagram_sequence":
      if (out.nodes.filter((n) => n.type === "lifeline").length < 2)
        errs.push("sequence דורש לפחות 2 lifelines.");
      if (out.edges.length < 2) errs.push("sequence דורש לפחות 2 הודעות.");
      break;
    case "diagram_state":
      if (nonStructural.length < 3) errs.push("state דורש לפחות 3 מצבים.");
      if (!out.nodes.some((n) => n.type === "stateInitial"))
        errs.push("state דורש מצב התחלתי.");
      break;
    case "diagram_erd": {
      const entities = out.nodes.filter((n) => n.type === "entity");
      if (entities.length < 2) errs.push("ERD דורש לפחות 2 entities.");
      if (entities.some((e) => !e.attributes || e.attributes.length === 0))
        errs.push("כל entity חייב לפחות attribute אחד.");
      break;
    }
    case "diagram_deployment":
      if (
        out.nodes.filter(
          (n) => n.type === "deploymentNode" || n.type === "component",
        ).length < 3
      )
        errs.push("deployment דורש לפחות 3 nodes/components.");
      break;
  }

  return errs;
}

// ── Auto-layout (dagre) ──────────────────────────────────────────────────────

const NODE_SIZE: Record<DiagramNodeType, { w: number; h: number }> = {
  task: { w: 160, h: 56 },
  decision: { w: 110, h: 110 },
  start: { w: 40, h: 40 },
  end: { w: 50, h: 50 },
  joinBar: { w: 140, h: 12 },
  lane: { w: 260, h: 600 },
  actor: { w: 60, h: 90 },
  useCase: { w: 150, h: 80 },
  systemBoundary: { w: 600, h: 400 },
  lifeline: { w: 130, h: 60 },
  state: { w: 140, h: 60 },
  stateInitial: { w: 30, h: 30 },
  stateFinal: { w: 36, h: 36 },
  choice: { w: 60, h: 60 },
  entity: { w: 220, h: 140 },
  deploymentNode: { w: 200, h: 140 },
  component: { w: 180, h: 80 },
};

/** Build a fully-positioned DiagramRFData from the AI's nodes+edges using dagre. */
export function buildDiagramRF(out: DiagramAiOutput): DiagramRFData {
  const g = new dagre.graphlib.Graph();
  const direction: Record<DiagramKind, "TB" | "LR" | "RL"> = {
    diagram_flow: "TB",
    diagram_activity: "TB",
    diagram_usecase: "LR",
    diagram_sequence: "LR",
    diagram_state: "TB",
    diagram_deployment: "TB",
    diagram_erd: "LR",
  };
  g.setGraph({
    rankdir: direction[out.kind],
    nodesep: 60,
    ranksep: 90,
    marginx: 30,
    marginy: 30,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Lane nodes / systemBoundary aren't part of dagre flow; lay them separately.
  const structural = new Set<string>();
  for (const n of out.nodes) {
    if (n.type === "lane" || n.type === "systemBoundary") {
      structural.add(n.id);
      continue;
    }
    const dims = NODE_SIZE[n.type] ?? { w: 140, h: 60 };
    g.setNode(n.id, { width: dims.w, height: dims.h });
  }
  for (const e of out.edges) {
    if (structural.has(e.source) || structural.has(e.target)) continue;
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  const positioned: Node<DiagramNodeData>[] = out.nodes
    .filter((n) => !structural.has(n.id))
    .map((n) => {
      const dims = NODE_SIZE[n.type] ?? { w: 140, h: 60 };
      const pos = g.node(n.id);
      return {
        id: n.id,
        type: n.type,
        position: pos
          ? { x: pos.x - dims.w / 2, y: pos.y - dims.h / 2 }
          : { x: 0, y: 0 },
        data: {
          label: n.label,
          nodeType: n.type,
          attributes: n.attributes,
          stereotype: n.stereotype,
          laneIndex: n.laneIndex,
        },
      };
    });

  // Lane backdrops for activity (and any other lane-using kind).
  const laneNodes: Node<DiagramNodeData>[] = [];
  if (out.lanes && out.lanes.length > 0) {
    const bounds = positioned.reduce(
      (b, n) => ({
        minX: Math.min(b.minX, n.position.x),
        maxX: Math.max(b.maxX, n.position.x + (NODE_SIZE[n.data.nodeType]?.w ?? 140)),
        minY: Math.min(b.minY, n.position.y),
        maxY: Math.max(b.maxY, n.position.y + (NODE_SIZE[n.data.nodeType]?.h ?? 60)),
      }),
      { minX: 0, maxX: 800, minY: 0, maxY: 600 },
    );
    const laneW = Math.max(220, (bounds.maxX - bounds.minX + 80) / out.lanes.length);
    const laneH = Math.max(400, bounds.maxY - bounds.minY + 100);
    out.lanes.forEach((label, i) => {
      laneNodes.push({
        id: `lane-${i}`,
        type: "lane",
        position: { x: bounds.minX - 40 + i * laneW, y: bounds.minY - 60 },
        style: { width: laneW, height: laneH, zIndex: -1 },
        data: {
          label,
          nodeType: "lane",
          laneIndex: i,
          width: laneW,
          height: laneH,
        },
        selectable: false,
        draggable: false,
        focusable: false,
        zIndex: -1,
      });
    });
  }

  // Use-case: force actors OUTSIDE the system boundary (dagre is unaware of it).
  if (out.kind === "diagram_usecase") {
    const useCases = positioned.filter((n) => n.data.nodeType === "useCase");
    const actors = positioned.filter((n) => n.data.nodeType === "actor");
    if (useCases.length > 0 && actors.length > 0) {
      const ucW = NODE_SIZE.useCase.w;
      const ucH = NODE_SIZE.useCase.h;
      const aW = NODE_SIZE.actor.w;
      const aH = NODE_SIZE.actor.h;
      const ucBounds = useCases.reduce(
        (acc, n) => ({
          minX: Math.min(acc.minX, n.position.x),
          maxX: Math.max(acc.maxX, n.position.x + ucW),
          minY: Math.min(acc.minY, n.position.y),
          maxY: Math.max(acc.maxY, n.position.y + ucH),
        }),
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
      );

      const ucIds = new Set(useCases.map((u) => u.id));
      const gap = 80; // > sysBoundary padding (40) so actors stay outside frame
      const left: Node<DiagramNodeData>[] = [];
      const right: Node<DiagramNodeData>[] = [];
      for (const a of actors) {
        const isSource = out.edges.some(
          (e) => e.source === a.id && ucIds.has(e.target),
        );
        const isTargetOnly =
          !isSource &&
          out.edges.some((e) => e.target === a.id && ucIds.has(e.source));
        if (isTargetOnly) right.push(a);
        else left.push(a);
      }

      const placeColumn = (
        col: Node<DiagramNodeData>[],
        x: number,
      ) => {
        // preserve dagre's vertical ordering
        col.sort((p, q) => p.position.y - q.position.y);
        const H = Math.max(ucBounds.maxY - ucBounds.minY, aH * col.length);
        const n = col.length;
        col.forEach((a, i) => {
          const cy = ucBounds.minY + ((i + 1) * H) / (n + 1);
          a.position = { x, y: cy - aH / 2 };
        });
      };
      placeColumn(left, ucBounds.minX - gap - aW);
      placeColumn(right, ucBounds.maxX + gap);
    }
  }

  // systemBoundary backdrop for use-case
  const sysBoundary = out.nodes.find((n) => n.type === "systemBoundary");
  if (sysBoundary && positioned.length > 0) {
    const useCases = positioned.filter((n) => n.data.nodeType === "useCase");
    if (useCases.length > 0) {
      const b = useCases.reduce(
        (acc, n) => ({
          minX: Math.min(acc.minX, n.position.x),
          maxX: Math.max(acc.maxX, n.position.x + 150),
          minY: Math.min(acc.minY, n.position.y),
          maxY: Math.max(acc.maxY, n.position.y + 80),
        }),
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
      );
      laneNodes.push({
        id: sysBoundary.id,
        type: "systemBoundary",
        position: { x: b.minX - 40, y: b.minY - 60 },
        style: {
          width: b.maxX - b.minX + 80,
          height: b.maxY - b.minY + 100,
          zIndex: -1,
        },
        data: {
          label: sysBoundary.label,
          nodeType: "systemBoundary",
          width: b.maxX - b.minX + 80,
          height: b.maxY - b.minY + 100,
        },
        selectable: false,
        draggable: false,
        focusable: false,
        zIndex: -1,
      });
    }
  }

  const edges: Edge[] = out.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: "default",
    data: { style: e.style },
    animated: e.style === "async",
    style:
      e.style === "include" || e.style === "extend" || e.style === "return"
        ? { strokeDasharray: "6 4" }
        : undefined,
  }));

  return {
    rfVersion: 2,
    kind: out.kind,
    nodes: [...laneNodes, ...positioned],
    edges,
  };
}

// ── JSON-schema (for constrained decoding via AI SDK Output.object) ─────────

/** Compact JSON-schema-like description for prompt injection. */
export const DIAGRAM_AI_SCHEMA_DOC = `{
  "kind": "<diagram_flow|diagram_usecase|diagram_sequence|diagram_state|diagram_deployment|diagram_erd|diagram_activity>",
  "nodes": [{
    "id": "<unique ASCII id>",
    "type": "<node type>",
    "label": "<Hebrew text>",
    "attributes": ["<for entity only>"],
    "stereotype": "<optional>",
    "laneIndex": "<activity only: 0-based lane index>"
  }],
  "edges": [{
    "id": "<unique ASCII id>",
    "source": "<node id>",
    "target": "<node id>",
    "label": "<optional>",
    "style": "<sync|async|return|include|extend|association|inheritance, optional>"
  }],
  "lanes": ["<activity only: lane labels left→right>"]
}`;
