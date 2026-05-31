ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS business_knowledge text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS business_knowledge text NOT NULL DEFAULT '';