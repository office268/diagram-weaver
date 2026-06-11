import { describe, it, expect, vi } from "vitest";

// mermaid and elkLayouts use browser globals; stub them out
vi.mock("mermaid", () => ({
  default: {
    registerLayoutLoaders: vi.fn(),
    initialize: vi.fn(),
    render: vi.fn(),
    parse: vi.fn(),
  },
}));
vi.mock("@mermaid-js/layout-elk", () => ({ default: {} }));

import {
  normalizeMermaidForValidation,
  getMermaidValidationError,
} from "../mermaid-utils";

describe("normalizeMermaidForValidation", () => {
  it("returns clean code unchanged", () => {
    const code = "flowchart TD\n  A --> B";
    expect(normalizeMermaidForValidation(code)).toBe(code);
  });

  it("strips a malformed init directive with double braces", () => {
    const bad = '%%{{"flowchart": {"curve": "basis"}}}%%\nflowchart TD\n  A --> B';
    const result = normalizeMermaidForValidation(bad);
    expect(result).not.toContain("%%");
    expect(result).toContain("flowchart TD");
  });

  it("repairs triple-diamond decision nodes", () => {
    const code = "flowchart TD\n  A{{{label}}}";
    const result = normalizeMermaidForValidation(code);
    expect(result).toContain("{{label}}");
    expect(result).not.toContain("{{{");
  });
});

describe("getMermaidValidationError", () => {
  it("returns an error message for empty input", () => {
    const err = getMermaidValidationError("");
    expect(err).not.toBeNull();
    expect(typeof err).toBe("string");
  });

  it("returns an error for unbalanced subgraph/end blocks", () => {
    const code = "flowchart TD\n  subgraph cluster\n  A --> B";
    const err = getMermaidValidationError(code);
    expect(err).not.toBeNull();
  });
});
