
-- ============================================================
-- supabase/migrations/20260603090603_0748e53f-c451-44fe-97f8-9b021389e6a6.sql
-- Migration — 20260603090603_0748e53f-c451-44fe-97f8-9b021389e6a6.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
-- Add approval status to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending';

-- Mark existing users as approved so they don't get locked out
UPDATE public.profiles SET approval_status = 'approved' WHERE approval_status = 'pending';

-- Create signup_requests table
CREATE TABLE IF NOT EXISTS public.signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  display_name text,
  provider text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.signup_requests TO authenticated;
GRANT ALL ON public.signup_requests TO service_role;

ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own signup request"
  ON public.signup_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update signup requests"
  ON public.signup_requests FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role inserts signup requests"
  ON public.signup_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Also allow admins to update profile approval status
CREATE POLICY "Admins update profile approval"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Update handle_new_user trigger to create pending signup request + pending profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, approval_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'pending'
  );

  INSERT INTO public.signup_requests (user_id, email, display_name, provider, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    'pending'
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credits(user_id, balance) VALUES (NEW.id, 30)
    ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_transactions(user_id, amount, kind, description, paddle_event_id)
    VALUES (NEW.id, 30, 'signup_bonus', 'בונוס הרשמה — 30 קרדיטים חינם', 'signup_' || NEW.id::text)
    ON CONFLICT (paddle_event_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
