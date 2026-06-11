
-- ============================================================
-- supabase/migrations/20260531142506_5e46e6b1-816d-4274-98cf-54ff0eca7771.sql
-- Migration — 20260531142506_5e46e6b1-816d-4274-98cf-54ff0eca7771.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
REVOKE ALL ON FUNCTION public.consume_credit(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_credits(uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credit(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, text, text) TO service_role;
