-- =============================================================================
-- Migration 007: Sócio também entra com Google se e-mail/CPF estiverem cadastrados
-- Depende de: 006_google_socio_aprovacao.sql
-- =============================================================================

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

  -- Já vinculado a este Google
  SELECT * INTO v_user FROM usuarios WHERE auth_user_id = v_auth_id;

  IF NOT FOUND THEN
    -- Vincular a cadastro existente pelo e-mail (prioriza sócio)
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

      -- Sócio: exige CPF e matrícula cadastrados pela secretaria
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

      UPDATE usuarios
      SET auth_user_id = v_auth_id
      WHERE id = v_user.id
      RETURNING * INTO v_user;
    ELSE
      -- E-mail não cadastrado → novo visitante (não-sócio)
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

COMMENT ON FUNCTION fazer_login_google IS
  'Login Google: vincula por e-mail a sócio (CPF+matrícula cadastrados) ou cria visitante se e-mail desconhecido';
