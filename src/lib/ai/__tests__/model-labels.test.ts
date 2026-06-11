import { describe, it, expect } from "vitest";
import { modelLabel, modelShortLabel } from "../model-labels";

describe("modelLabel", () => {
  it("returns em-dash for null", () => {
    expect(modelLabel(null)).toBe("—");
  });

  it("returns em-dash for undefined", () => {
    expect(modelLabel(undefined)).toBe("—");
  });

  it("returns full label for a known model", () => {
    const label = modelLabel("google/gemini-2.5-pro");
    expect(label).toContain("Gemini 2.5 Pro");
    expect(label).not.toBe("google/gemini-2.5-pro");
  });

  it("returns the model id as fallback for unknown model", () => {
    expect(modelLabel("unknown/model-xyz")).toBe("unknown/model-xyz");
  });
});

describe("modelShortLabel", () => {
  it("returns em-dash for null", () => {
    expect(modelShortLabel(null)).toBe("—");
  });

  it("returns em-dash for undefined", () => {
    expect(modelShortLabel(undefined)).toBe("—");
  });

  it("returns a shorter label than modelLabel for a known model", () => {
    const short = modelShortLabel("google/gemini-2.5-pro");
    const full = modelLabel("google/gemini-2.5-pro");
    expect(short.length).toBeLessThan(full.length);
  });

  it("returns the model id as fallback for unknown model", () => {
    expect(modelShortLabel("unknown/model-xyz")).toBe("unknown/model-xyz");
  });
});
