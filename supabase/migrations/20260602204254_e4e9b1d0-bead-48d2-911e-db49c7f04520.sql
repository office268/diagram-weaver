CREATE TABLE public.ai_usage_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  spec_document_id uuid NOT NULL,
  model text NOT NULL,
  purpose text NOT NULL DEFAULT 'generate',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai usage"
ON public.ai_usage_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages ai usage"
ON public.ai_usage_events
FOR ALL
TO public
USING (auth.role() = 'service_role');

CREATE INDEX idx_ai_usage_events_doc ON public.ai_usage_events(spec_document_id);
CREATE INDEX idx_ai_usage_events_user ON public.ai_usage_events(user_id);