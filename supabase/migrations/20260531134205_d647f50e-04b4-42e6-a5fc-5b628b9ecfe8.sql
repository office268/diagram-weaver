-- ============================================================
-- supabase/migrations/20260531134205_d647f50e-04b4-42e6-a5fc-5b628b9ecfe8.sql
-- Migration — 20260531134205_d647f50e-04b4-42e6-a5fc-5b628b9ecfe8.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
CREATE TABLE public.doc_type_instructions (
  doc_type text PRIMARY KEY,
  system_instruction text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.doc_type_instructions TO authenticated;
GRANT ALL ON public.doc_type_instructions TO service_role;

ALTER TABLE public.doc_type_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_type_instructions read auth"
  ON public.doc_type_instructions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "doc_type_instructions admin insert"
  ON public.doc_type_instructions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "doc_type_instructions admin update"
  ON public.doc_type_instructions
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "doc_type_instructions admin delete"
  ON public.doc_type_instructions
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER doc_type_instructions_set_updated_at
  BEFORE UPDATE ON public.doc_type_instructions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();