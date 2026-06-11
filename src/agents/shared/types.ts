// ============================================================
// src/agents/shared/types.ts
// משאבים משותפים לכל הסוכנים — types.ts
// ============================================================
import type { SpecOutput, SpecReview } from "@/lib/spec-output-schema";
import type { DocTypeKey } from "@/lib/doc-types";

export interface AgentContext {
  userPrompt: string;
  docType: DocTypeKey;
  knowledgeBlock: string;
  ragContext: string;
  previousSections?: Partial<SpecOutput>;
  reviewNotes?: string[];
  isRevision: boolean;
  /** Optional model override selected by admin; overrides AGENT_MODELS defaults. */
  model?: string;
}

export interface RequirementsOutput {
  goals: SpecOutput["goals"];
  functional_requirements: SpecOutput["functional_requirements"];
  non_functional_requirements: SpecOutput["non_functional_requirements"];
  assumptions: SpecOutput["assumptions"];
  risks: SpecOutput["risks"];
}

export interface ArchitectureOutput {
  architecture: SpecOutput["architecture"];
}

export interface DataModelOutput {
  data_model: SpecOutput["data_model"];
}

export interface UseCasesOutput {
  overview: string;
  personas: SpecOutput["personas"];
  use_cases: SpecOutput["use_cases"];
}

export interface DiagramsOutput {
  use_case_diagrams: Array<{ id: string; diagram: string }>;
  architecture_diagram?: string;
  data_model_diagram?: string;
}

export interface OrchestratorOutput {
  spec: SpecOutput;
  finalScore: number;
  iterations: number;
  review: SpecReview;
}
