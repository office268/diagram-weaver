
-- ============================================================
-- supabase/migrations/20260609090457_47ededb9-7eea-4024-beab-53dd2e0fd91a.sql
-- Migration — 20260609090457_47ededb9-7eea-4024-beab-53dd2e0fd91a.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_threads_user_project
  ON public.chat_threads(user_id, project_id);

CREATE OR REPLACE FUNCTION public.ensure_product_and_project(
  _org_id uuid,
  _product_name text,
  _project_name text
)
RETURNS TABLE(product_id uuid, project_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_product_id uuid;
  v_project_id uuid;
  v_pname text := COALESCE(NULLIF(btrim(_product_name), ''), 'Product-00001');
  v_prjname text := COALESCE(NULLIF(btrim(_project_name), ''), 'Project-00001');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _org_id IS NULL OR NOT public.is_org_member(v_uid, _org_id) THEN
    RAISE EXCEPTION 'not a member of organization';
  END IF;

  SELECT p.id INTO v_product_id
  FROM public.products p
  WHERE p.org_id = _org_id AND p.name = v_pname
  LIMIT 1;

  IF v_product_id IS NULL THEN
    INSERT INTO public.products(org_id, name, description, created_by)
    VALUES (_org_id, v_pname, '', v_uid)
    RETURNING id INTO v_product_id;
  END IF;

  SELECT pr.id INTO v_project_id
  FROM public.projects pr
  WHERE pr.product_id = v_product_id
    AND pr.user_id = v_uid
    AND pr.name = v_prjname
  LIMIT 1;

  IF v_project_id IS NULL THEN
    INSERT INTO public.projects(user_id, name, description, product_id)
    VALUES (v_uid, v_prjname, '', v_product_id)
    RETURNING id INTO v_project_id;
  END IF;

  RETURN QUERY SELECT v_product_id, v_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_product_and_project(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_product_and_project(uuid, text, text) TO authenticated;
