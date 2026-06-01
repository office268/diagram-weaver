// Server-only: RAG retrieval for the orchestrator.
// Uses Lovable AI Gateway /v1/embeddings + pgvector match_document_chunks RPC.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims, indexable

async function embedQuery(query: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: query.slice(0, 8000),
      }),
    });
    if (!res.ok) {
      console.error("[rag] embed query failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    return json.data?.[0]?.embedding ?? null;
  } catch (e) {
    console.error("[rag] embed query threw", e);
    return null;
  }
}

export interface RagContext {
  contextBlock: string;
  chunkCount: number;
}

export async function retrieveContext(params: {
  query: string;
  userId: string;
  projectId: string | null;
  apiKey: string;
  matchCount?: number;
}): Promise<RagContext> {
  const { query, userId, projectId, apiKey, matchCount = 6 } = params;
  if (!query.trim()) return { contextBlock: "", chunkCount: 0 };

  // Skip the embedding call entirely if the user has no documents.
  const { count } = await supabaseAdmin
    .from("document_chunks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (!count) return { contextBlock: "", chunkCount: 0 };

  const queryEmbedding = await embedQuery(query, apiKey);
  if (!queryEmbedding) return { contextBlock: "", chunkCount: 0 };

  const { data, error } = await supabaseAdmin.rpc("match_document_chunks", {
    _user_id: userId,
    _project_id: (projectId ?? null) as unknown as string,
    _query: queryEmbedding as unknown as string, // pgvector accepts array-like
    _match_count: matchCount,
  });

  if (error) {
    console.error("[rag] match_document_chunks error", error);
    return { contextBlock: "", chunkCount: 0 };
  }

  const rows = (data ?? []) as Array<{
    id: string;
    content: string;
    similarity: number;
  }>;
  if (!rows.length) return { contextBlock: "", chunkCount: 0 };

  // Cap total characters (~3000 tokens budget).
  const MAX_CHARS = 12000;
  let used = 0;
  const blocks: string[] = ["## הקשר ממסמכים מצורפים (RAG)"];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const text = r.content.trim();
    if (!text) continue;
    if (used + text.length > MAX_CHARS) break;
    blocks.push(
      `### קטע ${i + 1} (similarity=${r.similarity.toFixed(2)})`,
      text,
    );
    used += text.length;
  }
  blocks.push("", "---", "");
  return { contextBlock: blocks.join("\n"), chunkCount: rows.length };
}
