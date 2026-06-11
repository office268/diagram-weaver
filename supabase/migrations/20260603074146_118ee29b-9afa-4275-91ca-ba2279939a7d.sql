-- ============================================================
-- supabase/migrations/20260603074146_118ee29b-9afa-4275-91ca-ba2279939a7d.sql
-- Migration — 20260603074146_118ee29b-9afa-4275-91ca-ba2279939a7d.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
CREATE TYPE public.org_kind AS ENUM ('public', 'nonprofit', 'government', 'private');

ALTER TABLE public.organizations
  ADD COLUMN address text,
  ADD COLUMN website text,
  ADD COLUMN org_kind public.org_kind,
  ADD COLUMN identifier text;