import { describe, it, expect } from "vitest";
import {
  isDiagramRF,
  parseDiagramRF,
  validateDiagramAiOutput,
  type DiagramAiOutput,
} from "../diagram-rf";

describe("isDiagramRF", () => {
  it("returns false for plain mermaid code", () => {
    expect(isDiagramRF("flowchart TD\n  A --> B")).toBe(false);
  });

  it("returns false for malformed JSON", () => {
    expect(isDiagramRF("{not valid json}")).toBe(false);
  });

  it("returns true for rfVersion:1 object with nodes array", () => {
    const v1 = JSON.stringify({ rfVersion: 1, nodes: [], lanes: [], edges: [], svgWidth: 800, svgHeight: 600 });
    expect(isDiagramRF(v1)).toBe(true);
  });

  it("returns true for rfVersion:2 object with nodes array", () => {
    const v2 = JSON.stringify({ rfVersion: 2, kind: "diagram_flow", nodes: [], edges: [] });
    expect(isDiagramRF(v2)).toBe(true);
  });

  it("returns false for JSON without rfVersion", () => {
    expect(isDiagramRF(JSON.stringify({ nodes: [], edges: [] }))).toBe(false);
  });
});

describe("parseDiagramRF", () => {
  it("returns null for invalid JSON", () => {
    expect(parseDiagramRF("not json")).toBeNull();
  });

  it("returns null for JSON missing rfVersion", () => {
    expect(parseDiagramRF(JSON.stringify({ nodes: [], edges: [] }))).toBeNull();
  });

  it("returns parsed object for valid rfVersion:1", () => {
    const data = { rfVersion: 1 as const, lanes: [], nodes: [], edges: [], svgWidth: 800, svgHeight: 600 };
    expect(parseDiagramRF(JSON.stringify(data))).toEqual(data);
  });
});

describe("validateDiagramAiOutput", () => {
  it("returns empty array for valid flow output", () => {
    const out: DiagramAiOutput = {
      kind: "diagram_flow",
      nodes: [
        { id: "s1", type: "start", label: "Start" },
        { id: "t1", type: "task", label: "Do it" },
        { id: "e1", type: "end", label: "End" },
      ],
      edges: [
        { id: "edge1", source: "s1", target: "t1" },
        { id: "edge2", source: "t1", target: "e1" },
      ],
    };
    expect(validateDiagramAiOutput(out)).toEqual([]);
  });

  it("returns error for duplicate node ids", () => {
    const out: DiagramAiOutput = {
      kind: "diagram_flow",
      nodes: [
        { id: "s1", type: "start", label: "Start" },
        { id: "s1", type: "task", label: "Duplicate" },
        { id: "e1", type: "end", label: "End" },
      ],
      edges: [],
    };
    const errs = validateDiagramAiOutput(out);
    expect(errs.some((e) => e.includes("מזהי צמתים"))).toBe(true);
  });
});
