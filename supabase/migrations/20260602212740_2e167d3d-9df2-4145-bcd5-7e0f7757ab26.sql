ALTER TABLE public.ai_usage_events
  ADD COLUMN doc_title text,
  ADD COLUMN doc_type text,
  ADD COLUMN word_count integer NOT NULL DEFAULT 0;