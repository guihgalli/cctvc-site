-- =============================================================================
-- Schema do banco de dados — CCTVC (Clube de Caça e Tiro Velha Central)
-- Execute este script no SQL Editor do Supabase
-- =============================================================================

-- Extensão para geração de UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Tabela: usuarios
-- Sócios e administradores do clube
-- -----------------------------------------------------------------------------
CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo_usuario VARCHAR(6) UNIQUE NOT NULL CHECK (codigo_usuario ~ '^\d{6}$'),
  cpf           VARCHAR(11) NOT NULL,
  nome          VARCHAR(255) NOT NULL,
  perfil        VARCHAR(10) NOT NULL DEFAULT 'usuario' CHECK (perfil IN ('usuario', 'admin')),
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE usuarios IS 'Sócios e administradores cadastrados no clube';
COMMENT ON COLUMN usuarios.codigo_usuario IS 'Matrícula do sócio — 6 dígitos numéricos';
COMMENT ON COLUMN usuarios.cpf IS 'CPF completo (11 dígitos). Senha = 3 primeiros dígitos';
COMMENT ON COLUMN usuarios.perfil IS 'usuario = sócio comum | admin = administrador';

-- -----------------------------------------------------------------------------
-- Tabela: quadras
-- Quadras esportivas disponíveis para reserva
-- -----------------------------------------------------------------------------
CREATE TABLE quadras (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome         VARCHAR(255) NOT NULL,
  descricao    TEXT,
  tipo_esporte VARCHAR(100),
  ativo        BOOLEAN NOT NULL DEFAULT true,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE quadras IS 'Quadras esportivas do clube';
COMMENT ON COLUMN quadras.tipo_esporte IS 'Ex.: Tênis, Futsal, Vôlei, Poliesportiva';

-- -----------------------------------------------------------------------------
-- Tabela: fotos_quadras
-- Fotos associadas a cada quadra
-- -----------------------------------------------------------------------------
CREATE TABLE fotos_quadras (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quadra_id UUID NOT NULL REFERENCES quadras(id) ON DELETE CASCADE,
  url       TEXT NOT NULL,
  principal BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fotos_quadras IS 'Galeria de fotos das quadras';
COMMENT ON COLUMN fotos_quadras.principal IS 'Indica se é a foto de capa da quadra';

-- -----------------------------------------------------------------------------
-- Tabela: reservas
-- Agendamentos de horários nas quadras
-- -----------------------------------------------------------------------------
CREATE TABLE reservas (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quadra_id    UUID NOT NULL REFERENCES quadras(id) ON DELETE CASCADE,
  usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  data_reserva DATE NOT NULL,
  hora_inicio  TIME NOT NULL,
  hora_fim     TIME NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'confirmada'
                 CHECK (status IN ('confirmada', 'cancelada')),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT horario_valido CHECK (hora_fim > hora_inicio)
);

COMMENT ON TABLE reservas IS 'Reservas de horários nas quadras';
COMMENT ON COLUMN reservas.status IS 'confirmada = ativa | cancelada = desfeita pelo usuário ou admin';

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------
CREATE INDEX idx_reservas_quadra_data ON reservas(quadra_id, data_reserva);
CREATE INDEX idx_reservas_usuario ON reservas(usuario_id);
CREATE INDEX idx_usuarios_codigo ON usuarios(codigo_usuario);

-- Impede reservas duplicadas no mesmo horário/quadra (apenas confirmadas)
CREATE UNIQUE INDEX idx_reserva_sem_conflito
  ON reservas(quadra_id, data_reserva, hora_inicio)
  WHERE status = 'confirmada';

-- -----------------------------------------------------------------------------
-- Segurança em nível de linha (RLS)
-- Habilitado com políticas permissivas para a chave anon do app.
-- Em produção, considere restringir via Edge Functions com service role.
-- -----------------------------------------------------------------------------
ALTER TABLE usuarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quadras       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos_quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total em usuarios"      ON usuarios      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total em quadras"       ON quadras       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total em fotos_quadras" ON fotos_quadras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total em reservas"      ON reservas      FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Storage (criar manualmente no Supabase Storage)
-- Bucket público: "fotos-quadras"
-- INSERT INTO storage.buckets (id, name, public) VALUES ('fotos-quadras', 'fotos-quadras', true);
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- Dados iniciais
-- -----------------------------------------------------------------------------

-- Administrador padrão
-- Usuário: 000001 | Senha: 123 (3 primeiros dígitos do CPF 12345678901)
INSERT INTO usuarios (codigo_usuario, cpf, nome, perfil) VALUES
  ('000001', '12345678901', 'Administrador', 'admin');

-- Quadras de exemplo
INSERT INTO quadras (nome, descricao, tipo_esporte) VALUES
  ('Quadra de Tênis 1', 'Quadra de tênis com piso de saibro', 'Tênis'),
  ('Quadra Poliesportiva', 'Quadra coberta para futsal e vôlei', 'Poliesportiva');
