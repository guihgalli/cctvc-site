-- =============================================================================
-- Migration: endurecimento de segurança (sessões + RLS + RPCs)
-- Mantém login código (6 dígitos) + senha (3 primeiros dígitos do CPF).
-- Execute no SQL Editor do Supabase após o schema base.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tabelas de sessão e rate-limit
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessoes (
  token       TEXT PRIMARY KEY,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em   TIMESTAMPTZ NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes(expira_em);

CREATE TABLE IF NOT EXISTS tentativas_login (
  id              BIGSERIAL PRIMARY KEY,
  codigo_usuario  VARCHAR(6) NOT NULL,
  tentado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tentativas_login_codigo_tempo
  ON tentativas_login(codigo_usuario, tentado_em);

CREATE TABLE IF NOT EXISTS upload_tickets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path        TEXT NOT NULL UNIQUE,
  quadra_id   UUID NOT NULL REFERENCES quadras(id) ON DELETE CASCADE,
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em   TIMESTAMPTZ NOT NULL,
  usado       BOOLEAN NOT NULL DEFAULT false,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_tickets_path ON upload_tickets(path);

-- CPF único quando informado (ignora vazios)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_cpf_unique'
  ) THEN
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_cpf_unique UNIQUE (cpf);
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Não foi possível criar UNIQUE(cpf): existem CPFs duplicados.';
END $$;

-- -----------------------------------------------------------------------------
-- Remove políticas permissivas antigas
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Acesso total em usuarios" ON usuarios;
DROP POLICY IF EXISTS "Acesso total em quadras" ON quadras;
DROP POLICY IF EXISTS "Acesso total em fotos_quadras" ON fotos_quadras;
DROP POLICY IF EXISTS "Acesso total em horarios_quadra" ON horarios_quadra;
DROP POLICY IF EXISTS "Acesso total em reservas" ON reservas;

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos_quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_quadra ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tentativas_login ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_tickets ENABLE ROW LEVEL SECURITY;

-- Sem políticas = sem acesso direto via PostgREST (exceto políticas abaixo)

DROP POLICY IF EXISTS "Leitura quadras ativas" ON quadras;
CREATE POLICY "Leitura quadras ativas"
  ON quadras FOR SELECT
  USING (ativo = true);

DROP POLICY IF EXISTS "Leitura fotos de quadras ativas" ON fotos_quadras;
CREATE POLICY "Leitura fotos de quadras ativas"
  ON fotos_quadras FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quadras q
      WHERE q.id = fotos_quadras.quadra_id AND q.ativo = true
    )
  );

DROP POLICY IF EXISTS "Leitura horarios de quadras ativas" ON horarios_quadra;
CREATE POLICY "Leitura horarios de quadras ativas"
  ON horarios_quadra FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quadras q
      WHERE q.id = horarios_quadra.quadra_id AND q.ativo = true
    )
  );

-- sessoes / usuarios / reservas / tickets: sem acesso direto

-- -----------------------------------------------------------------------------
-- Helpers internos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_new_token()
RETURNS text
LANGUAGE sql
AS $$
  SELECT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
$$;

CREATE OR REPLACE FUNCTION app_require_usuario(p_token text)
RETURNS usuarios
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada' USING ERRCODE = '28000';
  END IF;

  SELECT u.*
  INTO v_user
  FROM sessoes s
  JOIN usuarios u ON u.id = s.usuario_id
  WHERE s.token = p_token
    AND s.expira_em > NOW()
    AND u.ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada' USING ERRCODE = '28000';
  END IF;

  UPDATE sessoes
  SET expira_em = NOW() + INTERVAL '7 days'
  WHERE token = p_token;

  RETURN v_user;
END;
$$;

CREATE OR REPLACE FUNCTION app_require_admin(p_token text)
RETURNS usuarios
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
BEGIN
  v_user := app_require_usuario(p_token);
  IF v_user.perfil IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN v_user;
END;
$$;

CREATE OR REPLACE FUNCTION app_quadra_aberta(
  p_quadra_id uuid,
  p_data date,
  p_hora_inicio time,
  p_hora_fim time
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dia smallint;
  v_h horarios_quadra%ROWTYPE;
BEGIN
  v_dia := EXTRACT(DOW FROM p_data)::smallint;

  SELECT *
  INTO v_h
  FROM horarios_quadra
  WHERE quadra_id = p_quadra_id
    AND dia_semana = v_dia
    AND ativo = true;

  IF NOT FOUND THEN
    -- Fallback legado: 07:00–22:00 se não houver configuração
    IF NOT EXISTS (SELECT 1 FROM horarios_quadra WHERE quadra_id = p_quadra_id) THEN
      RETURN p_hora_inicio >= TIME '07:00'
        AND p_hora_fim <= TIME '22:00'
        AND p_hora_fim > p_hora_inicio;
    END IF;
    RETURN false;
  END IF;

  RETURN p_hora_inicio >= v_h.hora_inicio
    AND p_hora_fim <= v_h.hora_fim
    AND p_hora_fim > p_hora_inicio;
END;
$$;

-- -----------------------------------------------------------------------------
-- Auth RPCs (login inalterado na UX: código + senha CPF)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fazer_login(p_codigo text, p_senha text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_token text;
  v_fails int;
BEGIN
  IF p_codigo IS NULL OR p_codigo !~ '^\d{6}$' OR p_senha IS NULL OR p_senha !~ '^\d{3}$' THEN
    RAISE EXCEPTION 'Usuário ou senha inválidos' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM tentativas_login WHERE tentado_em < NOW() - INTERVAL '1 day';

  SELECT COUNT(*)::int INTO v_fails
  FROM tentativas_login
  WHERE codigo_usuario = p_codigo
    AND tentado_em > NOW() - INTERVAL '15 minutes';

  IF v_fails >= 15 THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde alguns minutos.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_user
  FROM usuarios
  WHERE codigo_usuario = p_codigo;

  IF NOT FOUND OR NOT v_user.ativo OR left(v_user.cpf, 3) IS DISTINCT FROM p_senha THEN
    INSERT INTO tentativas_login (codigo_usuario) VALUES (p_codigo);
    RAISE EXCEPTION 'Usuário ou senha inválidos' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM tentativas_login WHERE codigo_usuario = p_codigo;

  -- Encerra sessões antigas do mesmo usuário (opcional: limita sessões)
  DELETE FROM sessoes WHERE usuario_id = v_user.id AND expira_em < NOW();

  v_token := app_new_token();
  INSERT INTO sessoes (token, usuario_id, expira_em)
  VALUES (v_token, v_user.id, NOW() + INTERVAL '7 days');

  RETURN json_build_object(
    'token', v_token,
    'user', json_build_object(
      'id', v_user.id,
      'codigo_usuario', v_user.codigo_usuario,
      'nome', v_user.nome,
      'perfil', v_user.perfil
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION fazer_logout(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM sessoes WHERE token = p_token;
  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION obter_sessao(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
BEGIN
  v_user := app_require_usuario(p_token);
  RETURN json_build_object(
    'token', p_token,
    'user', json_build_object(
      'id', v_user.id,
      'codigo_usuario', v_user.codigo_usuario,
      'nome', v_user.nome,
      'perfil', v_user.perfil
    )
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Reservas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION listar_reservas_quadra_data(
  p_token text,
  p_quadra_id uuid,
  p_data date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
BEGIN
  v_user := app_require_usuario(p_token);

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(x) ORDER BY x.hora_inicio)
      FROM (
        SELECT
          r.id,
          r.quadra_id,
          r.usuario_id,
          r.data_reserva,
          r.hora_inicio,
          r.hora_fim,
          r.status,
          r.criado_em,
          CASE
            WHEN v_user.perfil = 'admin' OR r.usuario_id = v_user.id THEN
              json_build_object(
                'nome', u.nome,
                'codigo_usuario', u.codigo_usuario
              )
            ELSE NULL
          END AS usuarios
        FROM reservas r
        JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.quadra_id = p_quadra_id
          AND r.data_reserva = p_data
          AND r.status = 'confirmada'
      ) x
    ),
    '[]'::json
  );
END;
$$;

CREATE OR REPLACE FUNCTION listar_minhas_reservas(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
BEGIN
  v_user := app_require_usuario(p_token);

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(x) ORDER BY x.data_reserva, x.hora_inicio)
      FROM (
        SELECT
          r.id,
          r.quadra_id,
          r.usuario_id,
          r.data_reserva,
          r.hora_inicio,
          r.hora_fim,
          r.status,
          r.criado_em,
          json_build_object(
            'nome', q.nome,
            'tipo_esporte', q.tipo_esporte
          ) AS quadras
        FROM reservas r
        JOIN quadras q ON q.id = r.quadra_id
        WHERE r.usuario_id = v_user.id
          AND r.status = 'confirmada'
          AND r.data_reserva >= CURRENT_DATE
      ) x
    ),
    '[]'::json
  );
END;
$$;

CREATE OR REPLACE FUNCTION criar_reserva(
  p_token text,
  p_quadra_id uuid,
  p_data date,
  p_hora_inicio time,
  p_hora_fim time
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_row reservas%ROWTYPE;
BEGIN
  v_user := app_require_usuario(p_token);

  IF NOT EXISTS (SELECT 1 FROM quadras WHERE id = p_quadra_id AND ativo = true) THEN
    RAISE EXCEPTION 'Quadra indisponível' USING ERRCODE = 'P0001';
  END IF;

  IF p_data < CURRENT_DATE THEN
    RAISE EXCEPTION 'Não é possível reservar datas passadas.' USING ERRCODE = 'P0001';
  END IF;

  IF p_data = CURRENT_DATE AND p_hora_inicio <= LOCAL_TIME THEN
    RAISE EXCEPTION 'Não é possível reservar horários passados.' USING ERRCODE = 'P0001';
  END IF;

  IF p_data > CURRENT_DATE + 21 THEN
    RAISE EXCEPTION 'Data fora do período permitido para reservas.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT app_quadra_aberta(p_quadra_id, p_data, p_hora_inicio, p_hora_fim) THEN
    RAISE EXCEPTION 'Quadra fechada ou horário inválido neste dia.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO reservas (quadra_id, usuario_id, data_reserva, hora_inicio, hora_fim, status)
  VALUES (p_quadra_id, v_user.id, p_data, p_hora_inicio, p_hora_fim, 'confirmada')
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Este horário já está reservado para esta quadra.' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION cancelar_reserva(p_token text, p_reserva_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_row reservas%ROWTYPE;
BEGIN
  v_user := app_require_usuario(p_token);

  SELECT * INTO v_row FROM reservas WHERE id = p_reserva_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada' USING ERRCODE = 'P0001';
  END IF;

  IF v_user.perfil IS DISTINCT FROM 'admin' AND v_row.usuario_id IS DISTINCT FROM v_user.id THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  UPDATE reservas
  SET status = 'cancelada'
  WHERE id = p_reserva_id
  RETURNING * INTO v_row;

  RETURN json_build_object('ok', true, 'id', v_row.id);
END;
$$;

CREATE OR REPLACE FUNCTION admin_listar_reservas(
  p_token text,
  p_quadra_id uuid DEFAULT NULL,
  p_data date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_require_admin(p_token);

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(x) ORDER BY x.data_reserva, x.hora_inicio)
      FROM (
        SELECT
          r.id,
          r.quadra_id,
          r.usuario_id,
          r.data_reserva,
          r.hora_inicio,
          r.hora_fim,
          r.status,
          r.criado_em,
          json_build_object('nome', q.nome) AS quadras,
          json_build_object(
            'nome', u.nome,
            'codigo_usuario', u.codigo_usuario
          ) AS usuarios
        FROM reservas r
        JOIN quadras q ON q.id = r.quadra_id
        JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.status = 'confirmada'
          AND (p_quadra_id IS NULL OR r.quadra_id = p_quadra_id)
          AND (p_data IS NULL OR r.data_reserva = p_data)
      ) x
    ),
    '[]'::json
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Admin: quadras
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_listar_quadras(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_require_admin(p_token);

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(x) ORDER BY x.nome)
      FROM (
        SELECT
          q.*,
          COALESCE(
            (
              SELECT json_agg(f ORDER BY f.principal DESC, f.criado_em)
              FROM fotos_quadras f
              WHERE f.quadra_id = q.id
            ),
            '[]'::json
          ) AS fotos_quadras,
          COALESCE(
            (
              SELECT json_agg(h ORDER BY h.dia_semana)
              FROM horarios_quadra h
              WHERE h.quadra_id = q.id
            ),
            '[]'::json
          ) AS horarios_quadra
        FROM quadras q
      ) x
    ),
    '[]'::json
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_criar_quadra(
  p_token text,
  p_nome text,
  p_descricao text DEFAULT NULL,
  p_tipo_esporte text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row quadras%ROWTYPE;
  v_dia int;
BEGIN
  PERFORM app_require_admin(p_token);

  IF p_nome IS NULL OR length(trim(p_nome)) = 0 THEN
    RAISE EXCEPTION 'Nome da quadra é obrigatório' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO quadras (nome, descricao, tipo_esporte)
  VALUES (trim(p_nome), NULLIF(trim(p_descricao), ''), NULLIF(trim(p_tipo_esporte), ''))
  RETURNING * INTO v_row;

  FOR v_dia IN 0..6 LOOP
    INSERT INTO horarios_quadra (quadra_id, dia_semana, hora_inicio, hora_fim, intervalo_min)
    VALUES (v_row.id, v_dia, TIME '07:00', TIME '22:00', 60)
    ON CONFLICT (quadra_id, dia_semana) DO NOTHING;
  END LOOP;

  RETURN row_to_json(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION admin_atualizar_quadra(
  p_token text,
  p_id uuid,
  p_nome text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_tipo_esporte text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row quadras%ROWTYPE;
BEGIN
  PERFORM app_require_admin(p_token);

  UPDATE quadras
  SET
    nome = COALESCE(NULLIF(trim(p_nome), ''), nome),
    descricao = CASE WHEN p_descricao IS NULL THEN descricao ELSE NULLIF(trim(p_descricao), '') END,
    tipo_esporte = CASE WHEN p_tipo_esporte IS NULL THEN tipo_esporte ELSE NULLIF(trim(p_tipo_esporte), '') END,
    ativo = COALESCE(p_ativo, ativo)
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quadra não encontrada' USING ERRCODE = 'P0001';
  END IF;

  RETURN row_to_json(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION admin_excluir_quadra(p_token text, p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  PERFORM app_require_admin(p_token);
  DELETE FROM quadras WHERE id = p_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Quadra não encontrada' USING ERRCODE = 'P0001';
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION admin_substituir_horarios_quadra(
  p_token text,
  p_quadra_id uuid,
  p_horarios json
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item json;
  v_result json;
BEGIN
  PERFORM app_require_admin(p_token);

  IF NOT EXISTS (SELECT 1 FROM quadras WHERE id = p_quadra_id) THEN
    RAISE EXCEPTION 'Quadra não encontrada' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM horarios_quadra WHERE quadra_id = p_quadra_id;

  FOR v_item IN SELECT * FROM json_array_elements(COALESCE(p_horarios, '[]'::json))
  LOOP
    INSERT INTO horarios_quadra (
      quadra_id, dia_semana, hora_inicio, hora_fim, intervalo_min, ativo
    ) VALUES (
      p_quadra_id,
      (v_item->>'dia_semana')::smallint,
      (v_item->>'hora_inicio')::time,
      (v_item->>'hora_fim')::time,
      COALESCE((v_item->>'intervalo_min')::int, 60),
      true
    );
  END LOOP;

  SELECT COALESCE(json_agg(h ORDER BY h.dia_semana), '[]'::json)
  INTO v_result
  FROM horarios_quadra h
  WHERE h.quadra_id = p_quadra_id;

  RETURN v_result;
END;
$$;

-- Upload de foto: ticket + path fixo (storage só aceita esse path)
CREATE OR REPLACE FUNCTION admin_solicitar_upload_foto(
  p_token text,
  p_quadra_id uuid,
  p_ext text DEFAULT 'jpg'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_ext text;
  v_path text;
  v_ticket_id uuid;
BEGIN
  v_user := app_require_admin(p_token);

  IF NOT EXISTS (SELECT 1 FROM quadras WHERE id = p_quadra_id) THEN
    RAISE EXCEPTION 'Quadra não encontrada' USING ERRCODE = 'P0001';
  END IF;

  v_ext := lower(COALESCE(NULLIF(trim(p_ext), ''), 'jpg'));
  IF v_ext !~ '^(jpe?g|png|webp|gif)$' THEN
    v_ext := 'jpg';
  END IF;

  v_path := p_quadra_id::text || '/' || app_new_token() || '.' || v_ext;

  INSERT INTO upload_tickets (path, quadra_id, usuario_id, expira_em)
  VALUES (v_path, p_quadra_id, v_user.id, NOW() + INTERVAL '15 minutes')
  RETURNING id INTO v_ticket_id;

  RETURN json_build_object(
    'ticket_id', v_ticket_id,
    'path', v_path,
    'bucket', 'fotos-quadra'
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_confirmar_foto_quadra(
  p_token text,
  p_path text,
  p_url text,
  p_principal boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_ticket upload_tickets%ROWTYPE;
  v_row fotos_quadras%ROWTYPE;
BEGIN
  v_user := app_require_admin(p_token);

  SELECT * INTO v_ticket
  FROM upload_tickets
  WHERE path = p_path
    AND usado = false
    AND expira_em > NOW()
    AND usuario_id = v_user.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Upload inválido ou expirado' USING ERRCODE = 'P0001';
  END IF;

  IF p_principal THEN
    UPDATE fotos_quadras SET principal = false
    WHERE quadra_id = v_ticket.quadra_id AND principal = true;
  END IF;

  INSERT INTO fotos_quadras (quadra_id, url, principal)
  VALUES (v_ticket.quadra_id, p_url, COALESCE(p_principal, false))
  RETURNING * INTO v_row;

  UPDATE upload_tickets SET usado = true WHERE id = v_ticket.id;

  RETURN row_to_json(v_row);
END;
$$;

-- -----------------------------------------------------------------------------
-- Admin: usuários (CPF só via RPC admin autenticado)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_listar_usuarios(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_require_admin(p_token);

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(u) ORDER BY u.nome)
      FROM (
        SELECT id, codigo_usuario, cpf, nome, perfil, ativo, criado_em
        FROM usuarios
      ) u
    ),
    '[]'::json
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_criar_usuario(
  p_token text,
  p_codigo text,
  p_cpf text,
  p_nome text,
  p_perfil text DEFAULT 'usuario'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row usuarios%ROWTYPE;
  v_cpf text;
BEGIN
  PERFORM app_require_admin(p_token);

  v_cpf := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');

  IF p_codigo IS NULL OR p_codigo !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'Código de usuário inválido' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF deve ter 11 dígitos' USING ERRCODE = 'P0001';
  END IF;
  IF p_nome IS NULL OR length(trim(p_nome)) = 0 THEN
    RAISE EXCEPTION 'Nome é obrigatório' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(p_perfil, 'usuario') NOT IN ('usuario', 'admin') THEN
    RAISE EXCEPTION 'Perfil inválido' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO usuarios (codigo_usuario, cpf, nome, perfil)
  VALUES (p_codigo, v_cpf, trim(p_nome), COALESCE(p_perfil, 'usuario'))
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Código de usuário ou CPF já cadastrado.' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION admin_atualizar_usuario(
  p_token text,
  p_id uuid,
  p_nome text DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL,
  p_perfil text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row usuarios%ROWTYPE;
  v_cpf text;
BEGIN
  PERFORM app_require_admin(p_token);

  IF p_cpf IS NOT NULL THEN
    v_cpf := regexp_replace(p_cpf, '\D', '', 'g');
    IF length(v_cpf) <> 11 THEN
      RAISE EXCEPTION 'CPF deve ter 11 dígitos' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_perfil IS NOT NULL AND p_perfil NOT IN ('usuario', 'admin') THEN
    RAISE EXCEPTION 'Perfil inválido' USING ERRCODE = 'P0001';
  END IF;

  UPDATE usuarios
  SET
    nome = COALESCE(NULLIF(trim(p_nome), ''), nome),
    cpf = COALESCE(v_cpf, cpf),
    ativo = COALESCE(p_ativo, ativo),
    perfil = COALESCE(p_perfil, perfil)
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0001';
  END IF;

  -- Se desativado, encerra sessões
  IF v_row.ativo IS FALSE THEN
    DELETE FROM sessoes WHERE usuario_id = v_row.id;
  END IF;

  RETURN row_to_json(v_row);
END;
$$;

-- -----------------------------------------------------------------------------
-- Grants: apenas EXECUTE nas RPCs (anon key do frontend)
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE sessoes FROM anon, authenticated;
REVOKE ALL ON TABLE tentativas_login FROM anon, authenticated;
REVOKE ALL ON TABLE upload_tickets FROM anon, authenticated;
REVOKE ALL ON TABLE usuarios FROM anon, authenticated;
REVOKE ALL ON TABLE reservas FROM anon, authenticated;

REVOKE ALL ON TABLE quadras FROM anon, authenticated;
REVOKE ALL ON TABLE fotos_quadras FROM anon, authenticated;
REVOKE ALL ON TABLE horarios_quadra FROM anon, authenticated;

GRANT SELECT ON TABLE quadras TO anon, authenticated;
GRANT SELECT ON TABLE fotos_quadras TO anon, authenticated;
GRANT SELECT ON TABLE horarios_quadra TO anon, authenticated;

GRANT EXECUTE ON FUNCTION fazer_login(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fazer_logout(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION obter_sessao(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION listar_reservas_quadra_data(text, uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION listar_minhas_reservas(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION criar_reserva(text, uuid, date, time, time) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cancelar_reserva(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_listar_reservas(text, uuid, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_listar_quadras(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_criar_quadra(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_atualizar_quadra(text, uuid, text, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_excluir_quadra(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_substituir_horarios_quadra(text, uuid, json) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_solicitar_upload_foto(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_confirmar_foto_quadra(text, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_listar_usuarios(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_criar_usuario(text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_atualizar_usuario(text, uuid, text, text, boolean, text) TO anon, authenticated;

-- Helpers não precisam ser públicos
REVOKE ALL ON FUNCTION app_require_usuario(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_require_admin(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_new_token() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_quadra_aberta(uuid, date, time, time) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Storage: leitura pública; escrita só com ticket válido (path exato)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION storage_ticket_valido(p_path text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM upload_tickets t
    WHERE t.path = p_path
      AND t.usado = false
      AND t.expira_em > NOW()
  );
$$;

REVOKE ALL ON FUNCTION storage_ticket_valido(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION storage_ticket_valido(text) TO anon, authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos-quadra', 'fotos-quadra', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Leitura pública fotos-quadra" ON storage.objects;
DROP POLICY IF EXISTS "Upload público fotos-quadra" ON storage.objects;
DROP POLICY IF EXISTS "Update público fotos-quadra" ON storage.objects;
DROP POLICY IF EXISTS "Delete público fotos-quadra" ON storage.objects;
DROP POLICY IF EXISTS "Upload com ticket fotos-quadra" ON storage.objects;

CREATE POLICY "Leitura pública fotos-quadra"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fotos-quadra');

CREATE POLICY "Upload com ticket fotos-quadra"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'fotos-quadra'
    AND storage_ticket_valido(name)
  );

-- Limpeza ocasional de tickets/sessões expiradas (manual/cron)
-- DELETE FROM upload_tickets WHERE expira_em < NOW() - INTERVAL '1 day';
-- DELETE FROM sessoes WHERE expira_em < NOW();
