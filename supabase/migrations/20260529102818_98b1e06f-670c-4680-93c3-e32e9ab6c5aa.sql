-- ============================================================
-- supabase/migrations/20260529102818_98b1e06f-670c-4680-93c3-e32e9ab6c5aa.sql
-- Migration — 20260529102818_98b1e06f-670c-4680-93c3-e32e9ab6c5aa.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
CREATE TABLE public.ai_settings (
  user_id UUID NOT NULL PRIMARY KEY,
  system_instruction TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai settings" ON public.ai_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ai settings" ON public.ai_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ai settings" ON public.ai_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own ai settings" ON public.ai_settings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER ai_settings_set_updated_at
  BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();