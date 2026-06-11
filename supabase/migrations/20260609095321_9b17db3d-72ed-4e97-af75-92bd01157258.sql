-- ============================================================
-- supabase/migrations/20260609095321_9b17db3d-72ed-4e97-af75-92bd01157258.sql
-- Migration — 20260609095321_9b17db3d-72ed-4e97-af75-92bd01157258.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;