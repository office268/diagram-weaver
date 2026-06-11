import { describe, it, expect } from "vitest";
import { filterNotesByKeywords } from "@/agents/review/index.server";
import { IMPROVEMENT_KEYWORDS } from "@/agents/shared/constants";

const notes = [
  { id: "n1", text: "חסר פירוט בדרישות ה-FR", importance: 8 },
  { id: "n2", text: "הארכיטקטורה לא ברורה", importance: 7 },
  { id: "n3", text: "תרחיש למשתמש חסר", importance: 6 },
  { id: "n4", text: "הערה כללית ללא מילות מפתח ספציפיות", importance: 3 },
];

describe("filterNotesByKeywords", () => {
  it("routes requirements notes by requirements keywords", () => {
    const result = filterNotesByKeywords(notes, [...IMPROVEMENT_KEYWORDS.requirements]);
    expect(result.map((n) => n.id)).toContain("n1");
    expect(result.map((n) => n.id)).not.toContain("n2");
  });

  it("routes architecture notes by architecture keywords", () => {
    const result = filterNotesByKeywords(notes, [...IMPROVEMENT_KEYWORDS.architecture]);
    expect(result.map((n) => n.id)).toContain("n2");
    expect(result.map((n) => n.id)).not.toContain("n1");
  });

  it("routes use case notes by use case keywords", () => {
    const result = filterNotesByKeywords(notes, [...IMPROVEMENT_KEYWORDS.useCases]);
    expect(result.map((n) => n.id)).toContain("n3");
  });

  it("returns empty array when no notes match", () => {
    const result = filterNotesByKeywords(notes, ["nonexistent-keyword"]);
    expect(result).toHaveLength(0);
  });

  it("is case-insensitive", () => {
    const mixed = [{ id: "x1", text: "ARCHITECTURE needs work", importance: 5 }];
    const result = filterNotesByKeywords(mixed, ["architecture"]);
    expect(result).toHaveLength(1);
  });
});

describe("IMPROVEMENT_KEYWORDS", () => {
  it("contains FR in requirements keywords", () => {
    expect(IMPROVEMENT_KEYWORDS.requirements).toContain("FR");
  });

  it("contains architecture in architecture keywords", () => {
    expect(IMPROVEMENT_KEYWORDS.architecture).toContain("architecture");
  });

  it("contains use case in useCases keywords", () => {
    expect(IMPROVEMENT_KEYWORDS.useCases).toContain("use case");
  });
});
