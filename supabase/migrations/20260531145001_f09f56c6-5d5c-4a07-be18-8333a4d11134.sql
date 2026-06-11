-- ============================================================
-- supabase/migrations/20260531145001_f09f56c6-5d5c-4a07-be18-8333a4d11134.sql
-- Migration — 20260531145001_f09f56c6-5d5c-4a07-be18-8333a4d11134.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS business_knowledge text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS business_knowledge text NOT NULL DEFAULT '';