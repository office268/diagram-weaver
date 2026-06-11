
-- ============================================================
-- supabase/migrations/20260608222808_c3f87461-d89b-40a1-b5bd-ed1ba052cd1a.sql
-- Migration — 20260608222808_c3f87461-d89b-40a1-b5bd-ed1ba052cd1a.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.diagram_jobs
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_diagram_jobs_status_created
  ON public.diagram_jobs (status, created_at)
  WHERE status IN ('pending', 'processing');

CREATE OR REPLACE FUNCTION public.claim_diagram_job()
RETURNS public.diagram_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed public.diagram_jobs;
BEGIN
  SELECT * INTO claimed
  FROM public.diagram_jobs
  WHERE status = 'pending'
    AND attempts < max_attempts
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.diagram_jobs
  SET status = 'processing',
      started_at = COALESCE(started_at, now()),
      locked_at = now(),
      attempts = attempts + 1,
      updated_at = now()
  WHERE id = claimed.id
  RETURNING * INTO claimed;

  RETURN claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_stuck_diagram_jobs(_stale_minutes integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH updated AS (
    UPDATE public.diagram_jobs
    SET status = 'failed',
        error_message = COALESCE(error_message, 'stuck timeout'),
        completed_at = now(),
        updated_at = now()
    WHERE status = 'processing'
      AND locked_at IS NOT NULL
      AND locked_at < now() - make_interval(mins => _stale_minutes)
    RETURNING 1
  )
  SELECT count(*) INTO affected FROM updated;
  RETURN COALESCE(affected, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_diagram_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_diagram_job() TO service_role;

REVOKE ALL ON FUNCTION public.reset_stuck_diagram_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_stuck_diagram_jobs(integer) TO service_role;
