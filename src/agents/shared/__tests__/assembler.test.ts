import { describe, it, expect } from "vitest";
import {
  assembleSpec,
  mergeRequirements,
  mergeUseCases,
  mergeArchitecture,
} from "@/agents/shared/assembler";
import type {
  RequirementsOutput,
  ArchitectureOutput,
  DataModelOutput,
  UseCasesOutput,
  DiagramsOutput,
} from "@/agents/shared/types";

const baseReqs: RequirementsOutput = {
  goals: [{ id: "g1", text: "goal" }],
  functional_requirements: [{ id: "fr1", title: "FR1", description: "desc" }],
  non_functional_requirements: [],
  assumptions: [],
  risks: [],
};

const baseArch: ArchitectureOutput = {
  architecture: { description: "arch desc", diagram: "arch-fallback-diagram" },
};

const baseDm: DataModelOutput = {
  data_model: { description: "dm desc", diagram: "dm-fallback-diagram" },
};

const baseUseCases: UseCasesOutput = {
  overview: "overview text",
  personas: [{ id: "p1", name: "User", description: "basic user" }],
  use_cases: [{ id: "uc1", title: "UC1", description: "use case 1", diagram: "" }],
};

const emptyDiagrams: DiagramsOutput = { use_case_diagrams: [] };

describe("assembleSpec", () => {
  it("produces a spec with all sections from agent outputs", () => {
    const spec = assembleSpec(baseReqs, baseArch, baseDm, baseUseCases, emptyDiagrams);
    expect(spec.goals).toEqual(baseReqs.goals);
    expect(spec.overview).toBe("overview text");
    expect(spec.architecture.description).toBe("arch desc");
    expect(spec.data_model.description).toBe("dm desc");
  });

  it("uses diagrams agent architecture_diagram when non-empty", () => {
    const diagrams: DiagramsOutput = {
      use_case_diagrams: [],
      architecture_diagram: "from-diagrams-agent",
    };
    const spec = assembleSpec(baseReqs, baseArch, baseDm, baseUseCases, diagrams);
    expect(spec.architecture.diagram).toBe("from-diagrams-agent");
  });

  it("falls back to architecture agent diagram when diagrams agent produces empty/short value", () => {
    const diagrams: DiagramsOutput = { use_case_diagrams: [], architecture_diagram: "short" };
    const spec = assembleSpec(baseReqs, baseArch, baseDm, baseUseCases, diagrams);
    expect(spec.architecture.diagram).toBe("arch-fallback-diagram");
  });

  it("stitches use_case_diagrams by id", () => {
    const diagrams: DiagramsOutput = {
      use_case_diagrams: [{ id: "uc1", diagram: "uc1-diagram-json" }],
    };
    const spec = assembleSpec(baseReqs, baseArch, baseDm, baseUseCases, diagrams);
    expect(spec.use_cases[0].diagram).toBe("uc1-diagram-json");
  });
});

describe("mergeRequirements", () => {
  it("replaces goals/FRs but preserves overview and use_cases", () => {
    const base = assembleSpec(baseReqs, baseArch, baseDm, baseUseCases, emptyDiagrams);
    const improved: RequirementsOutput = {
      goals: [{ id: "g2", text: "new goal" }],
      functional_requirements: [],
      non_functional_requirements: [],
      assumptions: [{ id: "a1", text: "assumption" }],
      risks: [],
    };
    const merged = mergeRequirements(base, improved);
    expect(merged.goals).toEqual(improved.goals);
    expect(merged.overview).toBe(base.overview);
    expect(merged.use_cases).toEqual(base.use_cases);
  });
});

describe("mergeUseCases", () => {
  it("updates overview and personas and stitches new diagrams", () => {
    const base = assembleSpec(baseReqs, baseArch, baseDm, baseUseCases, emptyDiagrams);
    const improvedUC: UseCasesOutput = {
      overview: "new overview",
      personas: [{ id: "p2", name: "Admin", description: "admin user" }],
      use_cases: [{ id: "uc2", title: "UC2", description: "new uc", diagram: "" }],
    };
    const diagrams: DiagramsOutput = {
      use_case_diagrams: [{ id: "uc2", diagram: "uc2-diagram" }],
    };
    const merged = mergeUseCases(base, improvedUC, diagrams);
    expect(merged.overview).toBe("new overview");
    expect(merged.personas[0].name).toBe("Admin");
    expect(merged.use_cases[0].diagram).toBe("uc2-diagram");
    expect(merged.goals).toEqual(base.goals);
  });
});

describe("mergeArchitecture", () => {
  it("uses diagrams agent architecture_diagram when present", () => {
    const base = assembleSpec(baseReqs, baseArch, baseDm, baseUseCases, emptyDiagrams);
    const improvedArch: ArchitectureOutput = {
      architecture: { description: "improved arch", diagram: "agent-diagram" },
    };
    const diagrams: DiagramsOutput = {
      use_case_diagrams: [],
      architecture_diagram: "diagrams-agent-diagram",
    };
    const merged = mergeArchitecture(base, improvedArch, diagrams);
    expect(merged.architecture.diagram).toBe("diagrams-agent-diagram");
    expect(merged.goals).toEqual(base.goals);
  });

  it("falls back to improved architecture diagram when diagrams agent produced nothing", () => {
    const base = assembleSpec(baseReqs, baseArch, baseDm, baseUseCases, emptyDiagrams);
    const improvedArch: ArchitectureOutput = {
      architecture: { description: "improved arch", diagram: "agent-fallback" },
    };
    const merged = mergeArchitecture(base, improvedArch, emptyDiagrams);
    expect(merged.architecture.diagram).toBe("agent-fallback");
  });
});
