-- ============================================================
-- supabase/migrations/20260531073244_9f547381-321f-4dea-87d8-3b6fa7e2a1a3.sql
-- Migration — 20260531073244_9f547381-321f-4dea-87d8-3b6fa7e2a1a3.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.spec_documents
  ADD COLUMN IF NOT EXISTS section_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS section_titles jsonb NOT NULL DEFAULT '{}'::jsonb;