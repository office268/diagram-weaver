import { embedMany } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 50;

export async function embedChunks(
  texts: string[],
  lovableApiKey: string,
): Promise<number[][]> {
  const gateway = createLovableAiGatewayProvider(lovableApiKey);
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: gateway.textEmbeddingModel(EMBEDDING_MODEL),
      values: batch,
    });
    results.push(...embeddings);
  }

  return results;
}
