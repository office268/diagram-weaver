import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Returns a callable provider: `gateway(modelId)`.
 *
 * - Models prefixed with `anthropic/` are routed to Anthropic's native API
 *   using ANTHROPIC_API_KEY (extended-thinking reasoning models).
 * - All other models go through Lovable AI Gateway.
 */
export function createLovableAiGatewayProvider(lovableApiKey: string) {
  const lovable = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

  let anthropic: ReturnType<typeof createAnthropic> | null = null;
  const getAnthropic = () => {
    if (anthropic) return anthropic;
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        "ANTHROPIC_API_KEY חסר — נדרש לשימוש במודלי Claude. הוסף את הסוד והפעל מחדש.",
      );
    }
    anthropic = createAnthropic({ apiKey: key });
    return anthropic;
  };

  const dispatch = (modelId: string): LanguageModel => {
    if (modelId.startsWith("anthropic/")) {
      const id = modelId.slice("anthropic/".length);
      return getAnthropic()(id);
    }
    return lovable(modelId);
  };

  return Object.assign(dispatch, {
    chatModel: (modelId: string) => dispatch(modelId),
    textEmbeddingModel: (modelId: string) => lovable.textEmbeddingModel(modelId),
    imageModel: (modelId: string) => lovable.imageModel(modelId),
  });
}
