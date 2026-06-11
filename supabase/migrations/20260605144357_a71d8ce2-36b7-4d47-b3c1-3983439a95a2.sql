-- ============================================================
-- supabase/migrations/20260605144357_a71d8ce2-36b7-4d47-b3c1-3983439a95a2.sql
-- Migration — 20260605144357_a71d8ce2-36b7-4d47-b3c1-3983439a95a2.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
CREATE TABLE public.dashboard_tile_order (
  id text NOT NULL PRIMARY KEY DEFAULT 'singleton',
  "order" jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.dashboard_tile_order TO authenticated;
GRANT ALL ON public.dashboard_tile_order TO service_role;

ALTER TABLE public.dashboard_tile_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read tile order"
  ON public.dashboard_tile_order FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "admins insert tile order"
  ON public.dashboard_tile_order FOR INSERT
  TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update tile order"
  ON public.dashboard_tile_order FOR UPDATE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
