-- ============================================================
-- supabase/migrations/20260608231434_ea2f9dda-fc8f-4e84-822c-0838fc6af718.sql
-- Migration — 20260608231434_ea2f9dda-fc8f-4e84-822c-0838fc6af718.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.chat_threads ADD COLUMN IF NOT EXISTS model_override TEXT NULL;