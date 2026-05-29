ALTER TABLE public.spec_documents
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS variant text;

CREATE INDEX IF NOT EXISTS spec_documents_group_id_idx
  ON public.spec_documents (group_id);