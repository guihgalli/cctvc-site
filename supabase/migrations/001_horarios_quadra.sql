-- =============================================================================
-- Migration: horários disponíveis por quadra
-- Execute no SQL Editor do Supabase se o banco já existir (sem recriar o schema)
-- =============================================================================

CREATE TABLE IF NOT EXISTS horarios_quadra (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quadra_id     UUID NOT NULL REFERENCES quadras(id) ON DELETE CASCADE,
  dia_semana    SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio   TIME NOT NULL,
  hora_fim      TIME NOT NULL,
  intervalo_min INTEGER NOT NULL DEFAULT 60 CHECK (intervalo_min > 0),
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT horario_quadra_valido CHECK (hora_fim > hora_inicio),
  UNIQUE (quadra_id, dia_semana)
);

COMMENT ON TABLE horarios_quadra IS 'Disponibilidade semanal por quadra (0=domingo … 6=sábado)';
COMMENT ON COLUMN horarios_quadra.dia_semana IS '0=domingo, 1=segunda, …, 6=sábado';
COMMENT ON COLUMN horarios_quadra.intervalo_min IS 'Duração de cada slot de reserva em minutos';

ALTER TABLE horarios_quadra ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'horarios_quadra'
      AND policyname = 'Acesso total em horarios_quadra'
  ) THEN
    CREATE POLICY "Acesso total em horarios_quadra"
      ON horarios_quadra FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Preenche horários padrão para quadras que ainda não têm configuração
INSERT INTO horarios_quadra (quadra_id, dia_semana, hora_inicio, hora_fim, intervalo_min)
SELECT q.id, d.dia, TIME '07:00', TIME '22:00', 60
FROM quadras q
CROSS JOIN (SELECT generate_series(0, 6) AS dia) d
WHERE NOT EXISTS (
  SELECT 1 FROM horarios_quadra h WHERE h.quadra_id = q.id
);
