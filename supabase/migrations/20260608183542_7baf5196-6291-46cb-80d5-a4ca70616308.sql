
-- ============================================================
-- supabase/migrations/20260608183542_7baf5196-6291-46cb-80d5-a4ca70616308.sql
-- Migration — 20260608183542_7baf5196-6291-46cb-80d5-a4ca70616308.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.ai_usage_events ALTER COLUMN spec_document_id DROP NOT NULL;
ALTER TABLE public.ai_usage_events ADD COLUMN IF NOT EXISTS diagram_id uuid NULL;
ALTER TABLE public.ai_usage_events ADD COLUMN IF NOT EXISTS artifact_kind text NOT NULL DEFAULT 'spec_document';
ALTER TABLE public.ai_usage_events DROP CONSTRAINT IF EXISTS ai_usage_events_artifact_chk;
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_artifact_chk CHECK (
  (artifact_kind = 'spec_document' AND spec_document_id IS NOT NULL AND diagram_id IS NULL)
  OR (artifact_kind <> 'spec_document' AND diagram_id IS NOT NULL AND spec_document_id IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_diagram ON public.ai_usage_events(diagram_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_artifact_kind ON public.ai_usage_events(artifact_kind);
