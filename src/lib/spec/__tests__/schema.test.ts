import { describe, it, expect } from "vitest";
import { emptySpec, normalizeSpec, newId } from "../schema";

describe("emptySpec", () => {
  it("returns an object with all required SpecContent keys", () => {
    const spec = emptySpec();
    expect(spec).toHaveProperty("overview");
    expect(spec).toHaveProperty("goals");
    expect(spec).toHaveProperty("functional_requirements");
    expect(spec).toHaveProperty("architecture");
    expect(spec).toHaveProperty("data_model");
  });

  it("initializes all array fields as empty arrays", () => {
    const spec = emptySpec();
    expect(spec.goals).toEqual([]);
    expect(spec.personas).toEqual([]);
    expect(spec.functional_requirements).toEqual([]);
    expect(spec.non_functional_requirements).toEqual([]);
    expect(spec.assumptions).toEqual([]);
    expect(spec.use_cases).toEqual([]);
    expect(spec.risks).toEqual([]);
  });
});

describe("normalizeSpec", () => {
  it("returns emptySpec() for null input", () => {
    expect(normalizeSpec(null)).toEqual(emptySpec());
  });

  it("returns emptySpec() for non-object input (string)", () => {
    expect(normalizeSpec("invalid")).toEqual(emptySpec());
  });

  it("preserves a valid overview string from the input", () => {
    const result = normalizeSpec({ overview: "great idea" });
    expect(result.overview).toBe("great idea");
  });

  it("converts non-array fields to empty arrays", () => {
    const result = normalizeSpec({ goals: "not an array", functional_requirements: null });
    expect(result.goals).toEqual([]);
    expect(result.functional_requirements).toEqual([]);
  });
});

describe("newId", () => {
  it("returns a non-empty string", () => {
    const id = newId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique values on successive calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
  });
});
