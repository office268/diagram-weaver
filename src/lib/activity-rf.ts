import type { Node, Edge } from "@xyflow/react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActivityNodeType =
  | "task" | "decision" | "start" | "end" | "joinBar" | "lane" | "actor";

export interface ActivityNodeData extends Record<string, unknown> {
  label: string;
  laneIndex: number;
  nodeType: ActivityNodeType;
  barWidth?: number;   // joinBar only
  laneWidth?: number;  // lane only
  laneHeight?: number; // lane only
}

export interface LaneDef {
  label: string;
  x: number;
  width: number;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFloat2(s: string | null | undefined, fallback = 0) {
  const n = parseFloat(s ?? "");
  return isNaN(n) ? fallback : n;
}

function finiteOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function parsePolygonPoints(points: string): Array<{ x: number; y: number }> {
  const nums = points.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  const pairs: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i];
    const y = nums[i + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    pairs.push({ x, y });
  }
  return pairs;
}

function getLaneIndex(cx: number, laneX: number[]): number {
  for (let i = laneX.length - 1; i >= 0; i--) {
    if (cx >= laneX[i]) return i;
  }
  return 0;
}

/** Convert SVG center coords → React Flow top-left position. */
function centerToTopLeft(
  nodeType: string,
  cx: number,
  cy: number,
  barWidth = 100,
): { x: number; y: number } {
  switch (nodeType) {
    case "task":     return { x: cx - 75, y: cy - 25 };
    case "decision": return { x: cx - 48, y: cy - 48 };
    case "start":    return { x: cx - 20, y: cy - 20 };
    case "end":      return { x: cx - 25, y: cy - 25 };
    case "joinBar":  return { x: cx - barWidth / 2, y: cy - 5.5 };
    case "actor":    return { x: cx - 20, y: cy - 35 };
    default:         return { x: cx, y: cy };
  }
}

/** Bounding box of a node (origin = top-left). */
function nodeBounds(n: Node<ActivityNodeData>): {
  x: number; y: number; w: number; h: number;
} {
  const { x, y } = n.position;
  const bw = (n.data.barWidth as number) ?? 100;
  switch (n.data.nodeType) {
    case "task":     return { x, y, w: 150, h: 50 };
    case "decision": return { x, y, w: 96,  h: 96 };
    case "start":    return { x, y, w: 40,  h: 40 };
    case "end":      return { x, y, w: 50,  h: 50 };
    case "joinBar":  return { x, y, w: bw,  h: 12 };
    case "actor":    return { x, y, w: 40,  h: 70 };
    default:         return { x, y, w: 80,  h: 40 };
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
  threshold = 60,
): string | null {
  let best: string | null = null;
  let bestD = threshold;
  for (const n of nodes) {
    if (n.data.nodeType === "lane") continue;
    const d = distToNode(n, px, py);
    if (d < bestD) { bestD = d; best = n.id; }
  }
  return best;
}

// ── SVG → RF parser ───────────────────────────────────────────────────────────

export function parseSvgToRF(svgString: string): ActivityRFData | null {
  if (typeof window === "undefined") return null;

  const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName === "parsererror") return null;

  const vb = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
  const svgWidth  = finiteOr(vb?.[2], 1200);
  const svgHeight = finiteOr(vb?.[3], 800);
  const headerH   = 44;

  // 1. Lane boundaries — vertical dashed blue lines
  const laneXSet = new Set<number>([90]);
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

  // 2. Lane header labels
  const allTexts = Array.from(svg.querySelectorAll("text"));
  const headerTexts = allTexts.filter(t => {
    const y  = parseFloat2(t.getAttribute("y"));
    const fw = t.getAttribute("font-weight");
    return y < headerH && fw === "bold";
  });

  const lanes: LaneDef[] = laneXArr.map((x, i) => {
    const nextX  = laneXArr[i + 1] ?? (svgWidth - 10);
    const width  = nextX - x;
    const cx     = x + width / 2;
    const label  = headerTexts.find(t => {
      const tx = parseFloat2(t.getAttribute("x"));
      return Math.abs(tx - cx) < width / 2 + 5;
    })?.textContent?.trim() ?? `Lane ${i + 1}`;
    return { label, x, width };
  });

  // 3. Nodes
  const rfNodes: Node<ActivityNodeData>[] = [];
  let idx = 0;

  // 3a. JOIN BARs — fill="#111"
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
      position: centerToTopLeft("joinBar", cx, cy, rw),
      data: { label: "", laneIndex: getLaneIndex(cx, laneXArr), nodeType: "joinBar", barWidth: rw },
    });
  }

  // 3b. TASK nodes — accept any rect that isn't joinBar/background/lane
  const laneWidths = new Set(lanes.map(l => Math.round(l.width)));
  for (const rect of svg.querySelectorAll("rect")) {
    const fill = (rect.getAttribute("fill") ?? "").toLowerCase();
    if (fill === "#111") continue; // joinBar
    const rx = parseFloat2(rect.getAttribute("x"));
    const ry = parseFloat2(rect.getAttribute("y"));
    const rw = parseFloat2(rect.getAttribute("width"));
    const rh = parseFloat2(rect.getAttribute("height"));
    if (ry < headerH - 2) continue;
    if (rw < 50 || rh < 20) continue;
    if (rw > 260 || rh > 110) continue; // skip large background/lane rects
    if (laneWidths.has(Math.round(rw))) continue; // exact lane-width rect → lane bg
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    const labelLines = allTexts
      .filter(t => {
        const ty = parseFloat2(t.getAttribute("y"));
        const tx = parseFloat2(t.getAttribute("x"));
        return ty > ry - 5 && ty < ry + rh + 5 && Math.abs(tx - cx) < rw / 2 + 10;
      })
      .map(t => t.textContent?.trim() ?? "")
      .filter(Boolean);
    rfNodes.push({
      id: `task-${idx++}`,
      type: "task",
      position: centerToTopLeft("task", cx, cy),
      data: { label: labelLines.join("\n"), laneIndex: getLaneIndex(cx, laneXArr), nodeType: "task" },
    });
  }

  // 3c. DECISION diamonds
  for (const poly of svg.querySelectorAll("polygon")) {
    if (poly.closest("defs, marker")) continue;
    const pts = parsePolygonPoints(poly.getAttribute("points") ?? "");
    if (pts.length < 3) continue;
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 40 || height < 40) continue;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const nearby = allTexts
      .filter(t => {
        const ty = parseFloat2(t.getAttribute("y"));
        const tx = parseFloat2(t.getAttribute("x"));
        return Math.abs(ty - cy) < 40 && Math.abs(tx - cx) < 70;
      })
      .sort((a, b) => parseFloat2(a.getAttribute("y")) - parseFloat2(b.getAttribute("y")))
      .map(t => t.textContent?.trim() ?? "")
      .filter(Boolean)
      .slice(0, 3);
    rfNodes.push({
      id: `decision-${idx++}`,
      type: "decision",
      position: centerToTopLeft("decision", cx, cy),
      data: { label: nearby.join("\n"), laneIndex: getLaneIndex(cx, laneXArr), nodeType: "decision" },
    });
  }

  // 3d. ACTOR (stick figure) — small head circle near left + body lines
  // Detect actors first so we don't mis-classify their head as START.
  const actorCxSet = new Set<number>();
  for (const circle of svg.querySelectorAll("circle")) {
    const cx = parseFloat2(circle.getAttribute("cx"));
    const cy = parseFloat2(circle.getAttribute("cy"));
    const r  = parseFloat2(circle.getAttribute("r"));
    if (r > 0 && r <= 12 && cy < 200) {
      // body line below the head?
      const hasBody = allLines.some(l => {
        const lx1 = parseFloat2(l.getAttribute("x1"));
        const lx2 = parseFloat2(l.getAttribute("x2"));
        const ly1 = parseFloat2(l.getAttribute("y1"));
        return Math.abs(lx1 - cx) < 4 && Math.abs(lx2 - cx) < 4 && ly1 > cy && ly1 < cy + 30;
      });
      if (hasBody) {
        actorCxSet.add(Math.round(cx));
        rfNodes.push({
          id: `actor-${idx++}`,
          type: "actor",
          position: centerToTopLeft("actor", cx, cy + 25),
          data: { label: "", laneIndex: getLaneIndex(cx, laneXArr), nodeType: "actor" },
        });
      }
    }
  }

  // 3e. START and END circles (always at x≈45, excluding actor heads)
  let startAdded = false;
  for (const circle of svg.querySelectorAll("circle")) {
    const cx = parseFloat2(circle.getAttribute("cx"));
    const cy = parseFloat2(circle.getAttribute("cy"));
    const r  = parseFloat2(circle.getAttribute("r"));
    if (Math.abs(cx - 45) > 15) continue;
    if (actorCxSet.has(Math.round(cx)) && r < 15) continue;
    if (r < 20 && !startAdded) {
      rfNodes.push({
        id: "start",
        type: "start",
        position: centerToTopLeft("start", cx, cy),
        data: { label: "", laneIndex: 0, nodeType: "start" },
      });
      startAdded = true;
    } else if (r >= 20) {
      rfNodes.push({
        id: "end",
        type: "end",
        position: centerToTopLeft("end", cx, cy),
        data: { label: "סיום", laneIndex: 0, nodeType: "end" },
      });
    }
  }

  // 4. Edges — arrows only
  const rfEdges: Edge[] = [];
  let eidx = 0;
  const seen = new Set<string>();
  for (const line of allLines) {
    if (line.getAttribute("marker-end") !== "url(#arr)") continue;
    const x1 = parseFloat2(line.getAttribute("x1"));
    const y1 = parseFloat2(line.getAttribute("y1"));
    const x2 = parseFloat2(line.getAttribute("x2"));
    const y2 = parseFloat2(line.getAttribute("y2"));
    const src = closestNode(rfNodes, x1, y1, 60);
    const tgt = closestNode(rfNodes, x2, y2, 60);
    if (!src || !tgt || src === tgt) continue;
    const key = `${src}->${tgt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rfEdges.push({ id: `e-${eidx++}`, source: src, target: tgt });
  }

  // 5. Lane nodes (rendered as swimlane columns behind everything)
  const laneNodes: Node<ActivityNodeData>[] = lanes.map((lane, i) => ({
    id: `lane-${i}`,
    type: "lane",
    position: { x: lane.x, y: 0 },
    style: { width: lane.width, height: svgHeight, zIndex: -1 },
    data: {
      label: lane.label,
      laneIndex: i,
      nodeType: "lane" as ActivityNodeType,
      laneWidth: lane.width,
      laneHeight: svgHeight,
    },
    selectable: false,
    draggable: false,
    focusable: false,
    zIndex: -1,
  }));

  return {
    rfVersion: 1,
    lanes,
    nodes: [...laneNodes, ...rfNodes],
    edges: rfEdges,
    svgWidth,
    svgHeight,
  };
}
