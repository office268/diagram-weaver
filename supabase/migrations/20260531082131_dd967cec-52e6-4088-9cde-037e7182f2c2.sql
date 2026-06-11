-- ============================================================
-- supabase/migrations/20260531082131_dd967cec-52e6-4088-9cde-037e7182f2c2.sql
-- Migration — 20260531082131_dd967cec-52e6-4088-9cde-037e7182f2c2.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
CREATE TABLE public.doc_type_settings (
  user_id uuid NOT NULL,
  doc_type text NOT NULL,
  section_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  section_titles jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, doc_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doc_type_settings TO authenticated;
GRANT ALL ON public.doc_type_settings TO service_role;

ALTER TABLE public.doc_type_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own doc type settings"
  ON public.doc_type_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own doc type settings"
  ON public.doc_type_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own doc type settings"
  ON public.doc_type_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own doc type settings"
  ON public.doc_type_settings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER set_doc_type_settings_updated_at
  BEFORE UPDATE ON public.doc_type_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();