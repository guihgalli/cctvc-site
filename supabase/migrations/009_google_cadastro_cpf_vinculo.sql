-- =============================================================================
-- Migration 009: Primeiro login Google pede CPF + telefone; vincula sócio pelo CPF
-- Depende de: 006, 007
-- =============================================================================

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
    'precisa_cadastro', (
      u.auth_user_id IS NOT NULL
      AND (
        u.cpf IS NULL
        OR length(regexp_replace(u.cpf, '\D', '', 'g')) <> 11
      )
    ),
    'precisa_telefone', (
      u.tipo_socio = 'nao_socio'
      AND u.auth_user_id IS NOT NULL
      AND u.cpf IS NOT NULL
      AND length(regexp_replace(u.cpf, '\D', '', 'g')) = 11
      AND (u.telefone IS NULL OR length(regexp_replace(u.telefone, '\D', '', 'g')) NOT IN (10, 11))
    )
  );
$$;

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
    -- Vincular automaticamente se o e-mail Google = e-mail do sócio cadastrado
    SELECT * INTO v_user
    FROM usuarios
    WHERE email IS NOT NULL
      AND lower(trim(email)) = v_email
      AND tipo_socio = 'socio'
    LIMIT 1;

    IF FOUND THEN
      IF v_user.auth_user_id IS NOT NULL AND v_user.auth_user_id <> v_auth_id THEN
        RAISE EXCEPTION
          'Este e-mail já está vinculado a outra conta Google. Contate a secretaria.'
          USING ERRCODE = 'P0001';
      END IF;

      IF v_user.cpf IS NULL OR length(regexp_replace(v_user.cpf, '\D', '', 'g')) <> 11 THEN
        RAISE EXCEPTION
          'Cadastro de sócio incompleto (CPF). Contate a secretaria.'
          USING ERRCODE = 'P0001';
      END IF;

      IF v_user.codigo_usuario IS NULL OR v_user.codigo_usuario !~ '^\d{6}$' THEN
        RAISE EXCEPTION
          'Cadastro de sócio incompleto (matrícula). Contate a secretaria.'
          USING ERRCODE = 'P0001';
      END IF;

      UPDATE usuarios
      SET auth_user_id = v_auth_id
      WHERE id = v_user.id
      RETURNING * INTO v_user;
    ELSE
      -- Primeiro acesso: perfil provisório até informar CPF e telefone
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

CREATE OR REPLACE FUNCTION completar_cadastro_google(p_token text, p_cpf text, p_telefone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current usuarios%ROWTYPE;
  v_socio usuarios%ROWTYPE;
  v_cpf text;
  v_telefone text;
BEGIN
  v_current := app_require_usuario(p_token);

  IF v_current.auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Cadastro disponível apenas após login com Google.' USING ERRCODE = 'P0001';
  END IF;

  IF v_current.cpf IS NOT NULL AND length(regexp_replace(v_current.cpf, '\D', '', 'g')) = 11 THEN
    RAISE EXCEPTION 'Cadastro já concluído.' USING ERRCODE = 'P0001';
  END IF;

  v_cpf := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
  v_telefone := regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g');

  IF length(v_cpf) <> 11 THEN
    RAISE EXCEPTION 'Informe um CPF válido com 11 dígitos.' USING ERRCODE = 'P0001';
  END IF;

  IF length(v_telefone) NOT IN (10, 11) THEN
    RAISE EXCEPTION 'Informe um WhatsApp válido com DDD (10 ou 11 dígitos).' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_socio
  FROM usuarios
  WHERE cpf = v_cpf
    AND tipo_socio = 'socio'
  LIMIT 1;

  IF FOUND THEN
    IF NOT v_socio.ativo THEN
      RAISE EXCEPTION 'Usuário desativado. Contate a secretaria.' USING ERRCODE = 'P0001';
    END IF;

    IF v_socio.auth_user_id IS NOT NULL AND v_socio.auth_user_id <> v_current.auth_user_id THEN
      RAISE EXCEPTION
        'Este CPF já está vinculado a outra conta Google. Contate a secretaria.'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_socio.codigo_usuario IS NULL OR v_socio.codigo_usuario !~ '^\d{6}$' THEN
      RAISE EXCEPTION
        'Cadastro de sócio incompleto (matrícula). Contate a secretaria.'
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE usuarios
    SET
      auth_user_id = v_current.auth_user_id,
      email = COALESCE(NULLIF(trim(email), ''), v_current.email),
      telefone = v_telefone
    WHERE id = v_socio.id
    RETURNING * INTO v_socio;

    IF v_current.id <> v_socio.id THEN
      DELETE FROM sessoes WHERE usuario_id = v_current.id;
      DELETE FROM usuarios WHERE id = v_current.id;
    END IF;

    UPDATE sessoes
    SET usuario_id = v_socio.id
    WHERE token = p_token;

    RETURN json_build_object('ok', true, 'token', p_token, 'user', app_user_json(v_socio));
  END IF;

  IF EXISTS (
    SELECT 1 FROM usuarios
    WHERE cpf = v_cpf AND id <> v_current.id
  ) THEN
    RAISE EXCEPTION 'CPF já cadastrado. Contate a secretaria.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE usuarios
  SET cpf = v_cpf, telefone = v_telefone
  WHERE id = v_current.id
  RETURNING * INTO v_current;

  RETURN json_build_object('ok', true, 'token', p_token, 'user', app_user_json(v_current));
END;
$$;

COMMENT ON FUNCTION completar_cadastro_google IS
  'Conclui primeiro acesso Google: vincula sócio existente pelo CPF ou cadastra visitante';

REVOKE ALL ON FUNCTION completar_cadastro_google(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION completar_cadastro_google(text, text, text) TO anon, authenticated;
