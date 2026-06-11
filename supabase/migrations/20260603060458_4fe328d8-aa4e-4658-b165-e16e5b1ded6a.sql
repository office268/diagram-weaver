-- ============================================================
-- supabase/migrations/20260603060458_4fe328d8-aa4e-4658-b165-e16e5b1ded6a.sql
-- Migration — 20260603060458_4fe328d8-aa4e-4658-b165-e16e5b1ded6a.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
-- Organizations multi-tenant scaffolding
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(org_id);

-- Security definer helpers to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND org_id = _org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role public.org_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND org_id = _org_id AND role = _role
  )
$$;

-- RLS: organizations — members can view; owners/admins can update
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Owners/admins can update their organization"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), id, 'owner') OR public.has_org_role(auth.uid(), id, 'admin'));

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (true);

-- RLS: organization_members — users see their own memberships; owners/admins manage members
CREATE POLICY "Users view own memberships"
  ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_org_role(auth.uid(), org_id, 'owner') OR public.has_org_role(auth.uid(), org_id, 'admin'));

CREATE POLICY "Owners/admins insert members"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (
    -- allow self-insert for bootstrapping (first owner) or org admins adding others
    user_id = auth.uid()
    OR public.has_org_role(auth.uid(), org_id, 'owner')
    OR public.has_org_role(auth.uid(), org_id, 'admin')
  );

CREATE POLICY "Owners/admins update members"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'owner') OR public.has_org_role(auth.uid(), org_id, 'admin'));

CREATE POLICY "Owners/admins delete members"
  ON public.organization_members FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'owner') OR public.has_org_role(auth.uid(), org_id, 'admin'));

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Seed: City of David org; attach all existing users as members (current user becomes owner first to display "עיר דוד")
INSERT INTO public.organizations (name, slug)
VALUES ('עיר דוד', 'city-of-david')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.organization_members (org_id, user_id, role)
SELECT o.id, u.id, 'owner'::public.org_role
FROM public.organizations o
CROSS JOIN auth.users u
WHERE o.slug = 'city-of-david'
ON CONFLICT (org_id, user_id) DO NOTHING;