import type { Node, Edge } from "@xyflow/react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LaneDef {
  label: string;
  x: number;      // left edge in SVG coords
  width: number;
}

export type ActivityNodeType = "task" | "decision" | "start" | "end" | "joinBar";

export interface ActivityNodeData extends Record<string, unknown> {
  label: string;
  laneIndex: number;
  nodeType: ActivityNodeType;
  barWidth?: number; // joinBar only
}

export interface ActivityRFData {
  rfVersion: 1;
  lanes: LaneDef[];
  nodes: Node<ActivityNodeData>[];
  edges: Edge[];
  svgWidth: number;
  svgHeight: number;
}

export function isActivityRF(code: string): boolean {
  const trimmed = code.trimStart();
  if (!trimmed.startsWith("{")) return false;
  try {
    const obj = JSON.parse(trimmed) as Partial<ActivityRFData>;
    return obj.rfVersion === 1 && Array.isArray(obj.nodes);
  } catch {
    return false;
  }
}

// ── SVG → RF parser ───────────────────────────────────────────────────────────

function parseFloat2(s: string | null | undefined, fallback = 0) {
  const n = parseFloat(s ?? "");
  return isNaN(n) ? fallback : n;
}

function getLaneIndex(cx: number, laneX: number[]): number {
  for (let i = laneX.length - 1; i >= 0; i--) {
    if (cx >= laneX[i]) return i;
  }
  return 0;
}

/** Axis-aligned bounding box of a node (in SVG coordinate space). */
function nodeBounds(n: Node<ActivityNodeData>): {
  x: number; y: number; w: number; h: number;
} {
  const { x, y } = n.position;
  switch (n.data.nodeType) {
    case "task":    return { x: x - 75, y: y - 25, w: 150, h: 50 };
    case "decision":return { x: x - 55, y: y - 50, w: 110, h: 100 };
    case "start":   return { x: x - 30, y: y - 40, w: 60,  h: 80  };
    case "end":     return { x: x - 25, y: y - 25, w: 50,  h: 50  };
    case "joinBar": return { x: x - (n.data.barWidth ?? 100) / 2, y: y - 6, w: n.data.barWidth ?? 100, h: 12 };
    default:        return { x: x - 40, y: y - 20, w: 80,  h: 40  };
  }
}

function distToNode(n: Node<ActivityNodeData>, px: number, py: number): number {
  const b = nodeBounds(n);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const dx = Math.max(0, Math.abs(px - cx) - b.w / 2);
  const dy = Math.max(0, Math.abs(py - cy) - b.h / 2);
  return Math.sqrt(dx * dx + dy * dy);
}

function closestNode(
  nodes: Node<ActivityNodeData>[],
  px: number,
  py: number,
  threshold = 40,
): string | null {
  let best: string | null = null;
  let bestD = threshold;
  for (const n of nodes) {
    const d = distToNode(n, px, py);
    if (d < bestD) { bestD = d; best = n.id; }
  }
  return best;
}

export function parseSvgToRF(svgString: string): ActivityRFData | null {
  if (typeof window === "undefined") return null;

  const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName === "parsererror") return null;

  const vb = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
  const svgWidth  = vb?.[2] ?? 1200;
  const svgHeight = vb?.[3] ?? 800;

  // ── 1. Lane boundaries from vertical dashed lines ──────────────────────────
  const laneXSet = new Set<number>([90]); // MARGIN_LEFT always present
  const headerH = 44;
  const allLines = Array.from(svg.querySelectorAll("line"));

  for (const line of allLines) {
    const stroke = line.getAttribute("stroke") ?? "";
    const dash   = line.getAttribute("stroke-dasharray");
    const x1 = parseFloat2(line.getAttribute("x1"));
    const x2 = parseFloat2(line.getAttribute("x2"));
    const y1 = parseFloat2(line.getAttribute("y1"));
    if (dash && stroke.includes("5566cc") && Math.abs(x1 - x2) < 2 && y1 <= 1) {
      laneXSet.add(Math.round(x1));
    }
  }

  const laneXArr = Array.from(laneXSet).sort((a, b) => a - b);

  // ── 2. Header labels ────────────────────────────────────────────────────────
  const allTexts = Array.from(svg.querySelectorAll("text"));
  const headerTexts = allTexts.filter(t => {
    const y  = parseFloat2(t.getAttribute("y"));
    const fw = t.getAttribute("font-weight");
    return y < headerH && fw === "bold";
  });

  const lanes: LaneDef[] = laneXArr.map((x, i) => {
    const nextX = laneXArr[i + 1] ?? (svgWidth - 10);
    const width  = nextX - x;
    const cx     = x + width / 2;
    const label  = headerTexts.find(t => {
      const tx = parseFloat2(t.getAttribute("x"));
      return Math.abs(tx - cx) < width / 2 + 5;
    })?.textContent?.trim() ?? `Lane ${i + 1}`;
    return { label, x, width };
  });

  // ── 3. Build node list ──────────────────────────────────────────────────────
  const rfNodes: Node<ActivityNodeData>[] = [];
  let idx = 0;

  // 3a. JOIN BARs — <rect fill="#111">
  for (const rect of svg.querySelectorAll("rect")) {
    if (rect.getAttribute("fill") !== "#111") continue;
    const rx = parseFloat2(rect.getAttribute("x"));
    const ry = parseFloat2(rect.getAttribute("y"));
    const rw = parseFloat2(rect.getAttribute("width"), 100);
    const rh = parseFloat2(rect.getAttribute("height"), 11);
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    rfNodes.push({
      id: `join-${idx++}`,
      type: "joinBar",
      position: { x: cx, y: cy },
      data: { label: "", laneIndex: getLaneIndex(cx, laneXArr), nodeType: "joinBar", barWidth: rw },
    });
  }

  // 3b. TASK nodes — <rect> not black, not in header area
  for (const rect of svg.querySelectorAll("rect")) {
    const fill = rect.getAttribute("fill") ?? "white";
    if (fill === "#111") continue;
    const rx = parseFloat2(rect.getAttribute("x"));
    const ry = parseFloat2(rect.getAttribute("y"));
    const rw = parseFloat2(rect.getAttribute("width"));
    const rh = parseFloat2(rect.getAttribute("height"));
    if (ry < headerH) continue;   // header area
    if (rw < 50 || rh < 20) continue; // too small
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    // Collect text lines inside this rect
    const lines = allTexts
      .filter(t => {
        const ty = parseFloat2(t.getAttribute("y"));
        const tx = parseFloat2(t.getAttribute("x"));
        return ty > ry - 5 && ty < ry + rh + 5 && Math.abs(tx - cx) < rw / 2 + 10;
      })
      .map(t => t.textContent?.trim() ?? "")
      .filter(Boolean);
    const label = lines.join("\n");
    rfNodes.push({
      id: `task-${idx++}`,
      type: "task",
      position: { x: cx, y: cy },
      data: { label, laneIndex: getLaneIndex(cx, laneXArr), nodeType: "task" },
    });
  }

  // 3c. DECISION diamonds — <polygon>
  for (const poly of svg.querySelectorAll("polygon")) {
    const pts = (poly.getAttribute("points") ?? "")
      .trim().split(/\s+/)
      .map(p => p.split(",").map(Number) as [number, number]);
    if (pts.length < 3) continue;
    // top point = pts[0], bottom = pts[2]
    const cx = pts[0][0];
    const cy = (pts[0][1] + pts[2][1]) / 2;
    const nearby = allTexts
      .filter(t => {
        const ty = parseFloat2(t.getAttribute("y"));
        const tx = parseFloat2(t.getAttribute("x"));
        return Math.abs(ty - cy) < 60 && Math.abs(tx - cx) < 80;
      })
      .map(t => t.textContent?.trim() ?? "")
      .filter(Boolean);
    rfNodes.push({
      id: `decision-${idx++}`,
      type: "decision",
      position: { x: cx, y: cy },
      data: { label: nearby[0] ?? "", laneIndex: getLaneIndex(cx, laneXArr), nodeType: "decision" },
    });
  }

  // 3d. START and END circles
  let startAdded = false;
  for (const circle of svg.querySelectorAll("circle")) {
    const cx = parseFloat2(circle.getAttribute("cx"));
    const cy = parseFloat2(circle.getAttribute("cy"));
    const r  = parseFloat2(circle.getAttribute("r"));
    if (Math.abs(cx - 45) > 10) continue; // only x≈45 = outside margin
    if (r < 20 && !startAdded) {
      rfNodes.push({
        id: "start",
        type: "start",
        position: { x: cx, y: cy },
        data: { label: "", laneIndex: 0, nodeType: "start" },
      });
      startAdded = true;
    } else if (r >= 20) {
      rfNodes.push({
        id: "end",
        type: "end",
        position: { x: cx, y: cy },
        data: { label: "סיום", laneIndex: 0, nodeType: "end" },
      });
    }
  }

  // ── 4. Edges — lines with marker-end ───────────────────────────────────────
  const rfEdges: Edge[] = [];
  let eidx = 0;
  const seen = new Set<string>();

  for (const line of allLines) {
    if (line.getAttribute("marker-end") !== "url(#arr)") continue;
    const x1 = parseFloat2(line.getAttribute("x1"));
    const y1 = parseFloat2(line.getAttribute("y1"));
    const x2 = parseFloat2(line.getAttribute("x2"));
    const y2 = parseFloat2(line.getAttribute("y2"));

    const src = closestNode(rfNodes, x1, y1, 50);
    const tgt = closestNode(rfNodes, x2, y2, 50);
    if (!src || !tgt || src === tgt) continue;
    const key = `${src}->${tgt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rfEdges.push({ id: `e-${eidx++}`, source: src, target: tgt });
  }

  return {
    rfVersion: 1,
    lanes,
    nodes: rfNodes,
    edges: rfEdges,
    svgWidth,
    svgHeight,
  };
}
