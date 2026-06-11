-- ============================================================
-- supabase/migrations/20260529122505_d6345c36-731e-44fd-a465-dcc7d2c31957.sql
-- Migration — 20260529122505_d6345c36-731e-44fd-a465-dcc7d2c31957.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
ALTER TABLE public.spec_documents
  ADD COLUMN review_score int,
  ADD COLUMN review_notes jsonb NOT NULL DEFAULT '[]'::jsonb;