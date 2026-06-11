
-- ============================================================
-- supabase/migrations/20260601210718_4c2baca9-4a2a-4e22-9e21-7b3feff2cc49.sql
-- Migration — 20260601210718_4c2baca9-4a2a-4e22-9e21-7b3feff2cc49.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
-- 1) pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) uploaded_documents
CREATE TABLE public.uploaded_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  project_id  uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  file_size   integer NOT NULL DEFAULT 0,
  mime_type   text NOT NULL,
  char_count  integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'ready',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX uploaded_documents_user_idx ON public.uploaded_documents(user_id);
CREATE INDEX uploaded_documents_project_idx ON public.uploaded_documents(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploaded_documents TO authenticated;
GRANT ALL ON public.uploaded_documents TO service_role;

ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own uploaded_documents"
  ON public.uploaded_documents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own uploaded_documents"
  ON public.uploaded_documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own uploaded_documents"
  ON public.uploaded_documents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own uploaded_documents"
  ON public.uploaded_documents FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER uploaded_documents_set_updated_at
  BEFORE UPDATE ON public.uploaded_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) document_chunks (embeddings)
-- text-embedding-3-small => 1536 dims (HNSW supports up to 2000)
CREATE TABLE public.document_chunks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES public.uploaded_documents(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  project_id   uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  chunk_index  integer NOT NULL,
  content      text NOT NULL,
  embedding    vector(1536) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX document_chunks_doc_idx ON public.document_chunks(document_id);
CREATE INDEX document_chunks_user_idx ON public.document_chunks(user_id);
CREATE INDEX document_chunks_project_idx ON public.document_chunks(project_id);
CREATE INDEX document_chunks_embedding_idx
  ON public.document_chunks USING hnsw (embedding vector_cosine_ops);

GRANT SELECT, INSERT, DELETE ON public.document_chunks TO authenticated;
GRANT ALL ON public.document_chunks TO service_role;

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own document_chunks"
  ON public.document_chunks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own document_chunks"
  ON public.document_chunks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own document_chunks"
  ON public.document_chunks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4) match RPC — cosine similarity, scoped to user and optional project
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  _user_id      uuid,
  _project_id   uuid,
  _query        vector(1536),
  _match_count  integer DEFAULT 6
)
RETURNS TABLE (
  id          uuid,
  document_id uuid,
  content     text,
  similarity  float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> _query) AS similarity
  FROM public.document_chunks c
  WHERE c.user_id = _user_id
    AND (_project_id IS NULL OR c.project_id = _project_id OR c.project_id IS NULL)
  ORDER BY c.embedding <=> _query
  LIMIT GREATEST(_match_count, 1);
$$;

-- 5) consume_credits — atomic N-credit deduction
CREATE OR REPLACE FUNCTION public.consume_credits(
  _user_id uuid,
  _amount  integer,
  _doc_id  uuid DEFAULT NULL,
  _description text DEFAULT 'יצירת מסמך אפיון (multi-agent)'
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  INSERT INTO public.credits(user_id, balance) VALUES (_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.credits
    SET balance = balance - _amount
    WHERE user_id = _user_id AND balance >= _amount
    RETURNING balance INTO new_balance;

  IF new_balance IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.credit_transactions(user_id, amount, kind, description, spec_document_id)
    VALUES (_user_id, -_amount, 'consumption', _description, _doc_id);

  RETURN new_balance;
END;
$$;
