-- ============================================================
-- supabase/migrations/20260609003636_806b57fa-3170-4833-bf10-64d61c570f4a.sql
-- Migration — 20260609003636_806b57fa-3170-4833-bf10-64d61c570f4a.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
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
    SELECT id, thread_id, user_id, kind
    FROM public.diagram_jobs
    WHERE status = 'processing'
      AND locked_at IS NOT NULL
      AND locked_at < now() - make_interval(mins => _stale_minutes)
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.diagram_jobs
      SET status = 'failed',
          error_message = COALESCE(error_message, 'stuck timeout'),
          completed_at = now(),
          updated_at = now()
    WHERE id = rec.id;

    human_msg :=
      'יצירת התרשים לא הושלמה בזמן הקצוב ונעצרה. ' ||
      'זה לרוב קורה כשהפייפליין חורג ממסגרת הזמן של בקשת השרת (תרשימי Activity מורכבים כוללים עד 6 קריאות LLM סדרתיות). ' ||
      'אפשר לנסות שוב — רצוי לקצר/לפצל את התיאור או לבחור מודל מהיר יותר בהגדרות הצ׳אט.';

    BEGIN
      INSERT INTO public.chat_messages (thread_id, user_id, role, content)
      VALUES (rec.thread_id, rec.user_id, 'assistant', human_msg);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    affected := affected + 1;
  END LOOP;

  RETURN affected;
END;
$function$;