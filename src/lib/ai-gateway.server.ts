// ============================================================
// src/lib/ai-gateway.server.ts
// מודול server-only — ai-gateway.server.ts
// מורץ רק בצד השרת (TanStack Start)
// ============================================================
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
      // OpenAI GPT-5.x reasoning models have stricter request constraints:
      // - require `max_completion_tokens` instead of `max_tokens`
      // - only accept the default `temperature` (1)
      // - reject `top_p`, `frequency_penalty`, `presence_penalty`
      // Normalize on the wire since the AI SDK's openai-compatible provider
      // doesn't know about these restrictions. Handle multiple body shapes
      // (string / Uint8Array / Request input).
      try {
        let bodyText: string | null = null;
        if (init?.body) {
          if (typeof init.body === "string") {
            bodyText = init.body;
          } else if (init.body instanceof Uint8Array) {
            bodyText = new TextDecoder().decode(init.body);
          } else if (
            typeof ArrayBuffer !== "undefined" &&
            init.body instanceof ArrayBuffer
          ) {
            bodyText = new TextDecoder().decode(new Uint8Array(init.body));
          }
        }
        if (bodyText === null && input instanceof Request) {
          try { bodyText = await input.clone().text(); } catch { /* ignore */ }
        }

        if (bodyText) {
          const parsed = JSON.parse(bodyText) as Record<string, unknown>;
          const model = typeof parsed.model === "string" ? parsed.model : "";
          // Match openai/gpt-5, openai/gpt-5.4, openai/gpt-5.5, openai/gpt-5-mini, …
          if (/^openai\/gpt-5(\b|[.\-])/i.test(model)) {
            if ("max_tokens" in parsed && !("max_completion_tokens" in parsed)) {
              parsed.max_completion_tokens = parsed.max_tokens;
            }
            delete parsed.max_tokens;
            delete parsed.temperature;
            delete parsed.top_p;
            delete parsed.frequency_penalty;
            delete parsed.presence_penalty;
            const newBody = JSON.stringify(parsed);
            if (input instanceof Request) {
              // Rebuild Request so its internal body doesn't override init.body.
              input = new Request(input.url, {
                method: input.method,
                headers: input.headers,
                body: newBody,
              });
            }
            init = { ...init, body: newBody };
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
