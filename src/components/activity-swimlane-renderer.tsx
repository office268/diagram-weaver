import { useMemo, useRef, useCallback } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Download, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MermaidPreview } from "@/components/mermaid-preview";

// ── Constants ─────────────────────────────────────────────────────────────────

const COL_W = 240;
const ROW_H = 110;
const NODE_W = 190;
const NODE_H = 52;
const DIA_H = 60;
const HEADER_H = 58;
const ROW_OFFSET = 24; // gap below header to first row center

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeKind = "start" | "task" | "decision" | "end";

interface DNode {
  id: string;
  label: string;
  kind: NodeKind;
  col: number;
}

interface DEdge {
  from: string;
  to: string;
  label?: string;
}

interface Parsed {
  actors: string[];
  nodes: DNode[];
  edges: DEdge[];
}

// ── Parser ────────────────────────────────────────────────────────────────────

export function parseSwimlane(code: string): Parsed | null {
  const lines = code
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !l.startsWith("%%") &&
        !l.startsWith("flowchart") &&
        !l.startsWith("direction") &&
        !l.startsWith("style") &&
        !l.startsWith("linkStyle"),
    );

  const actors: string[] = [];
  const nodes: DNode[] = [];
  const seenIds = new Set<string>();
  const edges: DEdge[] = [];
  let col = -1;

  for (const line of lines) {
    // subgraph ID["label"] or subgraph ID ["label"] or subgraph ID [label]
    if (/^subgraph\b/.test(line)) {
      const idM = line.match(/^subgraph\s+(\w+)/);
      if (!idM) continue;
      const labelQ = line.match(/\["([^"]+)"\]/)?.[1];
      const labelU = line.match(/\[([^\]"]+)\]/)?.[1];
      col = actors.length;
      actors.push((labelQ ?? labelU ?? idM[1]).trim());
      continue;
    }

    if (line === "end") {
      col = -1;
      continue;
    }

    if (col >= 0) {
      const add = (id: string, label: string, kind: NodeKind) => {
        if (!seenIds.has(id)) {
          seenIds.add(id);
          nodes.push({ id, label, kind, col });
        }
      };

      // start: ID(["label"])
      let m = line.match(/^(\w+)\(\["(.*)"\]\)$/);
      if (m) { add(m[1], m[2], "start"); continue; }

      // end: ID(("label"))
      m = line.match(/^(\w+)\(\("(.+)"\)\)$/);
      if (m) { add(m[1], m[2], "end"); continue; }

      // decision: ID{{"label"}} or ID{{label}}
      m = line.match(/^(\w+)\{\{"?(.+?)"?\}\}$/);
      if (m) { add(m[1], m[2], "decision"); continue; }

      // task: ID["label"]
      m = line.match(/^(\w+)\["(.+)"\]$/);
      if (m) { add(m[1], m[2], "task"); continue; }
    } else {
      // edges: A --> B  |  A --> |label| B  |  A --> B --> C (chained)
      const segs = line.split(/\s*-->\s*/);
      if (segs.length < 2) continue;
      for (let i = 0; i < segs.length - 1; i++) {
        const from = segs[i].trim().match(/^(\w+)/)?.[1];
        let rest = segs[i + 1].trim();
        let edgeLabel: string | undefined;
        const lm = rest.match(/^\|([^|]*)\|\s*(\w+)/);
        if (lm) { edgeLabel = lm[1].trim() || undefined; rest = lm[2]; }
        const to = rest.match(/^(\w+)/)?.[1];
        if (from && to) edges.push({ from, to, label: edgeLabel });
      }
    }
  }

  if (actors.length === 0 || nodes.length === 0) return null;
  return { actors, nodes, edges };
}

// ── Layout ────────────────────────────────────────────────────────────────────

interface LNode extends DNode {
  row: number;
  cx: number;
  cy: number;
}

function computeLayout(parsed: Parsed): LNode[] {
  const { nodes, edges } = parsed;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const inDeg = new Map(nodes.map(({ id }) => [id, 0]));
  const adj = new Map(nodes.map(({ id }) => [id, [] as string[]]));
  for (const { from, to } of edges) {
    if (byId.has(from) && byId.has(to)) {
      inDeg.set(to, (inDeg.get(to) ?? 0) + 1);
      adj.get(from)!.push(to);
    }
  }

  // BFS topological level: each node gets max(predecessor levels) + 1
  const row = new Map<string, number>();
  const queue: string[] = [];
  inDeg.forEach((d, id) => {
    if (d === 0) { queue.push(id); row.set(id, 0); }
  });
  while (queue.length) {
    const cur = queue.shift()!;
    const curRow = row.get(cur) ?? 0;
    for (const next of adj.get(cur) ?? []) {
      row.set(next, Math.max(row.get(next) ?? 0, curRow + 1));
      const nd = (inDeg.get(next) ?? 1) - 1;
      inDeg.set(next, nd);
      if (nd <= 0) queue.push(next);
    }
  }
  // Nodes unreachable by BFS (back-edges / cycles): place after current max
  const maxRow = row.size ? Math.max(...row.values()) : 0;
  nodes.forEach(({ id }) => { if (!row.has(id)) row.set(id, maxRow + 1); });

  // Stack nodes that share (row, col)
  const slotCount = new Map<string, number>();
  return nodes.map((n) => {
    const r = row.get(n.id) ?? 0;
    const key = `${r}-${n.col}`;
    const slot = slotCount.get(key) ?? 0;
    slotCount.set(key, slot + 1);
    const cx = n.col * COL_W + COL_W / 2;
    const cy = HEADER_H + ROW_OFFSET + r * ROW_H + slot * (NODE_H + 16) + NODE_H / 2;
    return { ...n, row: r, cx, cy };
  });
}

function canvasSize(lnodes: LNode[], actorCount: number) {
  const maxBot = lnodes.length
    ? Math.max(...lnodes.map((n) => n.cy + (n.kind === "decision" ? DIA_H / 2 : NODE_H / 2)))
    : HEADER_H + ROW_OFFSET + ROW_H;
  return {
    width: actorCount * COL_W + 28, // right margin for back-edge arcs
    height: maxBot + 28,
  };
}

// ── Edge geometry ─────────────────────────────────────────────────────────────

const nodeTop = (n: LNode) => n.cy - (n.kind === "decision" ? DIA_H / 2 : NODE_H / 2);
const nodeBot = (n: LNode) => n.cy + (n.kind === "decision" ? DIA_H / 2 : NODE_H / 2);

function edgePath(from: LNode, to: LNode, W: number): string {
  const x1 = from.cx, y1 = nodeBot(from);
  const x2 = to.cx, y2 = nodeTop(to);

  if (y2 < y1) {
    // Back-edge: route along the right margin
    const mx = W - 14;
    return `M${x1} ${y1} H${mx} V${y2} H${x2}`;
  }
  if (Math.abs(x1 - x2) < 2) {
    return `M${x1} ${y1} V${y2}`;
  }
  const mid = (y1 + y2) / 2;
  return `M${x1} ${y1} V${mid} H${x2} V${y2}`;
}

function edgeLabelPos(from: LNode, to: LNode, W: number): { x: number; y: number } {
  const x1 = from.cx, y1 = nodeBot(from);
  const x2 = to.cx, y2 = nodeTop(to);
  if (y2 < y1) return { x: W - 10, y: (y1 + y2) / 2 };
  return { x: (x1 + x2) / 2 + 2, y: (y1 + y2) / 2 - 5 };
}

// ── Node shapes ───────────────────────────────────────────────────────────────

function NodeShape({ n }: { n: LNode }) {
  const { cx, cy, kind, label } = n;

  if (kind === "start") {
    return (
      <g>
        <circle cx={cx} cy={cy} r={22} fill="#1a3a6e" />
        <text x={cx} y={cy + 7} textAnchor="middle" fontSize={19} fill="#fff">
          {label.includes("👤") ? "👤" : "▶"}
        </text>
      </g>
    );
  }

  if (kind === "end") {
    return (
      <g>
        <circle cx={cx} cy={cy} r={22} fill="none" stroke="#1a3a6e" strokeWidth={3} />
        <circle cx={cx} cy={cy} r={13} fill="#1a3a6e" />
      </g>
    );
  }

  if (kind === "decision") {
    const hw = NODE_W / 2 - 6;
    const hh = DIA_H / 2;
    const pts = `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
    const short = label.length > 22 ? label.slice(0, 21) + "…" : label;
    return (
      <g>
        <polygon points={pts} fill="#fff9e6" stroke="#c0870a" strokeWidth={1.5} />
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize={12}
          fontWeight={500}
          fill="#5a3d00"
          style={{ direction: "rtl" } as React.CSSProperties}
        >
          {short}
        </text>
      </g>
    );
  }

  // task — up to 2 lines of text
  const nx = cx - NODE_W / 2;
  const ny = cy - NODE_H / 2;
  const line1 = label.length > 22 ? label.slice(0, 22) : label;
  const line2 = label.length > 22 ? (label.length > 44 ? label.slice(22, 43) + "…" : label.slice(22)) : null;
  return (
    <g>
      <rect x={nx} y={ny} width={NODE_W} height={NODE_H} rx={9} fill="#fff" stroke="#3838cc" strokeWidth={1.5} />
      {line2 ? (
        <>
          <text
            x={cx} y={cy - 7}
            textAnchor="middle"
            fontSize={12}
            fill="#151540"
            style={{ direction: "rtl" } as React.CSSProperties}
          >
            {line1}
          </text>
          <text
            x={cx} y={cy + 9}
            textAnchor="middle"
            fontSize={12}
            fill="#151540"
            style={{ direction: "rtl" } as React.CSSProperties}
          >
            {line2}
          </text>
        </>
      ) : (
        <text
          x={cx} y={cy + 5}
          textAnchor="middle"
          fontSize={13}
          fill="#151540"
          style={{ direction: "rtl" } as React.CSSProperties}
        >
          {line1}
        </text>
      )}
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ActivitySwimlaneRenderer({
  mermaidCode,
  title,
}: {
  mermaidCode: string;
  title?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const parsed = useMemo(() => parseSwimlane(mermaidCode), [mermaidCode]);
  const lnodes = useMemo(() => (parsed ? computeLayout(parsed) : []), [parsed]);
  const byId = useMemo(() => new Map(lnodes.map((n) => [n.id, n])), [lnodes]);

  const exportSvg = useCallback(() => {
    if (!svgRef.current) return;
    const str = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `${title ?? "swimlane"}-${Date.now()}.svg`,
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [title]);

  // Fall back to Mermaid renderer if parsing fails
  if (!parsed) return <MermaidPreview code={mermaidCode} />;

  const { width: W, height: H } = canvasSize(lnodes, parsed.actors.length);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="relative flex-1 overflow-hidden">
        <TransformWrapper
          minScale={0.2}
          maxScale={6}
          initialScale={1}
          centerOnInit
          wheel={{ step: 0.15 }}
          pinch={{ step: 5 }}
          doubleClick={{ mode: "toggle", step: 1.5 }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-md border border-border bg-background/90 p-1 shadow-sm backdrop-blur">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => zoomIn()} aria-label="הגדל">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => zoomOut()} aria-label="הקטן">
                  <Minus className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => resetTransform()} aria-label="איפוס">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={exportSvg} aria-label="הורד SVG" title="הורד SVG">
                  <Download className="h-4 w-4" />
                </Button>
              </div>

              <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full">
                <div className="flex h-full w-full items-center justify-center p-6">
                  <svg
                    ref={svgRef}
                    width={W}
                    height={H}
                    viewBox={`0 0 ${W} ${H}`}
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}
                  >
                    <defs>
                      <marker id="sw-arr" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0,10 3.5,0 7" fill="#4a4a7a" />
                      </marker>
                    </defs>

                    {/* Column backgrounds */}
                    {parsed.actors.map((_, i) => (
                      <rect
                        key={i}
                        x={i * COL_W}
                        y={0}
                        width={COL_W}
                        height={H}
                        fill={i % 2 === 0 ? "#f4f6ff" : "#ffffff"}
                      />
                    ))}

                    {/* Column separator lines */}
                    {parsed.actors.map((_, i) => (
                      <line key={i} x1={i * COL_W} y1={0} x2={i * COL_W} y2={H} stroke="#bbc4ea" strokeWidth={1} />
                    ))}

                    {/* Header band */}
                    <rect x={0} y={0} width={parsed.actors.length * COL_W} height={HEADER_H} fill="#d8e1f5" />

                    {/* Header / body separator */}
                    <line x1={0} y1={HEADER_H} x2={parsed.actors.length * COL_W} y2={HEADER_H} stroke="#8899cc" strokeWidth={1.5} />

                    {/* Actor name labels */}
                    {parsed.actors.map((label, i) => (
                      <text
                        key={i}
                        x={i * COL_W + COL_W / 2}
                        y={HEADER_H / 2 + 7}
                        textAnchor="middle"
                        fontSize={15}
                        fontWeight="700"
                        fill="#162850"
                        style={{ direction: "rtl" } as React.CSSProperties}
                      >
                        {label}
                      </text>
                    ))}

                    {/* Outer border */}
                    <rect
                      x={0} y={0}
                      width={parsed.actors.length * COL_W}
                      height={H}
                      fill="none"
                      stroke="#8899cc"
                      strokeWidth={1.5}
                      rx={2}
                    />

                    {/* Edges — rendered below nodes */}
                    {parsed.edges.map((e, i) => {
                      const f = byId.get(e.from);
                      const t = byId.get(e.to);
                      if (!f || !t) return null;
                      const d = edgePath(f, t, W);
                      const lp = e.label ? edgeLabelPos(f, t, W) : null;
                      return (
                        <g key={i}>
                          <path d={d} fill="none" stroke="#4a4a7a" strokeWidth={1.8} markerEnd="url(#sw-arr)" />
                          {lp && (
                            <text
                              x={lp.x} y={lp.y}
                              textAnchor="middle"
                              fontSize={11}
                              fill="#5a5a90"
                              style={{ direction: "rtl" } as React.CSSProperties}
                            >
                              {e.label}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Nodes — rendered above edges */}
                    {lnodes.map((n) => (
                      <NodeShape key={n.id} n={n} />
                    ))}
                  </svg>
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
    </div>
  );
}
