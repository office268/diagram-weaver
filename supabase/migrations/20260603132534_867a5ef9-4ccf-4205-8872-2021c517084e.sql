
-- ============================================================
-- supabase/migrations/20260603132534_867a5ef9-4ccf-4205-8872-2021c517084e.sql
-- Migration — 20260603132534_867a5ef9-4ccf-4205-8872-2021c517084e.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
-- Products table: groups projects under an organization
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view org products"
  ON public.products FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'owner'::org_role)
          OR public.has_org_role(auth.uid(), org_id, 'admin'::org_role));

CREATE POLICY "Org admins update products"
  ON public.products FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'owner'::org_role)
      OR public.has_org_role(auth.uid(), org_id, 'admin'::org_role));

CREATE POLICY "Org admins delete products"
  ON public.products FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'owner'::org_role)
      OR public.has_org_role(auth.uid(), org_id, 'admin'::org_role));

CREATE INDEX idx_products_org_id ON public.products(org_id);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link projects to products (optional)
ALTER TABLE public.projects
  ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX idx_projects_product_id ON public.projects(product_id);
