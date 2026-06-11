-- ============================================================
-- supabase/migrations/20260529143813_34663bf2-d6e4-4db6-8ed4-0c891b2e89aa.sql
-- Migration — 20260529143813_34663bf2-d6e4-4db6-8ed4-0c891b2e89aa.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
WITH groups AS (
  SELECT user_id, prompt, gen_random_uuid() AS new_gid
  FROM public.spec_documents
  WHERE group_id IS NULL AND coalesce(prompt, '') <> ''
  GROUP BY user_id, prompt
  HAVING count(*) > 1
)
UPDATE public.spec_documents s
SET group_id = g.new_gid
FROM groups g
WHERE s.group_id IS NULL
  AND s.user_id = g.user_id
  AND coalesce(s.prompt, '') = g.prompt;

UPDATE public.spec_documents
SET variant = CASE
  WHEN title ~ '— מתוקן\s*$' THEN 'revised'
  WHEN title ~ '— מקור\s*$' THEN 'original'
  ELSE 'single'
END
WHERE variant IS NULL;

UPDATE public.spec_documents
SET model = substring(title from ' — ([^—]+) — [^—]+$')
WHERE model IS NULL
  AND title ~ ' — [^—]+ — [^—]+$';