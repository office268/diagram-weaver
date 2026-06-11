-- ============================================================
-- supabase/migrations/20260609073311_ffabbf3f-14e1-4ee4-b913-ac6713521ce7.sql
-- Migration — 20260609073311_ffabbf3f-14e1-4ee4-b913-ac6713521ce7.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.diagram_jobs ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false;