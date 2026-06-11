import { describe, it, expect } from "vitest";
import { specToMarkdown, specToHtml } from "../export";
import type { SpecContent } from "../schema";

const SECTION_ORDER = [
  "overview",
  "goals",
  "functional_requirements",
  "non_functional_requirements",
  "use_cases",
  "architecture",
  "data_model",
];

function makeContent(partial: Partial<SpecContent> = {}): SpecContent {
  return {
    overview: "",
    goals: [],
    personas: [],
    functional_requirements: [],
    non_functional_requirements: [],
    assumptions: [],
    use_cases: [],
    architecture: { description: "", diagram: "" },
    data_model: { description: "", diagram: "" },
    risks: [],
    ...partial,
  };
}

const baseInput = {
  title: "My Spec",
  content: makeContent(),
  sectionOrder: SECTION_ORDER,
  sectionTitles: {},
};

describe("specToMarkdown", () => {
  it("includes the document title as an H1 heading", () => {
    const md = specToMarkdown(baseInput);
    expect(md).toContain("# My Spec");
  });

  it("renders goals as a bullet list", () => {
    const md = specToMarkdown({
      ...baseInput,
      content: makeContent({
        goals: [
          { id: "1", text: "Fast" },
          { id: "2", text: "Reliable" },
        ],
      }),
    });
    expect(md).toContain("- Fast");
    expect(md).toContain("- Reliable");
  });

  it("omits sections that have no content", () => {
    const md = specToMarkdown(baseInput);
    expect(md).not.toContain("functional_requirements");
    expect(md).not.toContain("non_functional_requirements");
  });

  it("renders functional requirements with sequential numbering", () => {
    const md = specToMarkdown({
      ...baseInput,
      content: makeContent({
        functional_requirements: [
          { id: "r1", title: "Login", description: "Users can log in" },
          { id: "r2", title: "Logout", description: "Users can log out" },
        ],
      }),
    });
    expect(md).toContain("### 1. Login");
    expect(md).toContain("### 2. Logout");
  });
});

describe("specToHtml", () => {
  it("wraps output in an HTML document structure", () => {
    const html = specToHtml(baseInput);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("My Spec");
  });
});
