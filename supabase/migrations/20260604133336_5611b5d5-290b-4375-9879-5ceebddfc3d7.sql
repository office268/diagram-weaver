
-- ============================================================
-- supabase/migrations/20260604133336_5611b5d5-290b-4375-9879-5ceebddfc3d7.sql
-- Migration — 20260604133336_5611b5d5-290b-4375-9879-5ceebddfc3d7.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
-- agent_personas
CREATE TABLE public.agent_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  role_title text NOT NULL DEFAULT '',
  role_description text NOT NULL DEFAULT '',
  knowledge text NOT NULL DEFAULT '',
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  color text NOT NULL DEFAULT '#6366f1',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_personas TO authenticated;
GRANT ALL ON public.agent_personas TO service_role;
ALTER TABLE public.agent_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage personas" ON public.agent_personas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- agent_conversations
CREATE TABLE public.agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'שיחה חדשה',
  topic text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_conversations TO authenticated;
GRANT ALL ON public.agent_conversations TO service_role;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage conversations" ON public.agent_conversations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- agent_conversation_participants
CREATE TABLE public.agent_conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  persona_id uuid NOT NULL REFERENCES public.agent_personas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, persona_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_conversation_participants TO authenticated;
GRANT ALL ON public.agent_conversation_participants TO service_role;
ALTER TABLE public.agent_conversation_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage participants" ON public.agent_conversation_participants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- agent_messages
CREATE TABLE public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  persona_id uuid REFERENCES public.agent_personas(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'agent',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_messages TO authenticated;
GRANT ALL ON public.agent_messages TO service_role;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage messages" ON public.agent_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER agent_personas_updated_at BEFORE UPDATE ON public.agent_personas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agent_conversations_updated_at BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX agent_messages_conv_idx ON public.agent_messages(conversation_id, created_at);
CREATE INDEX agent_personas_org_idx ON public.agent_personas(org_id);
