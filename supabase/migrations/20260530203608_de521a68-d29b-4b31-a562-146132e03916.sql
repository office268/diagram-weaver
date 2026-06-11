-- ============================================================
-- supabase/migrations/20260530203608_de521a68-d29b-4b31-a562-146132e03916.sql
-- Migration — 20260530203608_de521a68-d29b-4b31-a562-146132e03916.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.spec_documents ADD COLUMN IF NOT EXISTS user_notes text NOT NULL DEFAULT '';