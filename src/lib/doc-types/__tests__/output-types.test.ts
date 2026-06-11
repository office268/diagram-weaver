import { describe, it, expect } from "vitest";
import { getOutputType, isDocumentType, isDiagramType } from "../output-types";

describe("getOutputType", () => {
  it("returns null for null input", () => {
    expect(getOutputType(null)).toBeNull();
  });

  it("returns null for unknown key", () => {
    expect(getOutputType("not_a_real_type")).toBeNull();
  });

  it("returns correct definition for known key", () => {
    const def = getOutputType("diagram_flow");
    expect(def).not.toBeNull();
    expect(def?.key).toBe("diagram_flow");
    expect(def?.category).toBe("diagram");
  });
});

describe("isDocumentType / isDiagramType", () => {
  it("returns true for a document key", () => {
    expect(isDocumentType("spec_overview")).toBe(true);
  });

  it("returns false for a diagram key in isDocumentType", () => {
    expect(isDocumentType("diagram_flow")).toBe(false);
  });

  it("returns true for a diagram key in isDiagramType", () => {
    expect(isDiagramType("diagram_erd")).toBe(true);
  });
});
