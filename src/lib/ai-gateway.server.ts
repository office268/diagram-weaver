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
    fetch: async (input, init) => {
      // OpenAI GPT-5.x reasoning models reject `max_tokens` and require
      // `max_completion_tokens` instead. The AI SDK's openai-compatible
      // provider always sends `max_tokens`, so rewrite it on the wire.
      try {
        if (init?.body && typeof init.body === "string") {
          const parsed = JSON.parse(init.body) as Record<string, unknown>;
          const model = typeof parsed.model === "string" ? parsed.model : "";
          if (
            model.startsWith("openai/gpt-5") &&
            "max_tokens" in parsed &&
            !("max_completion_tokens" in parsed)
          ) {
            parsed.max_completion_tokens = parsed.max_tokens;
            delete parsed.max_tokens;
            init = { ...init, body: JSON.stringify(parsed) };
          }
        }
      } catch {
        // Non-JSON body or parse error — pass through unchanged.
      }
      return fetch(input, init);
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
