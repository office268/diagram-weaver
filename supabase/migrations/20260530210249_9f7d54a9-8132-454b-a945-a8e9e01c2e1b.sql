-- ============================================================
-- supabase/migrations/20260530210249_9f7d54a9-8132-454b-a945-a8e9e01c2e1b.sql
-- Migration — 20260530210249_9f7d54a9-8132-454b-a945-a8e9e01c2e1b.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.app_metadata ADD COLUMN IF NOT EXISTS apple_touch_icon_url text NOT NULL DEFAULT '';