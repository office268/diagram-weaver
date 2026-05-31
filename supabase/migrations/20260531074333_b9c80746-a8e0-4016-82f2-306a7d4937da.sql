ALTER TABLE public.spec_documents
  ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'spec_overview';