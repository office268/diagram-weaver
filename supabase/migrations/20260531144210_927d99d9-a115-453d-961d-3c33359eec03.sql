-- ============================================================
-- supabase/migrations/20260531144210_927d99d9-a115-453d-961d-3c33359eec03.sql
-- Migration — 20260531144210_927d99d9-a115-453d-961d-3c33359eec03.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
-- Allow 'signup_bonus' kind
ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_kind_check;
ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_kind_check
  CHECK (kind IN ('purchase', 'subscription_grant', 'consumption', 'signup_bonus', 'manual'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.credits(user_id, balance) VALUES (NEW.id, 30)
    ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_transactions(user_id, amount, kind, description, paddle_event_id)
    VALUES (NEW.id, 30, 'signup_bonus', 'בונוס הרשמה — 30 קרדיטים חינם', 'signup_' || NEW.id::text)
    ON CONFLICT (paddle_event_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill
INSERT INTO public.credits(user_id, balance)
SELECT u.id, 30
FROM auth.users u
LEFT JOIN public.credits c ON c.user_id = u.id
WHERE c.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.credit_transactions(user_id, amount, kind, description, paddle_event_id)
SELECT u.id, 30, 'signup_bonus', 'בונוס הרשמה (השלמה רטרואקטיבית)', 'backfill_signup_' || u.id::text
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.credit_transactions t
  WHERE t.user_id = u.id AND t.kind = 'signup_bonus'
);