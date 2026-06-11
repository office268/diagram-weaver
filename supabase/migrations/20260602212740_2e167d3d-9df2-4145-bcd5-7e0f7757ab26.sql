-- ============================================================
-- supabase/migrations/20260602212740_2e167d3d-9df2-4145-bcd5-7e0f7757ab26.sql
-- Migration — 20260602212740_2e167d3d-9df2-4145-bcd5-7e0f7757ab26.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.ai_usage_events
  ADD COLUMN doc_title text,
  ADD COLUMN doc_type text,
  ADD COLUMN word_count integer NOT NULL DEFAULT 0;