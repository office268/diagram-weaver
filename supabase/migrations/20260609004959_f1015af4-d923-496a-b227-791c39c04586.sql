
-- Split diagram_jobs pipeline: add per-stage tracking columns
ALTER TABLE public.diagram_jobs
  ADD COLUMN IF NOT EXISTS stage TEXT,
  ADD COLUMN IF NOT EXISTS process_map_json JSONB,
  ADD COLUMN IF NOT EXISTS current_svg TEXT,
  ADD COLUMN IF NOT EXISTS current_violations JSONB,
  ADD COLUMN IF NOT EXISTS iteration INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_message_id UUID;

-- Allow worker to keep attempting across many steps (no per-step counter limit)
ALTER TABLE public.diagram_jobs
  ALTER COLUMN max_attempts SET DEFAULT 20;

CREATE INDEX IF NOT EXISTS idx_diagram_jobs_next_run
  ON public.diagram_jobs (next_run_at)
  WHERE status = 'processing' AND next_run_at IS NOT NULL;

-- Updated claim: also pick up processing jobs that scheduled themselves for another step.
CREATE OR REPLACE FUNCTION public.claim_diagram_job()
RETURNS public.diagram_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  claimed public.diagram_jobs;
BEGIN
  SELECT * INTO claimed
  FROM public.diagram_jobs
  WHERE attempts < max_attempts
    AND (
      status = 'pending'
      OR (status = 'processing' AND next_run_at IS NOT NULL AND next_run_at <= now())
    )
  ORDER BY COALESCE(next_run_at, created_at) ASC
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
      next_run_at = NULL,
      updated_at = now()
  WHERE id = claimed.id
  RETURNING * INTO claimed;

  RETURN claimed;
END;
$function$;

-- Stuck reset: only consider jobs that have NOT scheduled themselves for a future step.
CREATE OR REPLACE FUNCTION public.reset_stuck_diagram_jobs(_stale_minutes integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  affected integer;
  rec record;
  human_msg text;
BEGIN
  affected := 0;

  FOR rec IN
    SELECT id, thread_id, user_id, kind, current_svg, current_message_id
    FROM public.diagram_jobs
    WHERE status = 'processing'
      AND locked_at IS NOT NULL
      AND locked_at < now() - make_interval(mins => _stale_minutes)
      AND (next_run_at IS NULL OR next_run_at < now() - make_interval(mins => _stale_minutes))
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.diagram_jobs
      SET status = 'failed',
          error_message = COALESCE(error_message, 'stuck timeout'),
          completed_at = now(),
          updated_at = now()
    WHERE id = rec.id;

    -- If we have a partial SVG already shown to the user, leave it visible; don't post a new error message.
    IF rec.current_svg IS NULL THEN
      human_msg :=
        'יצירת התרשים לא הושלמה בזמן הקצוב ונעצרה. אפשר לנסות שוב — רצוי לקצר את התיאור או לבחור מודל מהיר יותר בהגדרות הצ׳אט.';
      BEGIN
        INSERT INTO public.chat_messages (thread_id, user_id, role, content)
        VALUES (rec.thread_id, rec.user_id, 'assistant', human_msg);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    ELSIF rec.current_message_id IS NOT NULL THEN
      -- Strip "still improving" footer from the existing message so user sees a stable diagram.
      UPDATE public.chat_messages
        SET content = regexp_replace(content, E'\\n\\n_⏳ .+?_$', '')
        WHERE id = rec.current_message_id;
    END IF;

    affected := affected + 1;
  END LOOP;

  RETURN affected;
END;
$function$;
