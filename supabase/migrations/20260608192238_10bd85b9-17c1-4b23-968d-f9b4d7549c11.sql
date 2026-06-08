CREATE TABLE public.diagram_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  diagram_id UUID REFERENCES public.diagrams(id) ON DELETE SET NULL,
  error_message TEXT,
  iterations INTEGER,
  model_override TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE ON public.diagram_jobs TO authenticated;
GRANT ALL ON public.diagram_jobs TO service_role;

ALTER TABLE public.diagram_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own diagram jobs"
  ON public.diagram_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diagram jobs"
  ON public.diagram_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_diagram_jobs_user_status ON public.diagram_jobs(user_id, status);
CREATE INDEX idx_diagram_jobs_thread ON public.diagram_jobs(thread_id);

CREATE TRIGGER diagram_jobs_set_updated_at
  BEFORE UPDATE ON public.diagram_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();