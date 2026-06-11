// ============================================================
// src/lib/rag/chunker.server.ts
// מודול server-only — chunker.server.ts
// מורץ רק בצד השרת (TanStack Start)
// ============================================================
export interface TextChunk {
  index: number;
  content: string;
  tokenEstimate: number;
}

// ~1 token ≈ 4 chars; chunk = 500 tokens ≈ 2000 chars, overlap = 50 tokens ≈ 200 chars
const CHUNK_SIZE = 2000;
const OVERLAP = 200;

export function chunkText(text: string): TextChunk[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: TextChunk[] = [];
  let current = "";
  let index = 0;

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed.length > 0) {
      chunks.push({
        index: index++,
        content: trimmed,
        tokenEstimate: Math.ceil(trimmed.length / 4),
      });
    }
  };

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > CHUNK_SIZE && current.length > 0) {
      flush();
      // Keep overlap: take the tail of the current chunk
      current = current.slice(-OVERLAP) + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  flush();

  return chunks;
}
