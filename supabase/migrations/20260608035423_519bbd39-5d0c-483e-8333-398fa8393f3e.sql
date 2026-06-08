ALTER TABLE public.dashboard_tile_order
  ADD COLUMN IF NOT EXISTS moved_to_extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS moved_to_main jsonb NOT NULL DEFAULT '[]'::jsonb;