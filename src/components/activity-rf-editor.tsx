import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  type NodeProps,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActivityNodeData, ActivityRFData, LaneDef } from "@/lib/activity-rf";

// ── Custom node components ─────────────────────────────────────────────────

function TaskNode({ data, selected }: NodeProps<Node<ActivityNodeData>>) {
  return (
    <div
      className="flex items-center justify-center rounded-none border border-gray-800 bg-white px-2 py-1 text-center text-xs font-medium leading-snug shadow-sm"
      style={{
        minWidth: 140,
        minHeight: 44,
        outline: selected ? "2px solid #3b82f6" : undefined,
        outlineOffset: 2,
      }}
    >
      <Handle type="target" position={Position.Top}    style={handleStyle} />
      <Handle type="target" position={Position.Left}   style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" position={Position.Right}  style={handleStyle} />
      <span className="whitespace-pre-line">{data.label}</span>
    </div>
  );
}

function DecisionNode({ data, selected }: NodeProps<Node<ActivityNodeData>>) {
  return (
    <div
      style={{
        width: 96,
        height: 96,
        transform: "rotate(45deg)",
        border: "1.6px solid #222",
        background: "white",
        outline: selected ? "2px solid #3b82f6" : undefined,
        outlineOffset: 2,
      }}
    >
      <Handle type="target" position={Position.Top}    style={{ ...handleStyle, transform: "rotate(-45deg)" }} />
      <Handle type="source" position={Position.Left}   style={{ ...handleStyle, transform: "rotate(-45deg)" }} />
      <Handle type="source" position={Position.Right}  style={{ ...handleStyle, transform: "rotate(-45deg)" }} />
      <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, transform: "rotate(-45deg)" }} />
      <div
        style={{
          transform: "rotate(-45deg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          fontSize: 12,
          fontWeight: 500,
          textAlign: "center",
          padding: "0 8px",
        }}
      >
        {data.label}
      </div>
    </div>
  );
}

function StartNode(_props: NodeProps<Node<ActivityNodeData>>) {
  return (
    <div style={{ position: "relative", width: 40, height: 70 }}>
      <Handle type="source" position={Position.Right}  style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <svg width="40" height="70" viewBox="0 0 40 70">
        <circle cx="20" cy="13" r="10" fill="none" stroke="#222" strokeWidth="1.6" />
        <line x1="20" y1="23" x2="20" y2="44" stroke="#222" strokeWidth="1.6" />
        <line x1="5"  y1="33" x2="35" y2="33" stroke="#222" strokeWidth="1.6" />
        <line x1="20" y1="44" x2="8"  y2="62" stroke="#222" strokeWidth="1.6" />
        <line x1="20" y1="44" x2="32" y2="62" stroke="#222" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

function EndNode(_props: NodeProps<Node<ActivityNodeData>>) {
  return (
    <div style={{ position: "relative", width: 50, height: 50 }}>
      <Handle type="target" position={Position.Top}  style={handleStyle} />
      <Handle type="target" position={Position.Right} style={handleStyle} />
      <svg width="50" height="50" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="22" fill="white" stroke="#222" strokeWidth="1.6" />
        <text x="25" y="30" textAnchor="middle" fontSize="11" fontFamily="Arial">סיום</text>
      </svg>
    </div>
  );
}

function JoinBarNode({ data }: NodeProps<Node<ActivityNodeData>>) {
  const w = Math.max(data.barWidth as number ?? 100, 60);
  return (
    <div style={{ position: "relative", width: w, height: 11 }}>
      <Handle type="target" position={Position.Top}    style={{ ...handleStyle, left: "25%" }} />
      <Handle type="target" position={Position.Top}    id="t2" style={{ ...handleStyle, left: "75%" }} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <div style={{ width: "100%", height: 11, background: "#111" }} />
    </div>
  );
}

const handleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  background: "#6b7280",
  border: "1px solid #fff",
};

const nodeTypes = {
  task:     TaskNode,
  decision: DecisionNode,
  start:    StartNode,
  end:      EndNode,
  joinBar:  JoinBarNode,
};

// ── Swimlane background ────────────────────────────────────────────────────

function SwimlaneBg({ lanes }: { lanes: LaneDef[] }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* column bands */}
      {lanes.map((lane, i) => (
        <div
          key={i}
          className="absolute top-0 h-full border-r border-dashed border-blue-400/60"
          style={{ left: lane.x, width: lane.width, background: i % 2 === 0 ? "rgba(219,234,254,0.15)" : "transparent" }}
        />
      ))}
      {/* header strip */}
      <div className="absolute top-0 left-0 right-0 flex border-b border-dashed border-blue-400/60 bg-blue-50/60" style={{ height: 44 }}>
        {lanes.map((lane, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-sm font-bold text-blue-800 underline"
            style={{ width: lane.width, marginLeft: i === 0 ? lane.x : 0 }}
          >
            {lane.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main editor ─────────────────────────────────────────────────────────────

interface Props {
  rfData: ActivityRFData;
  onSave: (updated: ActivityRFData) => void;
  saving?: boolean;
  readOnly?: boolean;
}

export function ActivityRFEditor({ rfData, onSave, saving, readOnly }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ActivityNodeData>>(rfData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(rfData.edges);

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge(params, eds)),
    [setEdges],
  );

  const handleSave = useCallback(() => {
    onSave({ ...rfData, nodes, edges });
  }, [rfData, nodes, edges, onSave]);

  const defaultViewport = useMemo(() => ({
    x: 0, y: 0, zoom: 0.8,
  }), []);

  return (
    <div className="relative h-full w-full">
      <SwimlaneBg lanes={rfData.lanes} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultViewport={defaultViewport}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        deleteKeyCode={readOnly ? null : "Delete"}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        className="bg-transparent"
      >
        <Controls />
        {!readOnly && <MiniMap zoomable pannable />}
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
        {!readOnly && (
          <Panel position="top-right">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1 shadow">
              <Save className="h-4 w-4" />
              {saving ? "שומר..." : "שמור"}
            </Button>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
