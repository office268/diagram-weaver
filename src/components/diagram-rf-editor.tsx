// ============================================================
// src/components/diagram-rf-editor.tsx
// רכיב UI — diagram-rf-editor
// ============================================================
// Generic React Flow editor for all diagram kinds.
import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  BackgroundVariant,
  Panel,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nodeTypes } from "@/components/diagram-nodes";
import type { DiagramNodeData, DiagramRFData, LegacyActivityRFData } from "@/lib/diagrams/diagram-rf";

type AnyRF = DiagramRFData | LegacyActivityRFData;

interface Props {
  rfData: AnyRF;
  onSave?: (updated: AnyRF) => void;
  saving?: boolean;
  readOnly?: boolean;
}

export function DiagramRFEditor({ rfData, onSave, saving, readOnly }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<DiagramNodeData>>(
    rfData.nodes as Node<DiagramNodeData>[],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(rfData.edges);

  useEffect(() => {
    if (readOnly) {
      setNodes(rfData.nodes as Node<DiagramNodeData>[]);
      setEdges(rfData.edges);
    }
  }, [readOnly, rfData.nodes, rfData.edges, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const handleSave = useCallback(() => {
    if (!onSave) return;
    onSave({ ...rfData, nodes, edges } as AnyRF);
  }, [rfData, nodes, edges, onSave]);

  const fitViewOptions = useMemo(() => ({ padding: 0.12 }), []);

  return (
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
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border))" />
        {!readOnly && onSave && (
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
