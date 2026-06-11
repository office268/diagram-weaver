-- ============================================================
-- supabase/migrations/20260609000545_e8f50157-bc3e-42d5-8200-2cd30aa7290d.sql
-- Migration — 20260609000545_e8f50157-bc3e-42d5-8200-2cd30aa7290d.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
UPDATE public.chat_threads SET model_override = NULL WHERE model_override IN ('openai/gpt-5.5-pro','openai/gpt-5.4-pro');