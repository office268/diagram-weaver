CREATE TABLE public.app_metadata (
  id text PRIMARY KEY DEFAULT 'singleton',
  title text NOT NULL DEFAULT 'סוכן ניתוח מערכות — תרשימים מתוך טקסט',
  description text NOT NULL DEFAULT 'סוכן AI לאנליסטים: הופך דרישות וטקסט חופשי לתרשימי זרימה, swim-lanes, ER ורצף — עם עריכה ויזואלית וקוד Mermaid.',
  og_title text NOT NULL DEFAULT '',
  og_description text NOT NULL DEFAULT '',
  og_site_name text NOT NULL DEFAULT 'סוכן ניתוח מערכות',
  og_type text NOT NULL DEFAULT 'website',
  favicon_url text NOT NULL DEFAULT '',
  og_image_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_metadata_singleton CHECK (id = 'singleton')
);

GRANT SELECT ON public.app_metadata TO anon, authenticated;
GRANT INSERT, UPDATE ON public.app_metadata TO authenticated;
GRANT ALL ON public.app_metadata TO service_role;

ALTER TABLE public.app_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metadata public read" ON public.app_metadata FOR SELECT USING (true);
CREATE POLICY "metadata auth insert" ON public.app_metadata FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "metadata auth update" ON public.app_metadata FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.app_metadata (id) VALUES ('singleton') ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "app-assets public read" ON storage.objects FOR SELECT USING (bucket_id = 'app-assets');
CREATE POLICY "app-assets auth write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'app-assets');
CREATE POLICY "app-assets auth update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'app-assets') WITH CHECK (bucket_id = 'app-assets');
CREATE POLICY "app-assets auth delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'app-assets');