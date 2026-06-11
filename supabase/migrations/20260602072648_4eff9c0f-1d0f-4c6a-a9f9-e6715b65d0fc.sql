
-- ============================================================
-- supabase/migrations/20260602072648_4eff9c0f-1d0f-4c6a-a9f9-e6715b65d0fc.sql
-- Migration — 20260602072648_4eff9c0f-1d0f-4c6a-a9f9-e6715b65d0fc.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
-- Chat threads (one per "document/diagram being created")
CREATE TABLE public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  output_type text NOT NULL,
  title text NOT NULL DEFAULT 'שיחה חדשה',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own threads" ON public.chat_threads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own threads" ON public.chat_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own threads" ON public.chat_threads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own threads" ON public.chat_threads FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_chat_threads_user ON public.chat_threads(user_id, updated_at DESC);

-- Chat messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL DEFAULT '',
  artifact_kind text,
  artifact_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own messages" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own messages" ON public.chat_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own messages" ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_chat_messages_thread ON public.chat_messages(thread_id, created_at ASC);

-- Diagrams (Mermaid)
CREATE TABLE public.diagrams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid REFERENCES public.chat_threads(id) ON DELETE SET NULL,
  kind text NOT NULL,
  title text NOT NULL DEFAULT 'תרשים',
  prompt text NOT NULL DEFAULT '',
  mermaid_code text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagrams TO authenticated;
GRANT ALL ON public.diagrams TO service_role;
ALTER TABLE public.diagrams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own diagrams" ON public.diagrams FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own diagrams" ON public.diagrams FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own diagrams" ON public.diagrams FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own diagrams" ON public.diagrams FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_diagrams_user ON public.diagrams(user_id, created_at DESC);

CREATE TRIGGER trg_chat_threads_updated BEFORE UPDATE ON public.chat_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_diagrams_updated BEFORE UPDATE ON public.diagrams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
