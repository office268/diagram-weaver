
-- ============================================================
-- supabase/migrations/20260608184636_07bd8b19-b2a7-4d86-9763-ebbd5e60f699.sql
-- Migration — 20260608184636_07bd8b19-b2a7-4d86-9763-ebbd5e60f699.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.ai_usage_events ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success';
ALTER TABLE public.ai_usage_events ADD COLUMN IF NOT EXISTS error_message text NULL;
ALTER TABLE public.ai_usage_events DROP CONSTRAINT IF EXISTS ai_usage_events_status_chk;
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_status_chk CHECK (status IN ('success','failed'));
ALTER TABLE public.ai_usage_events DROP CONSTRAINT IF EXISTS ai_usage_events_artifact_chk;
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_artifact_chk CHECK (
  (artifact_kind = 'spec_document' AND (
      (status = 'success' AND spec_document_id IS NOT NULL AND diagram_id IS NULL)
      OR (status = 'failed' AND diagram_id IS NULL)
  ))
  OR (artifact_kind <> 'spec_document' AND (
      (status = 'success' AND diagram_id IS NOT NULL AND spec_document_id IS NULL)
      OR (status = 'failed' AND spec_document_id IS NULL)
  ))
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_status ON public.ai_usage_events(status);
