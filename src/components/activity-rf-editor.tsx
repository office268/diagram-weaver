import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
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
  Background,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActivityNodeData, ActivityRFData } from "@/lib/activity-rf";

// ── Custom node components ─────────────────────────────────────────────────

const handleStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  background: "#6b7280",
  border: "1px solid #fff",
};

function LaneNode({ data }: NodeProps<Node<ActivityNodeData>>) {
  return (
    <div
      className="pointer-events-none"
      style={{
        width: "100%",
        height: "100%",
        background:
          (data.laneIndex as number) % 2 === 0
            ? "rgba(219,234,254,0.12)"
            : "transparent",
        borderRight: "1px dashed rgba(96,165,250,0.5)",
      }}
    >
      <div
        className="flex items-center justify-center border-b border-dashed border-blue-400/50 bg-blue-50/60"
        style={{ height: 44 }}
      >
        <span className="text-sm font-bold text-blue-800 underline">
          {data.label as string}
        </span>
      </div>
    </div>
  );
}

function TaskNode({ data, selected }: NodeProps<Node<ActivityNodeData>>) {
  return (
    <div
      className="flex items-center justify-center border border-gray-800 bg-white px-2 py-1 text-center text-xs font-medium leading-snug shadow-sm"
      style={{
        width: 150,
        minHeight: 46,
        outline: selected ? "2px solid #3b82f6" : undefined,
        outlineOffset: 2,
      }}
    >
      <Handle type="target" position={Position.Top}    style={handleStyle} />
      <Handle type="target" position={Position.Left}   style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" position={Position.Right}  style={handleStyle} />
      <span className="whitespace-pre-line">{data.label as string}</span>
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
          fontSize: 11,
          fontWeight: 500,
          textAlign: "center",
          padding: "0 6px",
          whiteSpace: "pre-line",
          lineHeight: 1.2,
        }}
      >
        {data.label as string}
      </div>
    </div>
  );
}

function StartNode(_props: NodeProps<Node<ActivityNodeData>>) {
  return (
    <div style={{ position: "relative", width: 40, height: 40 }}>
      <Handle type="source" position={Position.Right}  style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="14" fill="white" stroke="#222" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

function ActorNode({ data }: NodeProps<Node<ActivityNodeData>>) {
  return (
    <div style={{ position: "relative", width: 40, height: 70 }}>
      <Handle type="source" position={Position.Right}  style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <svg width="40" height="70" viewBox="0 0 40 70">
        <circle cx="20" cy="10" r="8"  fill="none" stroke="#222" strokeWidth="1.6" />
        <line x1="20" y1="18" x2="20" y2="40" stroke="#222" strokeWidth="1.6" />
        <line x1="6"  y1="28" x2="34" y2="28" stroke="#222" strokeWidth="1.6" />
        <line x1="20" y1="40" x2="8"  y2="60" stroke="#222" strokeWidth="1.6" />
        <line x1="20" y1="40" x2="32" y2="60" stroke="#222" strokeWidth="1.6" />
      </svg>
      {data.label ? (
        <div style={{ position: "absolute", top: 70, left: -10, width: 60, textAlign: "center", fontSize: 10 }}>
          {data.label as string}
        </div>
      ) : null}
    </div>
  );
}

function EndNode(_props: NodeProps<Node<ActivityNodeData>>) {
  return (
    <div style={{ position: "relative", width: 50, height: 50 }}>
      <Handle type="target" position={Position.Top}   style={handleStyle} />
      <Handle type="target" position={Position.Right} style={handleStyle} />
      <svg width="50" height="50" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="22" fill="white" stroke="#222" strokeWidth="1.6" />
        <text x="25" y="30" textAnchor="middle" fontSize="11" fontFamily="Arial">סיום</text>
      </svg>
    </div>
  );
}

function JoinBarNode({ data }: NodeProps<Node<ActivityNodeData>>) {
  const w = Math.max((data.barWidth as number) ?? 100, 60);
  return (
    <div style={{ position: "relative", width: w, height: 11 }}>
      <Handle type="target" position={Position.Top}    id="t1" style={{ ...handleStyle, left: "30%" }} />
      <Handle type="target" position={Position.Top}    id="t2" style={{ ...handleStyle, left: "70%" }} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <div style={{ width: "100%", height: 11, background: "#111" }} />
    </div>
  );
}

const nodeTypes = {
  lane:     LaneNode,
  task:     TaskNode,
  decision: DecisionNode,
  start:    StartNode,
  end:      EndNode,
  joinBar:  JoinBarNode,
  actor:    ActorNode,
};

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

  useEffect(() => {
    if (readOnly) {
      setNodes(rfData.nodes);
      setEdges(rfData.edges);
    }
  }, [readOnly, rfData.nodes, rfData.edges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge(params, eds)),
    [setEdges],
  );

  const handleSave = useCallback(() => {
    onSave({ ...rfData, nodes, edges });
  }, [rfData, nodes, edges, onSave]);

  const fitViewOptions = useMemo(() => ({ padding: 0.12 }), []);

  return (
    // dir="ltr" prevents the RTL document context from mirroring the canvas
    <div className="relative h-full w-full" dir="ltr">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={fitViewOptions}
        deleteKeyCode={readOnly ? null : "Delete"}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        minZoom={0.2}
        maxZoom={4}
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
