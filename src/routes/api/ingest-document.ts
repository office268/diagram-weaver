// ============================================================
// src/routes/api/ingest-document.ts
// HTTP endpoint (server route) — ingest-document.ts
// נקודת קצה ציבורית/פנימית עבור TanStack Start
// ============================================================
// Ingest a document for RAG. The CLIENT extracts text from PDF/DOCX/TXT
// and sends plain text here (Workers don't run pdf-parse/mammoth/canvas).

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BodySchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  fileSize: z.number().int().min(0).max(50 * 1024 * 1024),
  text: z.string().min(1).max(2_000_000),
  projectId: z.string().uuid().optional(),
});

const EMBED_MODEL = "openai/text-embedding-3-small";
const CHUNK_SIZE = 1200; // chars (~300 tokens)
const CHUNK_OVERLAP = 200;
const EMBED_BATCH = 32;

function chunkText(input: string): string[] {
  const clean = input.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length > CHUNK_SIZE && buf) {
      chunks.push(buf.trim());
      // overlap: keep tail
      const tail = buf.slice(Math.max(0, buf.length - CHUNK_OVERLAP));
      buf = tail + "\n\n" + p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());

  // Hard-split overlong chunks
  const out: string[] = [];
  for (const c of chunks) {
    if (c.length <= CHUNK_SIZE * 1.5) {
      out.push(c);
    } else {
      for (let i = 0; i < c.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        out.push(c.slice(i, i + CHUNK_SIZE));
      }
    }
  }
  return out;
}

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`embeddings ${res.status}: ${t || "failed"}`);
  }
  const json = (await res.json()) as {
    data?: Array<{ embedding: number[] }>;
  };
  const arr = json.data ?? [];
  if (arr.length !== texts.length) {
    throw new Error(`embedding count mismatch: got ${arr.length}, want ${texts.length}`);
  }
  return arr.map((d) => d.embedding);
}

export const Route = createFileRoute("/api/ingest-document")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7).trim()
          : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { data: userData, error: userErr } =
          await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = userData.user.id;

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch (e) {
          return new Response(
            e instanceof Error ? e.message : "Bad request",
            { status: 400 },
          );
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response("LOVABLE_API_KEY missing", { status: 500 });
        }

        // 1) Insert document row
        const { data: doc, error: docErr } = await supabaseAdmin
          .from("uploaded_documents")
          .insert({
            user_id: userId,
            project_id: body.projectId ?? null,
            file_name: body.fileName,
            file_size: body.fileSize,
            mime_type: body.mimeType,
            char_count: body.text.length,
            status: "embedding",
          } as never)
          .select()
          .single();
        if (docErr || !doc) {
          console.error("[ingest-document] insert doc:", docErr);
          return new Response("Storage error", { status: 500 });
        }
        const docId = (doc as { id: string }).id;

        // 2) Chunk + embed
        const chunks = chunkText(body.text);
        if (!chunks.length) {
          await supabaseAdmin
            .from("uploaded_documents")
            .update({ status: "ready", chunk_count: 0 } as never)
            .eq("id", docId);
          return Response.json({
            documentId: docId,
            chunkCount: 0,
            charCount: body.text.length,
          });
        }

        try {
          for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
            const batch = chunks.slice(i, i + EMBED_BATCH);
            const vectors = await embedBatch(batch, apiKey);
            const rows = batch.map((content, j) => ({
              document_id: docId,
              user_id: userId,
              project_id: body.projectId ?? null,
              chunk_index: i + j,
              content,
              embedding: vectors[j] as unknown as string, // pgvector accepts array
            }));
            const { error: insErr } = await supabaseAdmin
              .from("document_chunks")
              .insert(rows as never);
            if (insErr) throw new Error(insErr.message);
          }
          await supabaseAdmin
            .from("uploaded_documents")
            .update({ status: "ready", chunk_count: chunks.length } as never)
            .eq("id", docId);

          return Response.json({
            documentId: docId,
            chunkCount: chunks.length,
            charCount: body.text.length,
          });
        } catch (e) {
          console.error("[ingest-document] embed error:", e);
          await supabaseAdmin
            .from("uploaded_documents")
            .update({ status: "failed" } as never)
            .eq("id", docId);
          // Best-effort cleanup of partial chunks
          await supabaseAdmin
            .from("document_chunks")
            .delete()
            .eq("document_id", docId);
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(`Embedding failed: ${msg}`, { status: 502 });
        }
      },
    },
  },
});
