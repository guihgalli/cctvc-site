-- =============================================================================
-- Migration 016: Perfis sócio titular/dependente, regras de reserva, participantes
-- Depende de: 015
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schema
-- -----------------------------------------------------------------------------

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS categoria_socio TEXT
    CHECK (categoria_socio IS NULL OR categoria_socio IN ('titular', 'dependente')),
  ADD COLUMN IF NOT EXISTS titular_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

COMMENT ON COLUMN usuarios.categoria_socio IS 'titular = último dígito 0 | dependente = último dígito 1-9';
COMMENT ON COLUMN usuarios.titular_id IS 'Sócio titular vinculado (dependentes)';

ALTER TABLE quadras
  ADD COLUMN IF NOT EXISTS tipo_quadra TEXT NOT NULL DEFAULT 'geral'
    CHECK (tipo_quadra IN ('socio', 'locacao', 'geral'));

COMMENT ON COLUMN quadras.tipo_quadra IS 'socio = só sócios | locacao = visitantes | geral = ambos';

CREATE TABLE IF NOT EXISTS liberacoes_quadra_locacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quadra_id UUID NOT NULL REFERENCES quadras(id) ON DELETE CASCADE,
  data_reserva DATE NOT NULL,
  hora_inicio TIME,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quadra_id, data_reserva, hora_inicio)
);

COMMENT ON TABLE liberacoes_quadra_locacao IS
  'Libera quadra de locação para sócios quando quadra de sócio está cheia';

CREATE TABLE IF NOT EXISTS reserva_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id UUID NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reserva_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_reserva_participantes_usuario ON reserva_participantes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_liberacoes_quadra_data ON liberacoes_quadra_locacao(quadra_id, data_reserva);

-- Atualiza categoria_socio a partir do código existente (4 dígitos sócio)
UPDATE usuarios
SET categoria_socio = CASE
  WHEN tipo_socio = 'socio' AND codigo_usuario ~ '^\d{4}$' AND right(codigo_usuario, 1) = '0' THEN 'titular'
  WHEN tipo_socio = 'socio' AND codigo_usuario ~ '^\d{4}$' THEN 'dependente'
  WHEN tipo_socio = 'socio' AND codigo_usuario ~ '^\d{6}$' AND right(codigo_usuario, 1) = '0' THEN 'titular'
  WHEN tipo_socio = 'socio' AND codigo_usuario ~ '^\d{6}$' THEN 'dependente'
  ELSE NULL
END
WHERE categoria_socio IS NULL AND tipo_socio = 'socio';

-- Vincula dependentes ao titular pelo código base
UPDATE usuarios dep
SET titular_id = tit.id
FROM usuarios tit
WHERE dep.tipo_socio = 'socio'
  AND dep.categoria_socio = 'dependente'
  AND dep.codigo_usuario ~ '^\d{4}$'
  AND tit.codigo_usuario = left(dep.codigo_usuario, 3) || '0'
  AND tit.categoria_socio = 'titular'
  AND dep.titular_id IS NULL;

-- -----------------------------------------------------------------------------
-- Helpers de semana (segunda a domingo) e regras
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_dow_segunda(p_data date)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN EXTRACT(DOW FROM p_data)::int = 0 THEN 6 ELSE EXTRACT(DOW FROM p_data)::int - 1 END;
$$;

CREATE OR REPLACE FUNCTION app_inicio_semana_segunda(p_data date)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_data - app_dow_segunda(p_data);
$$;

CREATE OR REPLACE FUNCTION app_fim_semana_domingo(p_data date)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT app_inicio_semana_segunda(p_data) + 6;
$$;

CREATE OR REPLACE FUNCTION app_data_reservavel(p_data date)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_hoje date := app_hoje_brasil();
  v_inicio_atual date := app_inicio_semana_segunda(v_hoje);
  v_fim_atual date := app_fim_semana_domingo(v_hoje);
  v_inicio_prox date := v_inicio_atual + 7;
  v_fim_prox date := v_fim_atual + 7;
  v_hoje_segunda int := app_dow_segunda(v_hoje);
BEGIN
  IF p_data < v_hoje THEN
    RETURN false;
  END IF;

  IF p_data >= v_inicio_atual AND p_data <= v_fim_atual THEN
    RETURN true;
  END IF;

  -- Domingo (6 na escala segunda=0): abre a próxima semana
  IF v_hoje_segunda = 6 AND p_data >= v_inicio_prox AND p_data <= v_fim_prox THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION app_categoria_from_codigo(p_codigo text, p_tipo_socio text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_tipo_socio <> 'socio' OR p_codigo IS NULL THEN NULL
    WHEN p_codigo ~ '^\d{4}$' AND right(p_codigo, 1) = '0' THEN 'titular'
    WHEN p_codigo ~ '^\d{4}$' THEN 'dependente'
    WHEN p_codigo ~ '^\d{6}$' AND right(p_codigo, 1) = '0' THEN 'titular'
    WHEN p_codigo ~ '^\d{6}$' THEN 'dependente'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION app_codigo_titular(p_codigo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_codigo ~ '^\d{4}$' THEN left(p_codigo, 3) || '0'
    WHEN p_codigo ~ '^\d{6}$' THEN left(p_codigo, 5) || '0'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION app_quadra_permitida_usuario(
  p_user usuarios,
  p_quadra_id uuid,
  p_data date,
  p_hora_inicio time
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_tipo text;
BEGIN
  SELECT tipo_quadra INTO v_tipo FROM quadras WHERE id = p_quadra_id;

  IF v_tipo IS NULL THEN
    RETURN false;
  END IF;

  IF p_user.perfil = 'admin' THEN
    RETURN true;
  END IF;

  IF v_tipo = 'geral' THEN
    RETURN true;
  END IF;

  IF p_user.tipo_socio = 'nao_socio' THEN
    RETURN v_tipo = 'locacao';
  END IF;

  IF p_user.tipo_socio = 'socio' THEN
    IF v_tipo = 'socio' THEN
      RETURN true;
    END IF;

    IF v_tipo = 'locacao' THEN
      RETURN EXISTS (
        SELECT 1 FROM liberacoes_quadra_locacao l
        WHERE l.quadra_id = p_quadra_id
          AND l.data_reserva = p_data
          AND (l.hora_inicio IS NULL OR l.hora_inicio = p_hora_inicio)
      );
    END IF;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION app_contar_reservas_titular_semana(p_usuario_id uuid, p_data date)
RETURNS int
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM reservas r
  WHERE r.usuario_id = p_usuario_id
    AND r.status IN ('pendente', 'confirmada')
    AND r.data_reserva >= app_inicio_semana_segunda(p_data)
    AND r.data_reserva <= app_fim_semana_domingo(p_data);
$$;

-- -----------------------------------------------------------------------------
-- app_user_json atualizado
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_user_json(u usuarios)
RETURNS json
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT json_build_object(
    'id', u.id,
    'codigo_usuario', u.codigo_usuario,
    'nome', u.nome,
    'perfil', u.perfil,
    'tipo_socio', u.tipo_socio,
    'categoria_socio', u.categoria_socio,
    'telefone', u.telefone,
    'email', u.email,
    'ativo', u.ativo,
    'inadimplente', (u.tipo_socio = 'socio' AND NOT u.ativo),
    'precisa_telefone', (
      u.tipo_socio = 'nao_socio'
      AND (u.telefone IS NULL OR length(regexp_replace(u.telefone, '\D', '', 'g')) NOT IN (10, 11))
    )
  );
$$;

-- Permite inadimplentes visualizarem horários (bloqueio só em criar_reserva)
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
    AND s.expira_em > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada' USING ERRCODE = '28000';
  END IF;

  UPDATE sessoes
  SET expira_em = NOW() + INTERVAL '7 days'
  WHERE token = p_token;

  RETURN v_user;
END;
$$;

-- -----------------------------------------------------------------------------
-- Login: 4 dígitos + senha 6 dígitos; inadimplente pode entrar
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fazer_login(p_codigo text, p_senha text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_token text;
  v_fails int;
  v_ok boolean := false;
BEGIN
  IF p_codigo IS NULL OR p_codigo !~ '^\d{4}$' OR p_senha IS NULL OR p_senha !~ '^\d{6}$' THEN
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

  IF FOUND AND v_user.senha_hash IS NOT NULL THEN
    v_ok := (v_user.senha_hash = crypt(p_senha, v_user.senha_hash));
  ELSE
    PERFORM crypt(p_senha, '$2a$06$dZzOtKcscL4pUx1Is0mVk.OUrGO.B5Ya7t53lgAoQALAeHfawXqKi');
    v_ok := false;
  END IF;

  IF NOT v_ok THEN
    INSERT INTO tentativas_login (codigo_usuario) VALUES (p_codigo);
    RAISE EXCEPTION 'Usuário ou senha inválidos' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM tentativas_login WHERE codigo_usuario = p_codigo;
  DELETE FROM sessoes WHERE usuario_id = v_user.id AND expira_em < NOW();

  v_token := app_new_token();
  INSERT INTO sessoes (token, usuario_id, expira_em)
  VALUES (v_token, v_user.id, NOW() + INTERVAL '7 days');

  RETURN json_build_object('token', v_token, 'user', app_user_json(v_user));
END;
$$;

-- alterar_senha: 6 dígitos
CREATE OR REPLACE FUNCTION alterar_senha(
  p_token text,
  p_senha_atual text,
  p_senha_nova text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_new_token text;
BEGIN
  IF p_senha_atual IS NULL OR p_senha_atual !~ '^\d{6}$'
     OR p_senha_nova IS NULL OR p_senha_nova !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'Senha deve ter 6 dígitos numéricos.' USING ERRCODE = 'P0001';
  END IF;

  v_user := app_require_usuario(p_token);

  IF v_user.senha_hash IS NULL
     OR v_user.senha_hash <> crypt(p_senha_atual, v_user.senha_hash) THEN
    RAISE EXCEPTION 'Senha atual incorreta.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE usuarios
  SET senha_hash = crypt(p_senha_nova, gen_salt('bf'))
  WHERE id = v_user.id;

  DELETE FROM sessoes WHERE usuario_id = v_user.id;

  v_new_token := app_new_token();
  INSERT INTO sessoes (token, usuario_id, expira_em)
  VALUES (v_new_token, v_user.id, NOW() + INTERVAL '7 days');

  RETURN json_build_object('ok', true, 'token', v_new_token);
END;
$$;

-- admin alterar senha
CREATE OR REPLACE FUNCTION admin_alterar_senha_usuario(
  p_token text,
  p_usuario_id uuid,
  p_senha_nova text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin usuarios%ROWTYPE;
  v_row usuarios%ROWTYPE;
BEGIN
  v_admin := app_require_admin(p_token);

  IF p_senha_nova IS NULL OR p_senha_nova !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'Senha deve ter 6 dígitos numéricos.' USING ERRCODE = 'P0001';
  END IF;

  IF p_usuario_id = v_admin.id THEN
    RAISE EXCEPTION 'Use a página Conta para alterar sua própria senha.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE usuarios
  SET senha_hash = crypt(p_senha_nova, gen_salt('bf'))
  WHERE id = p_usuario_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM sessoes WHERE usuario_id = v_row.id;

  RETURN json_build_object('ok', true, 'id', v_row.id);
END;
$$;

-- -----------------------------------------------------------------------------
-- criar_reserva com regras completas
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS criar_reserva(text, uuid, date, time, time);

CREATE OR REPLACE FUNCTION criar_reserva(
  p_token text,
  p_quadra_id uuid,
  p_data date,
  p_hora_inicio time,
  p_hora_fim time,
  p_participantes uuid[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_row reservas%ROWTYPE;
  v_status text;
  v_hoje date := app_hoje_brasil();
  v_agora time := app_agora_brasil();
  v_participante uuid;
BEGIN
  PERFORM expirar_reservas_pendentes();

  v_user := app_require_usuario(p_token);

  IF v_user.perfil <> 'admin' THEN
    IF v_user.tipo_socio = 'socio' AND v_user.categoria_socio = 'dependente' THEN
      RAISE EXCEPTION 'Dependentes podem apenas visualizar horários e reservas.' USING ERRCODE = 'P0001';
    END IF;

    IF v_user.tipo_socio = 'socio' AND NOT v_user.ativo THEN
      RAISE EXCEPTION 'Há pendências financeiras em sua associação. Procure a secretaria do clube para regularizar antes de agendar.' USING ERRCODE = 'P0001';
    END IF;

    IF v_user.tipo_socio = 'socio'
       AND v_user.categoria_socio = 'titular'
       AND app_contar_reservas_titular_semana(v_user.id, p_data) >= 2 THEN
      RAISE EXCEPTION 'Sócio titular pode agendar no máximo 2 vezes por semana (segunda a domingo).' USING ERRCODE = 'P0001';
    END IF;

    IF NOT app_quadra_permitida_usuario(v_user, p_quadra_id, p_data, p_hora_inicio) THEN
      RAISE EXCEPTION 'Esta quadra não está disponível para o seu perfil.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_user.tipo_socio = 'nao_socio' THEN
    IF v_user.telefone IS NULL OR length(regexp_replace(v_user.telefone, '\D', '', 'g')) NOT IN (10, 11) THEN
      RAISE EXCEPTION 'Cadastre seu WhatsApp em Conta antes de solicitar uma reserva.' USING ERRCODE = 'P0001';
    END IF;
    v_status := 'pendente';
  ELSE
    v_status := 'confirmada';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM quadras WHERE id = p_quadra_id AND ativo = true) THEN
    RAISE EXCEPTION 'Quadra indisponível' USING ERRCODE = 'P0001';
  END IF;

  IF p_data < v_hoje THEN
    RAISE EXCEPTION 'Não é possível reservar datas passadas.' USING ERRCODE = 'P0001';
  END IF;

  IF p_data = v_hoje AND p_hora_inicio <= v_agora THEN
    RAISE EXCEPTION 'Não é possível reservar horários passados.' USING ERRCODE = 'P0001';
  END IF;

  IF v_user.perfil <> 'admin' AND NOT app_data_reservavel(p_data) THEN
    RAISE EXCEPTION 'Data fora do período liberado. A próxima semana abre aos domingos.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT app_quadra_aberta(p_quadra_id, p_data, p_hora_inicio, p_hora_fim) THEN
    RAISE EXCEPTION 'Quadra fechada ou horário inválido neste dia.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO reservas (quadra_id, usuario_id, data_reserva, hora_inicio, hora_fim, status)
  VALUES (p_quadra_id, v_user.id, p_data, p_hora_inicio, p_hora_fim, v_status)
  RETURNING * INTO v_row;

  IF p_participantes IS NOT NULL AND array_length(p_participantes, 1) > 0 THEN
    FOREACH v_participante IN ARRAY p_participantes LOOP
      IF v_participante = v_user.id THEN
        CONTINUE;
      END IF;
      IF EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = v_participante
          AND u.tipo_socio = 'socio'
          AND u.ativo = true
      ) THEN
        INSERT INTO reserva_participantes (reserva_id, usuario_id)
        VALUES (v_row.id, v_participante)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN row_to_json(v_row);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Este horário já está reservado para esta quadra.' USING ERRCODE = 'P0001';
END;
$$;

-- Admin: criar reserva ignorando regras
CREATE OR REPLACE FUNCTION admin_criar_reserva(
  p_token text,
  p_usuario_id uuid,
  p_quadra_id uuid,
  p_data date,
  p_hora_inicio time,
  p_hora_fim time,
  p_participantes uuid[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row reservas%ROWTYPE;
  v_user usuarios%ROWTYPE;
  v_status text;
  v_participante uuid;
BEGIN
  PERFORM app_require_admin(p_token);
  PERFORM expirar_reservas_pendentes();

  SELECT * INTO v_user FROM usuarios WHERE id = p_usuario_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0001';
  END IF;

  IF v_user.tipo_socio = 'nao_socio' THEN
    v_status := 'pendente';
  ELSE
    v_status := 'confirmada';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM quadras WHERE id = p_quadra_id AND ativo = true) THEN
    RAISE EXCEPTION 'Quadra indisponível' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO reservas (quadra_id, usuario_id, data_reserva, hora_inicio, hora_fim, status)
  VALUES (p_quadra_id, p_usuario_id, p_data, p_hora_inicio, p_hora_fim, v_status)
  RETURNING * INTO v_row;

  IF p_participantes IS NOT NULL THEN
    FOREACH v_participante IN ARRAY p_participantes LOOP
      IF v_participante <> p_usuario_id THEN
        INSERT INTO reserva_participantes (reserva_id, usuario_id)
        VALUES (v_row.id, v_participante)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN row_to_json(v_row);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Este horário já está reservado para esta quadra.' USING ERRCODE = 'P0001';
END;
$$;

-- Buscar sócios para participantes
CREATE OR REPLACE FUNCTION buscar_socios(p_token text, p_busca text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_term text := trim(COALESCE(p_busca, ''));
BEGIN
  v_user := app_require_usuario(p_token);

  IF length(v_term) < 2 THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(x) ORDER BY x.nome)
      FROM (
        SELECT id, codigo_usuario, nome, categoria_socio, ativo
        FROM usuarios
        WHERE tipo_socio = 'socio'
          AND ativo = true
          AND (
            nome ILIKE '%' || v_term || '%'
            OR codigo_usuario LIKE v_term || '%'
          )
        LIMIT 20
      ) x
    ),
    '[]'::json
  );
END;
$$;

-- listar_minhas_reservas: inclui participações
CREATE OR REPLACE FUNCTION listar_minhas_reservas(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
BEGIN
  PERFORM expirar_reservas_pendentes();

  v_user := app_require_usuario(p_token);

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(x) ORDER BY x.data_reserva, x.hora_inicio)
      FROM (
        SELECT DISTINCT ON (r.id)
          r.id, r.quadra_id, r.usuario_id, r.data_reserva,
          r.hora_inicio, r.hora_fim, r.status, r.criado_em,
          (r.usuario_id <> v_user.id) AS participante,
          json_build_object(
            'nome', q.nome,
            'tipo_esporte', q.tipo_esporte,
            'tipo_quadra', q.tipo_quadra,
            'expiracao_pendente_minutos', q.expiracao_pendente_minutos,
            'valor_visitante', q.valor_visitante
          ) AS quadras,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'id', u.id,
              'nome', u.nome,
              'codigo_usuario', u.codigo_usuario,
              'categoria_socio', u.categoria_socio
            ) ORDER BY u.nome), '[]'::json)
            FROM reserva_participantes rp
            JOIN usuarios u ON u.id = rp.usuario_id
            WHERE rp.reserva_id = r.id
          ) AS participantes,
          CASE WHEN r.usuario_id <> v_user.id THEN
            json_build_object('nome', tit.nome, 'codigo_usuario', tit.codigo_usuario)
          ELSE NULL END AS titular_reserva
        FROM reservas r
        JOIN quadras q ON q.id = r.quadra_id
        LEFT JOIN usuarios tit ON tit.id = r.usuario_id
        WHERE r.status IN ('pendente', 'confirmada', 'recusada')
          AND r.data_reserva >= app_hoje_brasil()
          AND (
            r.usuario_id = v_user.id
            OR EXISTS (
              SELECT 1 FROM reserva_participantes rp
              WHERE rp.reserva_id = r.id AND rp.usuario_id = v_user.id
            )
          )
        ORDER BY r.id, r.data_reserva, r.hora_inicio
      ) x
    ),
    '[]'::json
  );
END;
$$;

-- admin_criar_usuario: 4 dígitos, senha 6 do CPF
DROP FUNCTION IF EXISTS admin_criar_usuario(text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION admin_criar_usuario(
  p_token text,
  p_codigo text,
  p_cpf text,
  p_nome text,
  p_email text,
  p_telefone text,
  p_perfil text DEFAULT 'usuario',
  p_tipo_socio text DEFAULT 'socio'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row usuarios%ROWTYPE;
  v_cpf text;
  v_telefone text;
  v_email text;
  v_categoria text;
  v_titular_id uuid;
  v_codigo_titular text;
BEGIN
  PERFORM app_require_admin(p_token);

  v_cpf := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
  v_telefone := regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g');
  v_email := lower(trim(COALESCE(p_email, '')));

  IF COALESCE(p_tipo_socio, 'socio') = 'socio' THEN
    IF p_codigo IS NULL OR p_codigo !~ '^\d{4}$' THEN
      RAISE EXCEPTION 'Código de sócio deve ter 4 dígitos (ex.: 1660 titular, 1661 dependente)' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF p_codigo IS NULL OR p_codigo !~ '^\d{6}$' THEN
      RAISE EXCEPTION 'Código de visitante deve ter 6 dígitos' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF length(v_cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF deve ter 11 dígitos' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(p_tipo_socio, 'socio') NOT IN ('socio', 'nao_socio') THEN
    RAISE EXCEPTION 'Tipo de sócio inválido' USING ERRCODE = 'P0001';
  END IF;

  v_categoria := app_categoria_from_codigo(p_codigo, COALESCE(p_tipo_socio, 'socio'));
  v_titular_id := NULL;

  IF v_categoria = 'dependente' THEN
    v_codigo_titular := app_codigo_titular(p_codigo);
    SELECT id INTO v_titular_id FROM usuarios WHERE codigo_usuario = v_codigo_titular LIMIT 1;
  END IF;

  INSERT INTO usuarios (
    codigo_usuario, cpf, nome, email, telefone, perfil, tipo_socio,
    categoria_socio, titular_id, senha_hash
  )
  VALUES (
    p_codigo, v_cpf, trim(p_nome), v_email, v_telefone,
    COALESCE(p_perfil, 'usuario'),
    COALESCE(p_tipo_socio, 'socio'),
    v_categoria,
    v_titular_id,
    crypt(left(v_cpf, 6), gen_salt('bf'))
  )
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id', v_row.id,
    'codigo_usuario', v_row.codigo_usuario,
    'cpf', v_row.cpf,
    'nome', v_row.nome,
    'email', v_row.email,
    'telefone', v_row.telefone,
    'perfil', v_row.perfil,
    'tipo_socio', v_row.tipo_socio,
    'categoria_socio', v_row.categoria_socio,
    'titular_id', v_row.titular_id,
    'ativo', v_row.ativo,
    'criado_em', v_row.criado_em
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Código de usuário ou CPF já cadastrado.' USING ERRCODE = 'P0001';
END;
$$;

-- admin_listar_usuarios: inclui categoria
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
        SELECT id, codigo_usuario, cpf, nome, email, telefone, perfil,
               tipo_socio, categoria_socio, titular_id, ativo, criado_em
        FROM usuarios
      ) u
    ),
    '[]'::json
  );
END;
$$;

-- admin_atualizar_usuario: recalcula categoria se código mudar
CREATE OR REPLACE FUNCTION admin_atualizar_usuario(
  p_token text,
  p_id uuid,
  p_nome text DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL,
  p_perfil text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_tipo_socio text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row usuarios%ROWTYPE;
  v_cpf text;
  v_telefone text;
  v_email text;
BEGIN
  PERFORM app_require_admin(p_token);

  IF p_tipo_socio IS NOT NULL AND p_tipo_socio NOT IN ('socio', 'nao_socio') THEN
    RAISE EXCEPTION 'Tipo de sócio inválido' USING ERRCODE = 'P0001';
  END IF;

  UPDATE usuarios
  SET
    nome = COALESCE(NULLIF(trim(p_nome), ''), nome),
    cpf = CASE WHEN p_cpf IS NULL THEN cpf ELSE NULLIF(regexp_replace(p_cpf, '\D', '', 'g'), '') END,
    telefone = CASE WHEN p_telefone IS NULL THEN telefone ELSE NULLIF(regexp_replace(p_telefone, '\D', '', 'g'), '') END,
    email = CASE WHEN p_email IS NULL THEN email ELSE NULLIF(lower(trim(p_email)), '') END,
    ativo = COALESCE(p_ativo, ativo),
    perfil = COALESCE(p_perfil, perfil),
    tipo_socio = COALESCE(p_tipo_socio, tipo_socio),
    categoria_socio = CASE
      WHEN COALESCE(p_tipo_socio, tipo_socio) = 'socio'
        THEN app_categoria_from_codigo(codigo_usuario, COALESCE(p_tipo_socio, tipo_socio))
      ELSE NULL
    END
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_row.ativo THEN
    DELETE FROM sessoes WHERE usuario_id = v_row.id;
  END IF;

  RETURN json_build_object(
    'id', v_row.id,
    'codigo_usuario', v_row.codigo_usuario,
    'cpf', v_row.cpf,
    'nome', v_row.nome,
    'email', v_row.email,
    'telefone', v_row.telefone,
    'perfil', v_row.perfil,
    'tipo_socio', v_row.tipo_socio,
    'categoria_socio', v_row.categoria_socio,
    'titular_id', v_row.titular_id,
    'ativo', v_row.ativo,
    'criado_em', v_row.criado_em
  );
END;
$$;

-- admin_atualizar_quadra: tipo_quadra
DROP FUNCTION IF EXISTS admin_atualizar_quadra(text, uuid, text, text, text, boolean, integer, numeric);

CREATE OR REPLACE FUNCTION admin_atualizar_quadra(
  p_token text,
  p_id uuid,
  p_nome text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_tipo_esporte text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL,
  p_expiracao_pendente_minutos integer DEFAULT NULL,
  p_valor_visitante numeric DEFAULT NULL,
  p_tipo_quadra text DEFAULT NULL
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

  IF p_tipo_quadra IS NOT NULL AND p_tipo_quadra NOT IN ('socio', 'locacao', 'geral') THEN
    RAISE EXCEPTION 'Tipo de quadra inválido' USING ERRCODE = 'P0001';
  END IF;

  IF p_expiracao_pendente_minutos IS NOT NULL
     AND (p_expiracao_pendente_minutos < 5 OR p_expiracao_pendente_minutos > 10080) THEN
    RAISE EXCEPTION 'Expiração de reserva pendente deve ser entre 5 minutos e 7 dias.' USING ERRCODE = 'P0001';
  END IF;

  IF p_valor_visitante IS NOT NULL AND p_valor_visitante < 0 THEN
    RAISE EXCEPTION 'Valor para visitante não pode ser negativo.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE quadras
  SET
    nome = COALESCE(NULLIF(trim(p_nome), ''), nome),
    descricao = CASE WHEN p_descricao IS NULL THEN descricao ELSE NULLIF(trim(p_descricao), '') END,
    tipo_esporte = CASE WHEN p_tipo_esporte IS NULL THEN tipo_esporte ELSE NULLIF(trim(p_tipo_esporte), '') END,
    ativo = COALESCE(p_ativo, ativo),
    expiracao_pendente_minutos = COALESCE(p_expiracao_pendente_minutos, expiracao_pendente_minutos),
    valor_visitante = CASE WHEN p_valor_visitante IS NULL THEN valor_visitante ELSE p_valor_visitante END,
    tipo_quadra = COALESCE(p_tipo_quadra, tipo_quadra)
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quadra não encontrada' USING ERRCODE = 'P0001';
  END IF;

  RETURN row_to_json(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION admin_criar_quadra(
  p_token text,
  p_nome text,
  p_descricao text DEFAULT NULL,
  p_tipo_esporte text DEFAULT NULL,
  p_expiracao_pendente_minutos integer DEFAULT 60,
  p_valor_visitante numeric DEFAULT NULL,
  p_tipo_quadra text DEFAULT 'geral'
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

  IF p_tipo_quadra IS NOT NULL AND p_tipo_quadra NOT IN ('socio', 'locacao', 'geral') THEN
    RAISE EXCEPTION 'Tipo de quadra inválido' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO quadras (nome, descricao, tipo_esporte, expiracao_pendente_minutos, valor_visitante, tipo_quadra)
  VALUES (
    trim(p_nome),
    NULLIF(trim(p_descricao), ''),
    NULLIF(trim(p_tipo_esporte), ''),
    COALESCE(p_expiracao_pendente_minutos, 60),
    p_valor_visitante,
    COALESCE(p_tipo_quadra, 'geral')
  )
  RETURNING * INTO v_row;

  FOR v_dia IN 0..6 LOOP
    INSERT INTO horarios_quadra (quadra_id, dia_semana, hora_inicio, hora_fim, intervalo_min)
    VALUES (v_row.id, v_dia, TIME '07:00', TIME '22:00', 60)
    ON CONFLICT (quadra_id, dia_semana) DO NOTHING;
  END LOOP;

  RETURN row_to_json(v_row);
END;
$$;

DROP FUNCTION IF EXISTS admin_criar_quadra(text, text, text, text, integer, numeric);

-- Liberação quadra locação para sócios
CREATE OR REPLACE FUNCTION admin_liberar_quadra_socio(
  p_token text,
  p_quadra_id uuid,
  p_data date,
  p_hora_inicio time DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin usuarios%ROWTYPE;
  v_row liberacoes_quadra_locacao%ROWTYPE;
  v_tipo text;
BEGIN
  v_admin := app_require_admin(p_token);

  SELECT tipo_quadra INTO v_tipo FROM quadras WHERE id = p_quadra_id;
  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'Quadra não encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF v_tipo <> 'locacao' THEN
    RAISE EXCEPTION 'Liberação só se aplica a quadras de locação.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO liberacoes_quadra_locacao (quadra_id, data_reserva, hora_inicio, criado_por)
  VALUES (p_quadra_id, p_data, p_hora_inicio, v_admin.id)
  ON CONFLICT (quadra_id, data_reserva, hora_inicio) DO NOTHING
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    SELECT * INTO v_row FROM liberacoes_quadra_locacao
    WHERE quadra_id = p_quadra_id AND data_reserva = p_data
      AND hora_inicio IS NOT DISTINCT FROM p_hora_inicio;
  END IF;

  RETURN row_to_json(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION admin_listar_liberacoes_quadra(
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
      SELECT json_agg(row_to_json(x) ORDER BY x.data_reserva, x.hora_inicio NULLS FIRST)
      FROM (
        SELECT l.*, q.nome AS quadra_nome
        FROM liberacoes_quadra_locacao l
        JOIN quadras q ON q.id = l.quadra_id
        WHERE (p_quadra_id IS NULL OR l.quadra_id = p_quadra_id)
          AND (p_data IS NULL OR l.data_reserva = p_data)
          AND l.data_reserva >= app_hoje_brasil()
      ) x
    ),
    '[]'::json
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_revogar_liberacao_quadra(
  p_token text,
  p_liberacao_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM app_require_admin(p_token);

  DELETE FROM liberacoes_quadra_locacao WHERE id = p_liberacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liberação não encontrada' USING ERRCODE = 'P0001';
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

-- Grants
REVOKE ALL ON FUNCTION criar_reserva(text, uuid, date, time, time, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION criar_reserva(text, uuid, date, time, time, uuid[]) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_criar_reserva(text, uuid, uuid, date, time, time, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_criar_reserva(text, uuid, uuid, date, time, time, uuid[]) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_alterar_senha_usuario(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_alterar_senha_usuario(text, uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION buscar_socios(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buscar_socios(text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_liberar_quadra_socio(text, uuid, date, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_liberar_quadra_socio(text, uuid, date, time) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_listar_liberacoes_quadra(text, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_listar_liberacoes_quadra(text, uuid, date) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_revogar_liberacao_quadra(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_revogar_liberacao_quadra(text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_criar_quadra(text, text, text, text, integer, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_criar_quadra(text, text, text, text, integer, numeric, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_atualizar_quadra(text, uuid, text, text, text, boolean, integer, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_atualizar_quadra(text, uuid, text, text, text, boolean, integer, numeric, text) TO anon, authenticated;
