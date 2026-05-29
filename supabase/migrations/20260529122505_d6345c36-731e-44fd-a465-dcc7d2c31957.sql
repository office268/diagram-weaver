ALTER TABLE public.spec_documents
  ADD COLUMN review_score int,
  ADD COLUMN review_notes jsonb NOT NULL DEFAULT '[]'::jsonb;