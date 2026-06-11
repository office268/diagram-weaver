import { describe, it, expect } from "vitest";
import { calcCostUsd, MODEL_PRICING } from "../pricing";

describe("calcCostUsd", () => {
  it("returns 0 for unknown model", () => {
    expect(calcCostUsd("unknown/model-xyz", 1000, 1000)).toBe(0);
  });

  it("calculates cost for known model using input tokens only", () => {
    // google/gemini-2.5-flash: input $0.30/1M
    const cost = calcCostUsd("google/gemini-2.5-flash", 1_000_000, 0);
    expect(cost).toBeCloseTo(0.3, 10);
  });

  it("calculates cost for known model using output tokens only", () => {
    // google/gemini-2.5-flash: output $2.50/1M
    const cost = calcCostUsd("google/gemini-2.5-flash", 0, 1_000_000);
    expect(cost).toBeCloseTo(2.5, 10);
  });

  it("calculates combined input + output cost", () => {
    // google/gemini-2.5-pro: input $1.25/1M, output $10.00/1M
    // 500k input + 200k output = 0.625 + 2.0 = 2.625
    const cost = calcCostUsd("google/gemini-2.5-pro", 500_000, 200_000);
    expect(cost).toBeCloseTo(2.625, 10);
  });

  it("returns 0 when both token counts are 0", () => {
    expect(calcCostUsd("google/gemini-2.5-flash", 0, 0)).toBe(0);
  });

  it("handles very large token counts without overflow", () => {
    // 1 billion tokens each
    const cost = calcCostUsd("google/gemini-2.5-flash", 1_000_000_000, 1_000_000_000);
    // input: 1000 * 0.3 = 300, output: 1000 * 2.5 = 2500, total = 2800
    expect(cost).toBeCloseTo(2800, 5);
  });

  it("is consistent across different known models", () => {
    const knownModels = Object.keys(MODEL_PRICING);
    for (const model of knownModels) {
      const cost = calcCostUsd(model, 100_000, 100_000);
      expect(cost).toBeGreaterThan(0);
    }
  });
});
