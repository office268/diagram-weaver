ALTER TABLE public.uploaded_documents
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS storage_path  text;

ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS token_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.document_chunks
  ALTER COLUMN embedding DROP NOT NULL;

DROP FUNCTION IF EXISTS public.match_document_chunks(uuid, uuid, vector, integer);

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding   vector,
  match_project_id  uuid,
  match_user_id     uuid,
  match_count       integer DEFAULT 5,
  min_similarity    float   DEFAULT 0.5
)
RETURNS TABLE (
  id          uuid,
  content     text,
  similarity  float,
  document_id uuid,
  chunk_index integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT dc.id,
         dc.content,
         (1 - (dc.embedding <=> query_embedding))::float AS similarity,
         dc.document_id,
         dc.chunk_index
  FROM public.document_chunks dc
  WHERE dc.project_id = match_project_id
    AND dc.user_id    = match_user_id
    AND dc.embedding  IS NOT NULL
    AND (1 - (dc.embedding <=> query_embedding)) > min_similarity
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, uuid, uuid, integer, float)
  TO authenticated, service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-documents', 'project-documents', false, 10485760)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "Users read own project-documents" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own project-documents" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own project-documents" ON storage.objects;

CREATE POLICY "Users read own project-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own project-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own project-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
