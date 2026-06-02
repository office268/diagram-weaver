-- Enable pgvector extension for embedding storage
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Table: uploaded_documents
-- Tracks files uploaded by users for RAG context
CREATE TABLE public.uploaded_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name     text NOT NULL,
  file_size     integer NOT NULL DEFAULT 0,
  mime_type     text NOT NULL,
  storage_path  text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_uploaded_documents_project ON public.uploaded_documents(project_id);
CREATE INDEX idx_uploaded_documents_user    ON public.uploaded_documents(user_id);
CREATE INDEX idx_uploaded_documents_status  ON public.uploaded_documents(status);

ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own documents"
  ON public.uploaded_documents
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploaded_documents TO authenticated;
GRANT ALL ON public.uploaded_documents TO service_role;
