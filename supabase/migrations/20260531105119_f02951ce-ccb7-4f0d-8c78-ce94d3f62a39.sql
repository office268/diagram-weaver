-- ============================================================
-- supabase/migrations/20260531105119_f02951ce-ccb7-4f0d-8c78-ce94d3f62a39.sql
-- Migration — 20260531105119_f02951ce-ccb7-4f0d-8c78-ce94d3f62a39.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS pinned_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS projects_user_pinned_idx ON public.projects (user_id, pinned_at DESC NULLS LAST, updated_at DESC);