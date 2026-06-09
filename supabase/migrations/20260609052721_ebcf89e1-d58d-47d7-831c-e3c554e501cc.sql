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

    human_msg :=
      'יצירת התרשים לא הושלמה בזמן הקצוב ונעצרה. אפשר לנסות שוב — רצוי לקצר את התיאור או לבחור מודל מהיר יותר בהגדרות הצ׳אט.';

    IF rec.current_svg IS NULL AND rec.current_message_id IS NOT NULL THEN
      UPDATE public.chat_messages
        SET content = human_msg
        WHERE id = rec.current_message_id;
    ELSIF rec.current_svg IS NULL THEN
      BEGIN
        INSERT INTO public.chat_messages (thread_id, user_id, role, content)
        VALUES (rec.thread_id, rec.user_id, 'assistant', human_msg);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    ELSIF rec.current_message_id IS NOT NULL THEN
      UPDATE public.chat_messages
        SET content = regexp_replace(content, E'\n\n_⏳ .+?_$', '')
        WHERE id = rec.current_message_id;
    END IF;

    affected := affected + 1;
  END LOOP;

  RETURN affected;
END;
$function$;