// ============================================================
// src/agents/shared/assembler.ts
// משאבים משותפים לכל הסוכנים — assembler.ts
// ============================================================
import type { SpecOutput } from "@/lib/spec-output-schema";
import type {
  RequirementsOutput,
  ArchitectureOutput,
  DataModelOutput,
  UseCasesOutput,
  DiagramsOutput,
} from "./types";

export function assembleSpec(
  requirements: RequirementsOutput,
  architecture: ArchitectureOutput,
  dataModel: DataModelOutput,
  useCases: UseCasesOutput,
  diagrams: DiagramsOutput,
  title = "מסמך אפיון",
): SpecOutput {
  // Merge use case diagrams back into the use_cases array
  const use_cases = useCases.use_cases.map((uc) => {
    const match = diagrams.use_case_diagrams.find((d) => d.id === uc.id);
    return match ? { ...uc, diagram: match.diagram } : uc;
  });

  // Use refined diagrams from Diagrams agent if they were produced
  const archDiagram =
    diagrams.architecture_diagram && diagrams.architecture_diagram.trim().length > 10
      ? diagrams.architecture_diagram
      : architecture.architecture.diagram;

  const dataModelDiagram =
    diagrams.data_model_diagram && diagrams.data_model_diagram.trim().length > 10
      ? diagrams.data_model_diagram
      : dataModel.data_model.diagram;

  return {
    title,
    overview: useCases.overview,
    goals: requirements.goals,
    personas: useCases.personas,
    functional_requirements: requirements.functional_requirements,
    non_functional_requirements: requirements.non_functional_requirements,
    assumptions: requirements.assumptions,
    use_cases,
    architecture: {
      description: architecture.architecture.description,
      diagram: archDiagram,
    },
    data_model: {
      description: dataModel.data_model.description,
      diagram: dataModelDiagram,
    },
    risks: requirements.risks,
  };
}

/** Merge improved requirements back into an existing spec */
export function mergeRequirements(
  current: SpecOutput,
  improved: RequirementsOutput,
): SpecOutput {
  return {
    ...current,
    goals: improved.goals,
    functional_requirements: improved.functional_requirements,
    non_functional_requirements: improved.non_functional_requirements,
    assumptions: improved.assumptions,
    risks: improved.risks,
  };
}

/** Merge improved use cases back into an existing spec */
export function mergeUseCases(
  current: SpecOutput,
  improved: UseCasesOutput,
  diagrams: DiagramsOutput,
): SpecOutput {
  const use_cases = improved.use_cases.map((uc) => {
    const match = diagrams.use_case_diagrams.find((d) => d.id === uc.id);
    return match ? { ...uc, diagram: match.diagram } : uc;
  });
  return { ...current, overview: improved.overview, personas: improved.personas, use_cases };
}

/** Merge improved architecture back into an existing spec */
export function mergeArchitecture(
  current: SpecOutput,
  improved: ArchitectureOutput,
  diagrams: DiagramsOutput,
): SpecOutput {
  const diagram =
    diagrams.architecture_diagram?.trim().length
      ? diagrams.architecture_diagram
      : improved.architecture.diagram;
  return { ...current, architecture: { ...improved.architecture, diagram } };
}
