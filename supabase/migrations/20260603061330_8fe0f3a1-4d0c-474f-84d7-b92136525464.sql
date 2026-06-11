-- ============================================================
-- supabase/migrations/20260603061330_8fe0f3a1-4d0c-474f-84d7-b92136525464.sql
-- Migration — 20260603061330_8fe0f3a1-4d0c-474f-84d7-b92136525464.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url text;

DROP POLICY IF EXISTS "Org admins can update their org" ON public.organizations;
CREATE POLICY "Org admins can update their org"
ON public.organizations
FOR UPDATE
TO authenticated
USING (public.has_org_role(auth.uid(), id, 'owner') OR public.has_org_role(auth.uid(), id, 'admin'))
WITH CHECK (public.has_org_role(auth.uid(), id, 'owner') OR public.has_org_role(auth.uid(), id, 'admin'));