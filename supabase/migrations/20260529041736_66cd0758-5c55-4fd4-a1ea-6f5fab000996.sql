
DROP TABLE IF EXISTS public.diagrams;

CREATE TABLE public.spec_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'מסמך אפיון חדש',
  prompt TEXT NOT NULL DEFAULT '',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spec_documents TO authenticated;
GRANT ALL ON public.spec_documents TO service_role;

ALTER TABLE public.spec_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spec docs" ON public.spec_documents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own spec docs" ON public.spec_documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own spec docs" ON public.spec_documents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own spec docs" ON public.spec_documents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_spec_documents
  BEFORE UPDATE ON public.spec_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
