CREATE TYPE public.org_kind AS ENUM ('public', 'nonprofit', 'government', 'private');

ALTER TABLE public.organizations
  ADD COLUMN address text,
  ADD COLUMN website text,
  ADD COLUMN org_kind public.org_kind,
  ADD COLUMN identifier text;