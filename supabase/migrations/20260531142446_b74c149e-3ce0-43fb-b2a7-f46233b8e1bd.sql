
-- ============================================================
-- supabase/migrations/20260531142446_b74c149e-3ce0-43fb-b2a7-f46233b8e1bd.sql
-- Migration — 20260531142446_b74c149e-3ce0-43fb-b2a7-f46233b8e1bd.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
-- Subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paddle_subscription_id text NOT NULL UNIQUE,
  paddle_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_paddle_id ON public.subscriptions(paddle_subscription_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role manages subscriptions" ON public.subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Credits balance
CREATE TABLE public.credits (
  user_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credits_balance_nonneg CHECK (balance >= 0)
);

GRANT SELECT ON public.credits TO authenticated;
GRANT ALL ON public.credits TO service_role;

ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own credits" ON public.credits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role manages credits" ON public.credits
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER trg_credits_updated_at
  BEFORE UPDATE ON public.credits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Credit transactions (audit log)
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('subscription_grant', 'purchase', 'consumption', 'adjustment')),
  description text,
  spec_document_id uuid,
  paddle_event_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_tx_user ON public.credit_transactions(user_id, created_at DESC);

GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own credit tx" ON public.credit_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role manages credit tx" ON public.credit_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- Atomic consume credit. Returns new balance or NULL if insufficient.
CREATE OR REPLACE FUNCTION public.consume_credit(_user_id uuid, _doc_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  INSERT INTO public.credits(user_id, balance) VALUES (_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.credits
    SET balance = balance - 1
    WHERE user_id = _user_id AND balance >= 1
    RETURNING balance INTO new_balance;

  IF new_balance IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.credit_transactions(user_id, amount, kind, description, spec_document_id)
    VALUES (_user_id, -1, 'consumption', 'יצירת מסמך אפיון', _doc_id);

  RETURN new_balance;
END;
$$;

-- Grant credits (used by webhook). Idempotent via paddle_event_id.
CREATE OR REPLACE FUNCTION public.grant_credits(
  _user_id uuid,
  _amount integer,
  _kind text,
  _description text,
  _paddle_event_id text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  -- Idempotency: skip if event already recorded
  IF _paddle_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.credit_transactions WHERE paddle_event_id = _paddle_event_id
  ) THEN
    SELECT balance INTO new_balance FROM public.credits WHERE user_id = _user_id;
    RETURN new_balance;
  END IF;

  INSERT INTO public.credits(user_id, balance) VALUES (_user_id, _amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.credits.balance + _amount
    RETURNING balance INTO new_balance;

  INSERT INTO public.credit_transactions(user_id, amount, kind, description, paddle_event_id)
    VALUES (_user_id, _amount, _kind, _description, _paddle_event_id);

  RETURN new_balance;
END;
$$;
