import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractText } from "./text-extractor.server";
import { chunkText } from "./chunker.server";
import { embedChunks } from "./embedder.server";

export async function ingestDocument(params: {
  documentId: string;
  userId: string;
  projectId: string | null;
  buffer: Buffer;
  mimeType: string;
  lovableApiKey: string;
}): Promise<void> {
  const { documentId, userId, projectId, buffer, mimeType, lovableApiKey } = params;

  try {
    await supabaseAdmin
      .from("uploaded_documents")
      .update({ status: "processing" })
      .eq("id", documentId);

    const text = await extractText(buffer, mimeType);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      await supabaseAdmin
        .from("uploaded_documents")
        .update({ status: "error", error_message: "No text extracted from file" })
        .eq("id", documentId);
      return;
    }

    let embeddings: number[][];
    try {
      embeddings = await embedChunks(chunks.map((c) => c.content), lovableApiKey);
    } catch (embErr) {
      // Embedding failed (gateway may not support it) — store chunks without vectors
      console.warn("[ingest] embedding failed, storing chunks without vectors:", embErr);
      embeddings = chunks.map(() => []);
    }

    const rows = chunks.map((chunk, i) => ({
      document_id: documentId,
      user_id: userId,
      project_id: projectId,
      chunk_index: chunk.index,
      content: chunk.content,
      embedding: embeddings[i]?.length ? JSON.stringify(embeddings[i]) : null,
      token_count: chunk.tokenEstimate,
    }));

    const { error: insertErr } = await supabaseAdmin
      .from("document_chunks")
      .insert(rows);

    if (insertErr) throw insertErr;

    await supabaseAdmin
      .from("uploaded_documents")
      .update({ status: "ready" })
      .eq("id", documentId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ingest] failed:", msg);
    await supabaseAdmin
      .from("uploaded_documents")
      .update({ status: "error", error_message: msg.slice(0, 500) })
      .eq("id", documentId);
    throw err;
  }
}
