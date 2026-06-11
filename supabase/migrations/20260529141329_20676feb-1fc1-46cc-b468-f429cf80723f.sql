-- ============================================================
-- supabase/migrations/20260529141329_20676feb-1fc1-46cc-b468-f429cf80723f.sql
-- Migration — 20260529141329_20676feb-1fc1-46cc-b468-f429cf80723f.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.spec_documents
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS variant text;

CREATE INDEX IF NOT EXISTS spec_documents_group_id_idx
  ON public.spec_documents (group_id);