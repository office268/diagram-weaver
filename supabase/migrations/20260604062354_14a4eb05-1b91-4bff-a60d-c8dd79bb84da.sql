
-- ============================================================
-- supabase/migrations/20260604062354_14a4eb05-1b91-4bff-a60d-c8dd79bb84da.sql
-- Migration — 20260604062354_14a4eb05-1b91-4bff-a60d-c8dd79bb84da.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
-- 1. app_metadata: admin-only writes
DROP POLICY IF EXISTS "metadata auth insert" ON public.app_metadata;
DROP POLICY IF EXISTS "metadata auth update" ON public.app_metadata;

CREATE POLICY "metadata admin insert" ON public.app_metadata
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "metadata admin update" ON public.app_metadata
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. app-assets storage bucket: admin-only writes
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE 'app-assets%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "app-assets public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'app-assets');

CREATE POLICY "app-assets admin insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "app-assets admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "app-assets admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 3. organization_members: remove self-insert
DROP POLICY IF EXISTS "Owners/admins insert members" ON public.organization_members;

CREATE POLICY "Owners/admins insert members" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(auth.uid(), org_id, 'owner'::org_role)
    OR public.has_org_role(auth.uid(), org_id, 'admin'::org_role)
  );

-- Allow the first owner to be created when an org is freshly inserted (no existing members yet)
CREATE POLICY "First owner self-insert on empty org" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'::org_role
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members m WHERE m.org_id = organization_members.org_id
    )
  );

-- 4. login_events: users can view their own
CREATE POLICY "Users view own login events" ON public.login_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 5. Realtime: restrict subscriptions to own user channels
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users subscribe to own channels" ON realtime.messages;
CREATE POLICY "Users subscribe to own channels" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'credits-' || auth.uid()::text || '%'
    OR realtime.topic() LIKE 'subs-' || auth.uid()::text || '%'
  );
