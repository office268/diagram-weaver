-- ============================================================
-- supabase/migrations/20260531074333_b9c80746-a8e0-4016-82f2-306a7d4937da.sql
-- Migration — 20260531074333_b9c80746-a8e0-4016-82f2-306a7d4937da.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.spec_documents
  ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'spec_overview';