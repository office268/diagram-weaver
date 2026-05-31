-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'פרויקט חדש',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own projects" ON public.projects
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own projects" ON public.projects
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own projects" ON public.projects
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add project_id to spec_documents
ALTER TABLE public.spec_documents
  ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE INDEX idx_spec_documents_project_doctype_group
  ON public.spec_documents(project_id, doc_type, group_id);

-- Data migration: for each user that has existing spec_documents without project_id,
-- create a default project and assign all their orphan documents to it.
DO $$
DECLARE
  u RECORD;
  new_proj UUID;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.spec_documents WHERE project_id IS NULL LOOP
    INSERT INTO public.projects(user_id, name, description)
    VALUES (u.user_id, 'המסמכים שלי', 'פרויקט ברירת מחדל עבור מסמכים קיימים')
    RETURNING id INTO new_proj;
    UPDATE public.spec_documents SET project_id = new_proj
      WHERE user_id = u.user_id AND project_id IS NULL;
  END LOOP;
END $$;
