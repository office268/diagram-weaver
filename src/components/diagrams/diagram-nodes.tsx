// ============================================================
// src/components/diagrams/diagram-nodes.tsx
// רכיב UI — diagram-nodes
// ============================================================
// All custom React Flow node components for the unified diagram editor.
// Each component reads `data.label` (and optional kind-specific data).

import {
  Handle,
  Position,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import type { DiagramNodeData } from "@/lib/diagrams/diagram-rf";

const handleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  background: "#6b7280",
  border: "1px solid #fff",
};

type N = NodeProps<Node<DiagramNodeData>>;

// ── Activity / Flow ─────────────────────────────────────────────────────────

export function TaskNode({ data, selected }: N) {
  return (
    <div
      className="flex items-center justify-center rounded-md border border-foreground/70 bg-card px-2 py-1 text-center text-xs font-medium leading-snug shadow-sm"
      style={{
        width: 160,
        minHeight: 56,
        outline: selected ? "2px solid var(--primary)" : undefined,
        outlineOffset: 2,
      }}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <span className="whitespace-pre-line">{data.label}</span>
    </div>
  );
}

export function DecisionNode({ data, selected }: N) {
  return (
    <div
      style={{
        width: 110,
        height: 110,
        transform: "rotate(45deg)",
        border: "1.6px solid var(--foreground)",
        background: "var(--card)",
        outline: selected ? "2px solid var(--primary)" : undefined,
        outlineOffset: 2,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ ...handleStyle, transform: "rotate(-45deg)" }} />
      <Handle type="source" position={Position.Left} style={{ ...handleStyle, transform: "rotate(-45deg)" }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, transform: "rotate(-45deg)" }} />
      <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, transform: "rotate(-45deg)" }} />
      <div
        style={{
          transform: "rotate(-45deg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          fontSize: 11,
          fontWeight: 500,
          textAlign: "center",
          padding: "0 6px",
          whiteSpace: "pre-line",
          lineHeight: 1.2,
        }}
      >
        {data.label}
      </div>
    </div>
  );
}

export function StartNode() {
  return (
    <div style={{ position: "relative", width: 40, height: 40 }}>
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="14" fill="var(--foreground)" stroke="var(--foreground)" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

export function EndNode() {
  return (
    <div style={{ position: "relative", width: 50, height: 50 }}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <svg width="50" height="50" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="22" fill="var(--card)" stroke="var(--foreground)" strokeWidth="1.6" />
        <circle cx="25" cy="25" r="14" fill="var(--foreground)" />
      </svg>
    </div>
  );
}

export function JoinBarNode({ data }: N) {
  const w = Math.max((data.barWidth as number) ?? 140, 60);
  return (
    <div style={{ position: "relative", width: w, height: 12 }}>
      <Handle type="target" position={Position.Top} id="t1" style={{ ...handleStyle, left: "30%" }} />
      <Handle type="target" position={Position.Top} id="t2" style={{ ...handleStyle, left: "70%" }} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <div style={{ width: "100%", height: 12, background: "var(--foreground)" }} />
    </div>
  );
}

export function LaneNode({ data }: N) {
  return (
    <div
      className="pointer-events-none"
      style={{
        width: "100%",
        height: "100%",
        background:
          ((data.laneIndex as number) ?? 0) % 2 === 0
            ? "color-mix(in oklab, var(--primary) 6%, transparent)"
            : "transparent",
        borderRight: "1px dashed color-mix(in oklab, var(--primary) 50%, transparent)",
      }}
    >
      <div
        className="flex items-center justify-center border-b border-dashed bg-primary/5"
        style={{ height: 44 }}
      >
        <span className="text-sm font-bold text-primary underline">
          {data.label}
        </span>
      </div>
    </div>
  );
}

// ── Actor (stick figure) ────────────────────────────────────────────────────

export function ActorNode({ data }: N) {
  const stereo = (data.stereotype as string | undefined)?.toLowerCase();
  const label = (data.label as string | undefined) ?? "";
  const isExternal =
    stereo === "external" ||
    stereo === "system" ||
    /^(מערכת|שירות|שרת)\s/.test(label) ||
    /\bapi\b/i.test(label);

  if (isExternal) {
    return (
      <div style={{ position: "relative", width: 60, height: 90 }}>
        <Handle type="source" position={Position.Left} style={handleStyle} />
        <Handle type="target" position={Position.Left} style={handleStyle} />
        <Handle type="source" position={Position.Right} style={handleStyle} />
        <Handle type="target" position={Position.Right} style={handleStyle} />
        <svg width="60" height="56" viewBox="0 0 60 56">
          <rect x="6" y="4" width="48" height="34" rx="3" fill="var(--card)" stroke="var(--foreground)" strokeWidth="1.6" />
          <rect x="10" y="8" width="40" height="26" fill="none" stroke="var(--foreground)" strokeWidth="1" opacity="0.5" />
          <line x1="30" y1="38" x2="30" y2="46" stroke="var(--foreground)" strokeWidth="1.6" />
          <line x1="18" y1="48" x2="42" y2="48" stroke="var(--foreground)" strokeWidth="1.6" />
        </svg>
        <div className="text-center text-[9px] leading-tight text-muted-foreground">«external»</div>
        <div className="text-center text-xs font-medium leading-tight text-foreground">{label}</div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: 60, height: 90 }}>
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="target" position={Position.Right} style={handleStyle} />
      <Handle type="source" position={Position.Left} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <svg width="60" height="70" viewBox="0 0 60 70">
        <circle cx="30" cy="12" r="9" fill="none" stroke="var(--foreground)" strokeWidth="1.6" />
        <line x1="30" y1="21" x2="30" y2="45" stroke="var(--foreground)" strokeWidth="1.6" />
        <line x1="12" y1="32" x2="48" y2="32" stroke="var(--foreground)" strokeWidth="1.6" />
        <line x1="30" y1="45" x2="14" y2="65" stroke="var(--foreground)" strokeWidth="1.6" />
        <line x1="30" y1="45" x2="46" y2="65" stroke="var(--foreground)" strokeWidth="1.6" />
      </svg>
      <div className="text-center text-xs font-medium text-foreground">{label}</div>
    </div>
  );
}

// ── Use Case ────────────────────────────────────────────────────────────────

export function UseCaseNode({ data, selected }: N) {
  return (
    <div
      style={{
        width: 150,
        height: 80,
        borderRadius: "50%",
        border: "1.6px solid var(--foreground)",
        background: "var(--card)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 12px",
        fontSize: 12,
        fontWeight: 500,
        outline: selected ? "2px solid var(--primary)" : undefined,
        outlineOffset: 2,
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="source" position={Position.Top} style={handleStyle} />
      <Handle type="target" position={Position.Bottom} style={handleStyle} />
      <span className="whitespace-pre-line">{data.label}</span>
    </div>
  );
}

export function SystemBoundaryNode({ data }: N) {
  return (
    <div
      className="pointer-events-none"
      style={{
        width: "100%",
        height: "100%",
        border: "2px dashed var(--primary)",
        borderRadius: 12,
        background: "color-mix(in oklab, var(--primary) 4%, transparent)",
      }}
    >
      <div className="px-3 py-1 text-xs font-bold text-primary">{data.label}</div>
    </div>
  );
}

// ── Sequence ────────────────────────────────────────────────────────────────

export function LifelineNode({ data, selected }: N) {
  return (
    <div
      style={{
        width: 130,
        outline: selected ? "2px solid var(--primary)" : undefined,
        outlineOffset: 2,
      }}
    >
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div
        className="flex items-center justify-center rounded-md border border-foreground/70 bg-card px-2 py-2 text-center text-xs font-bold"
        style={{ height: 44 }}
      >
        {data.label}
      </div>
      <div
        style={{
          width: 2,
          height: 180,
          margin: "0 auto",
          background: "color-mix(in oklab, var(--foreground) 40%, transparent)",
        }}
      />
    </div>
  );
}

// ── State ───────────────────────────────────────────────────────────────────

export function StateNode({ data, selected }: N) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl border border-foreground/70 bg-card px-3 py-2 text-center text-xs font-medium"
      style={{
        width: 140,
        minHeight: 60,
        outline: selected ? "2px solid var(--primary)" : undefined,
        outlineOffset: 2,
      }}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      {data.label}
    </div>
  );
}

export function StateInitialNode() {
  return (
    <div style={{ width: 30, height: 30 }}>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <svg width="30" height="30" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="12" fill="var(--foreground)" />
      </svg>
    </div>
  );
}

export function StateFinalNode() {
  return (
    <div style={{ width: 36, height: 36 }}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="var(--card)" stroke="var(--foreground)" strokeWidth="1.6" />
        <circle cx="18" cy="18" r="10" fill="var(--foreground)" />
      </svg>
    </div>
  );
}

export function ChoiceNode({ data }: N) {
  return (
    <div
      style={{
        width: 60,
        height: 60,
        transform: "rotate(45deg)",
        border: "1.6px solid var(--foreground)",
        background: "var(--card)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ ...handleStyle, transform: "rotate(-45deg)" }} />
      <Handle type="source" position={Position.Left} style={{ ...handleStyle, transform: "rotate(-45deg)" }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, transform: "rotate(-45deg)" }} />
      <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, transform: "rotate(-45deg)" }} />
      <div style={{ transform: "rotate(-45deg)", textAlign: "center", fontSize: 10, marginTop: 22 }}>
        {data.label}
      </div>
    </div>
  );
}

// ── ERD entity ──────────────────────────────────────────────────────────────

export function EntityNode({ data, selected }: N) {
  const attrs = (data.attributes as string[] | undefined) ?? [];
  return (
    <div
      className="overflow-hidden rounded-md border border-foreground/70 bg-card shadow-sm"
      style={{
        width: 220,
        outline: selected ? "2px solid var(--primary)" : undefined,
        outlineOffset: 2,
      }}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <div className="border-b border-foreground/70 bg-primary/10 px-2 py-1 text-center text-xs font-bold uppercase">
        {data.label}
      </div>
      <ul className="divide-y divide-foreground/10 text-[11px]">
        {attrs.length === 0 ? (
          <li className="px-2 py-1 text-muted-foreground">(אין שדות)</li>
        ) : (
          attrs.map((a, i) => (
            <li key={i} className="px-2 py-1 font-mono" dir="ltr">
              {a}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

// ── Deployment ──────────────────────────────────────────────────────────────

export function DeploymentNodeNode({ data, selected }: N) {
  return (
    <div
      className="relative rounded-md border-2 border-foreground/70 bg-card p-2 shadow-sm"
      style={{
        width: 200,
        minHeight: 140,
        outline: selected ? "2px solid var(--primary)" : undefined,
        outlineOffset: 2,
      }}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <div className="absolute -top-2 right-2 rounded bg-card px-1 text-[10px] font-bold uppercase text-primary">
        «node»
      </div>
      <div className="text-center text-xs font-bold">{data.label}</div>
      {data.stereotype ? (
        <div className="mt-1 text-center text-[10px] text-muted-foreground">{data.stereotype as string}</div>
      ) : null}
    </div>
  );
}

export function ComponentNode({ data, selected }: N) {
  return (
    <div
      className="relative rounded-md border border-foreground/70 bg-card px-3 py-2 shadow-sm"
      style={{
        width: 180,
        minHeight: 60,
        outline: selected ? "2px solid var(--primary)" : undefined,
        outlineOffset: 2,
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <div className="text-[10px] uppercase text-muted-foreground">«component»</div>
      <div className="text-xs font-medium">{data.label}</div>
    </div>
  );
}

// ── Registry ────────────────────────────────────────────────────────────────

export const nodeTypes = {
  task: TaskNode,
  decision: DecisionNode,
  start: StartNode,
  end: EndNode,
  joinBar: JoinBarNode,
  lane: LaneNode,
  actor: ActorNode,
  useCase: UseCaseNode,
  systemBoundary: SystemBoundaryNode,
  lifeline: LifelineNode,
  state: StateNode,
  stateInitial: StateInitialNode,
  stateFinal: StateFinalNode,
  choice: ChoiceNode,
  entity: EntityNode,
  deploymentNode: DeploymentNodeNode,
  component: ComponentNode,
};
