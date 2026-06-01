import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { embedChunks } from "@/lib/rag/embedder.server";

export interface RetrievedContext {
  contextBlock: string;
  hasFiles: boolean;
}

export async function retrieveContext(params: {
  query: string;
  userId: string;
  projectId: string | null;
  lovableApiKey: string;
  topK?: number;
}): Promise<RetrievedContext> {
  const { query, userId, projectId, lovableApiKey, topK = 5 } = params;

  if (!projectId) return { contextBlock: "", hasFiles: false };

  // Check if any ready documents exist for this project
  const { count } = await supabaseAdmin
    .from("uploaded_documents")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("status", "ready");

  if (!count) return { contextBlock: "", hasFiles: false };

  try {
    const [queryEmbedding] = await embedChunks([query], lovableApiKey);
    if (!queryEmbedding?.length) return { contextBlock: "", hasFiles: true };

    const { data: chunks, error } = await supabaseAdmin.rpc("match_document_chunks", {
      query_embedding: JSON.stringify(queryEmbedding) as unknown as never,
      match_project_id: projectId,
      match_user_id: userId,
      match_count: topK,
      min_similarity: 0.4,
    });

    if (error || !chunks?.length) return { contextBlock: "", hasFiles: true };

    const contextBlock = [
      "## חומרים שהמשתמש העלה (מידע רלוונטי)",
      ...chunks.map((c: { content: string }) => c.content),
      "",
      "---",
      "",
    ].join("\n");

    return { contextBlock, hasFiles: true };
  } catch (err) {
    console.warn("[context-agent] retrieval failed:", err);
    return { contextBlock: "", hasFiles: true };
  }
}
