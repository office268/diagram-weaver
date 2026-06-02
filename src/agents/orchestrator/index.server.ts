import type { DocTypeKey } from "@/lib/doc-types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { loadKnowledgeContextBlock } from "@/lib/knowledge-context.server";
import { SCORE_THRESHOLD, MAX_ITERATIONS } from "@/agents/shared/constants";
import type { AgentContext, OrchestratorOutput } from "@/agents/shared/types";
import { assembleSpec, mergeRequirements, mergeUseCases, mergeArchitecture } from "@/agents/shared/assembler";
import { retrieveContext } from "@/agents/context/index.server";
import { runRequirementsAgent } from "@/agents/requirements/index.server";
import { runArchitectureAgent } from "@/agents/architecture/index.server";
import { runDataModelAgent } from "@/agents/data-model/index.server";
import { runUseCasesAgent } from "@/agents/use-cases/index.server";
import { runDiagramsAgent } from "@/agents/diagrams/index.server";
import { runReviewAgent, filterNotesByKeywords } from "@/agents/review/index.server";

export async function runOrchestrator(params: {
  userPrompt: string;
  docType: DocTypeKey;
  userId: string;
  projectId: string | null;
  lovableApiKey: string;
  previousSpec?: Record<string, unknown>;
  reviewerNotes?: string[];
  scoreThreshold?: number;
  maxIterations?: number;
}): Promise<OrchestratorOutput> {
  const {
    userPrompt,
    docType,
    userId,
    projectId,
    lovableApiKey,
    previousSpec,
    reviewerNotes,
    scoreThreshold = SCORE_THRESHOLD,
    maxIterations = MAX_ITERATIONS,
  } = params;

  const gateway = createLovableAiGatewayProvider(lovableApiKey);
  const isRevision = !!previousSpec && Array.isArray(reviewerNotes) && reviewerNotes.length > 0;

  // Step 1: Load knowledge context + RAG context in parallel
  const [knowledgeBlock, ragResult] = await Promise.all([
    loadKnowledgeContextBlock(userId, projectId),
    retrieveContext({ query: userPrompt, userId, projectId, lovableApiKey }),
  ]);

  const ctx: AgentContext = {
    userPrompt,
    docType,
    knowledgeBlock,
    ragContext: ragResult.contextBlock,
    isRevision,
    reviewNotes: reviewerNotes,
  };

  // Step 2: Requirements agent
  const requirements = await runRequirementsAgent(ctx, gateway);

  // Step 3: Architecture + Data Model in parallel
  const [architecture, dataModel] = await Promise.all([
    runArchitectureAgent(ctx, requirements, gateway),
    runDataModelAgent(ctx, requirements, gateway),
  ]);

  // Step 4: Use Cases agent
  const useCases = await runUseCasesAgent(ctx, requirements, gateway);

  // Step 5: Diagrams agent
  const diagrams = await runDiagramsAgent(ctx, useCases, architecture, dataModel, gateway);

  // Step 6: Assemble full spec
  let currentSpec = assembleSpec(requirements, architecture, dataModel, useCases, diagrams);

  // Step 7: Review
  let currentReview = await runReviewAgent(currentSpec, userPrompt, gateway);
  let iterations = 1;

  // Step 8: Improvement loop
  while (currentReview.score < scoreThreshold && iterations < maxIterations) {
    const notes = currentReview.notes.map((n) => n.text);

    const reqKeywords = ["דרישה", "FR", "NFR", "requirements", "מטרה", "סיכון", "הנחה"];
    const archKeywords = ["ארכיטקטורה", "architecture", "רכיב", "diagram", "דיאגרמה"];
    const useCaseKeywords = ["תרחיש", "use case", "persona", "משתמש", "זרימה"];

    const reqNotes = filterNotesByKeywords(currentReview.notes, reqKeywords);
    const archNotes = filterNotesByKeywords(currentReview.notes, archKeywords);
    const ucNotes = filterNotesByKeywords(currentReview.notes, useCaseKeywords);

    const improveCtx: AgentContext = { ...ctx, isRevision: true, reviewNotes: notes };

    // Run only relevant agents
    if (reqNotes.length > 0) {
      const improved = await runRequirementsAgent(improveCtx, gateway);
      currentSpec = mergeRequirements(currentSpec, improved);
    }

    if (archNotes.length > 0) {
      const [improvedArch, improvedDiagrams] = await Promise.all([
        runArchitectureAgent(improveCtx, requirements, gateway),
        runDiagramsAgent(improveCtx, useCases, architecture, dataModel, gateway),
      ]);
      currentSpec = mergeArchitecture(currentSpec, improvedArch, improvedDiagrams);
    }

    if (ucNotes.length > 0) {
      const [improvedUC, improvedDiagrams] = await Promise.all([
        runUseCasesAgent(improveCtx, requirements, gateway),
        runDiagramsAgent(improveCtx, useCases, architecture, dataModel, gateway),
      ]);
      currentSpec = mergeUseCases(currentSpec, improvedUC, improvedDiagrams);
    }

    currentReview = await runReviewAgent(currentSpec, userPrompt, gateway);
    iterations++;
  }

  return { spec: currentSpec, finalScore: currentReview.score, iterations, review: currentReview };
}
