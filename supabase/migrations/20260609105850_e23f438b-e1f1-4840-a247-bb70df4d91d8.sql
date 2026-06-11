
-- ============================================================
-- supabase/migrations/20260609105850_e23f438b-e1f1-4840-a247-bb70df4d91d8.sql
-- Migration — 20260609105850_e23f438b-e1f1-4840-a247-bb70df4d91d8.sql
-- מיגרציית מסד נתונים (Lovable Cloud / Supabase)
-- ============================================================
CREATE POLICY "chat-attachments owner read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "chat-attachments owner insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "chat-attachments owner update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "chat-attachments owner delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
