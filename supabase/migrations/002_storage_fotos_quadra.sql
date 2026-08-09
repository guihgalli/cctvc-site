-- =============================================================================
-- Migration: políticas de storage para o bucket "fotos-quadra"
-- NOTA: a migration 003_security_hardening.sql substitui o upload público
-- por upload com ticket de admin. Prefira executar a 003 em produção.
-- =============================================================================

-- Garante o bucket público (idempotente)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-quadra', 'fotos-quadra', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Leitura pública fotos-quadra" ON storage.objects;
DROP POLICY IF EXISTS "Upload público fotos-quadra" ON storage.objects;
DROP POLICY IF EXISTS "Update público fotos-quadra" ON storage.objects;
DROP POLICY IF EXISTS "Delete público fotos-quadra" ON storage.objects;

CREATE POLICY "Leitura pública fotos-quadra"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fotos-quadra');

CREATE POLICY "Upload público fotos-quadra"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'fotos-quadra');

CREATE POLICY "Update público fotos-quadra"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'fotos-quadra')
  WITH CHECK (bucket_id = 'fotos-quadra');

CREATE POLICY "Delete público fotos-quadra"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'fotos-quadra');
