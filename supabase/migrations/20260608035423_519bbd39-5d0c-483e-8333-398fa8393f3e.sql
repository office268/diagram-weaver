-- ============================================================
-- supabase/migrations/20260608035423_519bbd39-5d0c-483e-8333-398fa8393f3e.sql
-- Migration — 20260608035423_519bbd39-5d0c-483e-8333-398fa8393f3e.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.dashboard_tile_order
  ADD COLUMN IF NOT EXISTS moved_to_extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS moved_to_main jsonb NOT NULL DEFAULT '[]'::jsonb;