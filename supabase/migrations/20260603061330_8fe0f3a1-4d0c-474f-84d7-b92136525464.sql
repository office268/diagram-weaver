ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url text;

DROP POLICY IF EXISTS "Org admins can update their org" ON public.organizations;
CREATE POLICY "Org admins can update their org"
ON public.organizations
FOR UPDATE
TO authenticated
USING (public.has_org_role(auth.uid(), id, 'owner') OR public.has_org_role(auth.uid(), id, 'admin'))
WITH CHECK (public.has_org_role(auth.uid(), id, 'owner') OR public.has_org_role(auth.uid(), id, 'admin'));