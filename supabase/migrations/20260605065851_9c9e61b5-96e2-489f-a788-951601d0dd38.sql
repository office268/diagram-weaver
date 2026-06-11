
-- ============================================================
-- supabase/migrations/20260605065851_9c9e61b5-96e2-489f-a788-951601d0dd38.sql
-- Migration — 20260605065851_9c9e61b5-96e2-489f-a788-951601d0dd38.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
CREATE TABLE public.ai_model_setting (
  id text PRIMARY KEY DEFAULT 'singleton',
  model text NOT NULL DEFAULT 'google/gemini-2.5-pro',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT ai_model_setting_singleton CHECK (id = 'singleton')
);

GRANT SELECT ON public.ai_model_setting TO authenticated;
GRANT ALL ON public.ai_model_setting TO service_role;

ALTER TABLE public.ai_model_setting ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read model setting"
  ON public.ai_model_setting FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admins insert model setting"
  ON public.ai_model_setting FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update model setting"
  ON public.ai_model_setting FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.ai_model_setting (id, model) VALUES ('singleton', 'google/gemini-2.5-pro')
  ON CONFLICT (id) DO NOTHING;
