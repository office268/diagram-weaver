
-- lab_sessions
CREATE TABLE public.lab_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'סשן חדש',
  latest_output_md text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_sessions TO authenticated;
GRANT ALL ON public.lab_sessions TO service_role;
ALTER TABLE public.lab_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_sessions own" ON public.lab_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER lab_sessions_updated_at BEFORE UPDATE ON public.lab_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- lab_documents
CREATE TABLE public.lab_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.lab_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text,
  file_size integer,
  storage_path text,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_documents TO authenticated;
GRANT ALL ON public.lab_documents TO service_role;
ALTER TABLE public.lab_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_documents own" ON public.lab_documents FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX lab_documents_session_idx ON public.lab_documents(session_id);

-- lab_messages
CREATE TABLE public.lab_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.lab_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_messages TO authenticated;
GRANT ALL ON public.lab_messages TO service_role;
ALTER TABLE public.lab_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_messages own" ON public.lab_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX lab_messages_session_idx ON public.lab_messages(session_id, created_at);

-- lab_questions
CREATE TABLE public.lab_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.lab_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_questions TO authenticated;
GRANT ALL ON public.lab_questions TO service_role;
ALTER TABLE public.lab_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_questions own" ON public.lab_questions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX lab_questions_session_idx ON public.lab_questions(session_id, created_at);
