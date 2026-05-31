ALTER TABLE public.spec_documents
  ADD COLUMN IF NOT EXISTS section_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS section_titles jsonb NOT NULL DEFAULT '{}'::jsonb;