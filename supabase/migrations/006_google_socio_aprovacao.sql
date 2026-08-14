-- =============================================================================
-- Migration 006: Login Google, sócio vs não-sócio, aprovação de reservas
-- Depende de: 003, 004, 005
-- Supabase Dashboard: Authentication → Providers → Google (habilitar)
-- Redirect URL: https://seu-dominio/auth/callback e http://localhost:5173/auth/callback
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Usuários: tipo de sócio + vínculo Google
-- -----------------------------------------------------------------------------
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_socio TEXT NOT NULL DEFAULT 'socio'
    CHECK (tipo_socio IN ('socio', 'nao_socio'));

COMMENT ON COLUMN usuarios.auth_user_id IS 'Vínculo com Supabase Auth (login Google)';
COMMENT ON COLUMN usuarios.tipo_socio IS 'socio = aprovação imediata | nao_socio = reserva pendente até pagamento';

UPDATE usuarios SET tipo_socio = 'socio' WHERE tipo_socio IS NULL;

-- Visitantes Google podem não ter CPF/código/senha
ALTER TABLE usuarios ALTER COLUMN codigo_usuario DROP NOT NULL;
ALTER TABLE usuarios ALTER COLUMN cpf DROP NOT NULL;
ALTER TABLE usuarios ALTER COLUMN senha_hash DROP NOT NULL;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_codigo_usuario_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_codigo
  ON usuarios(codigo_usuario) WHERE codigo_usuario IS NOT NULL;

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_cpf_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_cpf
  ON usuarios(cpf) WHERE cpf IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Reservas: status pendente / recusada
-- -----------------------------------------------------------------------------
ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_status_check;
ALTER TABLE reservas
  ADD CONSTRAINT reservas_status_check
  CHECK (status IN ('pendente', 'confirmada', 'recusada', 'cancelada'));

DROP INDEX IF EXISTS idx_reserva_sem_conflito;
CREATE UNIQUE INDEX idx_reserva_sem_conflito
  ON reservas(quadra_id, data_reserva, hora_inicio)
  WHERE status = 'confirmada';

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_gerar_codigo_visitante()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  LOOP
    v_code := '9' || lpad((floor(random() * 99999))::int::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM usuarios WHERE codigo_usuario = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

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
    'telefone', u.telefone,
    'email', u.email,
    'precisa_telefone', (
      u.tipo_socio = 'nao_socio'
      AND (u.telefone IS NULL OR length(regexp_replace(u.telefone, '\D', '', 'g')) NOT IN (10, 11))
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- Login legado: inclui tipo_socio no retorno
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

  IF FOUND AND v_user.ativo AND v_user.senha_hash IS NOT NULL THEN
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
  RETURN json_build_object('token', p_token, 'user', app_user_json(v_user));
END;
$$;

-- -----------------------------------------------------------------------------
-- Login Google (requer JWT Supabase Auth ativo na requisição)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fazer_login_google()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_id uuid;
  v_email text;
  v_nome text;
  v_user usuarios%ROWTYPE;
  v_token text;
BEGIN
  v_auth_id := auth.uid();
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Sessão Google inválida. Tente novamente.' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    lower(trim(email)),
    coalesce(
      nullif(trim(raw_user_meta_data->>'full_name'), ''),
      nullif(trim(raw_user_meta_data->>'name'), ''),
      split_part(email, '@', 1)
    )
  INTO v_email, v_nome
  FROM auth.users
  WHERE id = v_auth_id;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Conta Google sem e-mail. Use outra conta.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_user FROM usuarios WHERE auth_user_id = v_auth_id;

  IF NOT FOUND THEN
    SELECT * INTO v_user
    FROM usuarios
    WHERE email IS NOT NULL
      AND lower(trim(email)) = v_email
    ORDER BY CASE WHEN tipo_socio = 'socio' THEN 0 ELSE 1 END
    LIMIT 1;

    IF FOUND THEN
      IF v_user.auth_user_id IS NOT NULL AND v_user.auth_user_id <> v_auth_id THEN
        RAISE EXCEPTION
          'Este e-mail já está vinculado a outra conta Google. Contate a secretaria.'
          USING ERRCODE = 'P0001';
      END IF;

      IF v_user.tipo_socio = 'socio' THEN
        IF v_user.cpf IS NULL OR length(regexp_replace(v_user.cpf, '\D', '', 'g')) <> 11 THEN
          RAISE EXCEPTION
            'Cadastro de sócio incompleto (CPF). Contate a secretaria para vincular sua conta Google.'
            USING ERRCODE = 'P0001';
        END IF;
        IF v_user.codigo_usuario IS NULL OR v_user.codigo_usuario !~ '^\d{6}$' THEN
          RAISE EXCEPTION
            'Cadastro de sócio incompleto (matrícula). Contate a secretaria.'
            USING ERRCODE = 'P0001';
        END IF;
      END IF;

      UPDATE usuarios SET auth_user_id = v_auth_id WHERE id = v_user.id
      RETURNING * INTO v_user;
    ELSE
      INSERT INTO usuarios (
        codigo_usuario, cpf, nome, email, perfil, tipo_socio, auth_user_id, ativo
      ) VALUES (
        app_gerar_codigo_visitante(),
        NULL,
        v_nome,
        v_email,
        'usuario',
        'nao_socio',
        v_auth_id,
        true
      )
      RETURNING * INTO v_user;
    END IF;
  END IF;

  IF NOT v_user.ativo THEN
    RAISE EXCEPTION 'Usuário desativado. Contate a secretaria.' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM sessoes WHERE usuario_id = v_user.id AND expira_em < NOW();

  v_token := app_new_token();
  INSERT INTO sessoes (token, usuario_id, expira_em)
  VALUES (v_token, v_user.id, NOW() + INTERVAL '7 days');

  RETURN json_build_object('token', v_token, 'user', app_user_json(v_user));
END;
$$;

-- -----------------------------------------------------------------------------
-- Não-sócio: cadastrar telefone (WhatsApp)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION completar_telefone(p_token text, p_telefone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_telefone text;
BEGIN
  v_user := app_require_usuario(p_token);
  v_telefone := regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g');

  IF length(v_telefone) NOT IN (10, 11) THEN
    RAISE EXCEPTION 'Telefone deve ter 10 ou 11 dígitos (com DDD).' USING ERRCODE = 'P0001';
  END IF;

  UPDATE usuarios SET telefone = v_telefone WHERE id = v_user.id
  RETURNING * INTO v_user;

  RETURN json_build_object('ok', true, 'user', app_user_json(v_user));
END;
$$;

-- -----------------------------------------------------------------------------
-- Reservas: sócio confirma na hora; não-sócio fica pendente
-- -----------------------------------------------------------------------------
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
  v_status text;
BEGIN
  v_user := app_require_usuario(p_token);

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

  IF p_data < CURRENT_DATE THEN
    RAISE EXCEPTION 'Não é possível reservar datas passadas.' USING ERRCODE = 'P0001';
  END IF;

  IF p_data = CURRENT_DATE AND p_hora_inicio <= LOCALTIME THEN
    RAISE EXCEPTION 'Não é possível reservar horários passados.' USING ERRCODE = 'P0001';
  END IF;

  IF p_data > CURRENT_DATE + 21 THEN
    RAISE EXCEPTION 'Data fora do período permitido para reservas.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT app_quadra_aberta(p_quadra_id, p_data, p_hora_inicio, p_hora_fim) THEN
    RAISE EXCEPTION 'Quadra fechada ou horário inválido neste dia.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO reservas (quadra_id, usuario_id, data_reserva, hora_inicio, hora_fim, status)
  VALUES (p_quadra_id, v_user.id, p_data, p_hora_inicio, p_hora_fim, v_status)
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Este horário já está reservado para esta quadra.' USING ERRCODE = 'P0001';
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
          r.id, r.quadra_id, r.usuario_id, r.data_reserva,
          r.hora_inicio, r.hora_fim, r.status, r.criado_em,
          json_build_object('nome', q.nome, 'tipo_esporte', q.tipo_esporte) AS quadras
        FROM reservas r
        JOIN quadras q ON q.id = r.quadra_id
        WHERE r.usuario_id = v_user.id
          AND r.status IN ('pendente', 'confirmada', 'recusada')
          AND r.data_reserva >= CURRENT_DATE
      ) x
    ),
    '[]'::json
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_listar_reservas(
  p_token text,
  p_quadra_id uuid DEFAULT NULL,
  p_data date DEFAULT NULL,
  p_apenas_pendentes boolean DEFAULT false
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
          r.id, r.quadra_id, r.usuario_id, r.data_reserva,
          r.hora_inicio, r.hora_fim, r.status, r.criado_em,
          json_build_object('nome', q.nome) AS quadras,
          json_build_object(
            'nome', u.nome,
            'codigo_usuario', u.codigo_usuario,
            'telefone', u.telefone,
            'email', u.email,
            'tipo_socio', u.tipo_socio
          ) AS usuarios
        FROM reservas r
        JOIN quadras q ON q.id = r.quadra_id
        JOIN usuarios u ON u.id = r.usuario_id
        WHERE (
          CASE
            WHEN p_apenas_pendentes THEN r.status = 'pendente'
            ELSE r.status IN ('pendente', 'confirmada')
          END
        )
          AND (p_quadra_id IS NULL OR r.quadra_id = p_quadra_id)
          AND (p_data IS NULL OR r.data_reserva = p_data)
      ) x
    ),
    '[]'::json
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_aprovar_reserva(p_token text, p_reserva_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row reservas%ROWTYPE;
  v_user usuarios%ROWTYPE;
  v_quadra quadras%ROWTYPE;
BEGIN
  PERFORM app_require_admin(p_token);

  SELECT * INTO v_row FROM reservas WHERE id = p_reserva_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta reserva não está pendente.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT app_quadra_aberta(v_row.quadra_id, v_row.data_reserva, v_row.hora_inicio, v_row.hora_fim) THEN
    RAISE EXCEPTION 'Horário inválido ou quadra fechada.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE reservas SET status = 'confirmada' WHERE id = p_reserva_id
  RETURNING * INTO v_row;

  SELECT * INTO v_user FROM usuarios WHERE id = v_row.usuario_id;
  SELECT * INTO v_quadra FROM quadras WHERE id = v_row.quadra_id;

  RETURN json_build_object(
    'ok', true,
    'reserva', row_to_json(v_row),
    'telefone', v_user.telefone,
    'nome', v_user.nome,
    'quadra', v_quadra.nome
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Horário já confirmado para outra reserva.' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION admin_recusar_reserva(
  p_token text,
  p_reserva_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row reservas%ROWTYPE;
BEGIN
  PERFORM app_require_admin(p_token);

  UPDATE reservas
  SET status = 'recusada'
  WHERE id = p_reserva_id AND status = 'pendente'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva pendente não encontrada.' USING ERRCODE = 'P0001';
  END IF;

  RETURN json_build_object('ok', true, 'id', v_row.id, 'motivo', p_motivo);
END;
$$;

-- -----------------------------------------------------------------------------
-- Admin usuários: tipo_socio
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
        SELECT id, codigo_usuario, cpf, nome, email, telefone, perfil, tipo_socio, ativo, criado_em
        FROM usuarios
      ) u
    ),
    '[]'::json
  );
END;
$$;

DROP FUNCTION IF EXISTS admin_criar_usuario(text, text, text, text, text, text, text);

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
BEGIN
  PERFORM app_require_admin(p_token);

  v_cpf := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
  v_telefone := regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g');
  v_email := lower(trim(COALESCE(p_email, '')));

  IF p_codigo IS NULL OR p_codigo !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'Código de usuário inválido' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF deve ter 11 dígitos' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(p_tipo_socio, 'socio') NOT IN ('socio', 'nao_socio') THEN
    RAISE EXCEPTION 'Tipo de sócio inválido' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO usuarios (codigo_usuario, cpf, nome, email, telefone, perfil, tipo_socio, senha_hash)
  VALUES (
    p_codigo, v_cpf, trim(p_nome), v_email, v_telefone,
    COALESCE(p_perfil, 'usuario'),
    COALESCE(p_tipo_socio, 'socio'),
    crypt(left(v_cpf, 3), gen_salt('bf'))
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
    'ativo', v_row.ativo,
    'criado_em', v_row.criado_em
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Código de usuário ou CPF já cadastrado.' USING ERRCODE = 'P0001';
END;
$$;

DROP FUNCTION IF EXISTS admin_atualizar_usuario(text, uuid, text, text, boolean, text, text, text);

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
    cpf = COALESCE(regexp_replace(p_cpf, '\D', '', 'g'), cpf),
    ativo = COALESCE(p_ativo, ativo),
    perfil = COALESCE(p_perfil, perfil),
    email = COALESCE(lower(trim(p_email)), email),
    telefone = COALESCE(regexp_replace(p_telefone, '\D', '', 'g'), telefone),
    tipo_socio = COALESCE(p_tipo_socio, tipo_socio)
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.ativo IS FALSE THEN
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
    'ativo', v_row.ativo,
    'criado_em', v_row.criado_em
  );
END;
$$;

-- Permissões
REVOKE ALL ON FUNCTION fazer_login_google() FROM PUBLIC;
REVOKE ALL ON FUNCTION completar_telefone(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_aprovar_reserva(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_recusar_reserva(text, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION fazer_login_google() TO authenticated;
GRANT EXECUTE ON FUNCTION completar_telefone(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_aprovar_reserva(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_recusar_reserva(text, uuid, text) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION admin_criar_usuario(text, text, text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_atualizar_usuario(text, uuid, text, text, boolean, text, text, text, text) TO anon, authenticated;
