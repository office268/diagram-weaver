-- Table: document_chunks
-- Stores chunked text + embeddings for vector similarity search
CREATE TABLE public.document_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES public.uploaded_documents(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  chunk_index   integer NOT NULL DEFAULT 0,
  content       text NOT NULL,
  embedding     extensions.vector(1536),
  token_count   integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chunks_document  ON public.document_chunks(document_id);
CREATE INDEX idx_chunks_project   ON public.document_chunks(project_id);
CREATE INDEX idx_chunks_user      ON public.document_chunks(user_id);

-- IVFFlat index for approximate nearest neighbor search
CREATE INDEX idx_chunks_embedding ON public.document_chunks
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own chunks"
  ON public.document_chunks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;

-- RPC: cosine similarity search over document chunks
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding   extensions.vector(1536),
  match_project_id  uuid,
  match_user_id     uuid,
  match_count       integer DEFAULT 5,
  min_similarity    float   DEFAULT 0.5
)
RETURNS TABLE (
  id            uuid,
  content       text,
  similarity    float,
  document_id   uuid,
  chunk_index   integer
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    (1 - (dc.embedding <=> query_embedding))::float AS similarity,
    dc.document_id,
    dc.chunk_index
  FROM public.document_chunks dc
  WHERE dc.project_id  = match_project_id
    AND dc.user_id     = match_user_id
    AND dc.embedding   IS NOT NULL
    AND (1 - (dc.embedding <=> query_embedding)) > min_similarity
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_document_chunks TO authenticated, service_role;
