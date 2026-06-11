-- ============================================================
-- supabase/migrations/20260531072201_8e9ff8f2-6265-46df-ba45-2ac716dbff90.sql
-- Migration — 20260531072201_8e9ff8f2-6265-46df-ba45-2ac716dbff90.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.spec_documents ADD COLUMN IF NOT EXISTS user_prompt text NOT NULL DEFAULT '';