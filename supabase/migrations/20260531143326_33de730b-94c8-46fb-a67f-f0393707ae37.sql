-- ============================================================
-- supabase/migrations/20260531143326_33de730b-94c8-46fb-a67f-f0393707ae37.sql
-- Migration — 20260531143326_33de730b-94c8-46fb-a67f-f0393707ae37.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.credits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;