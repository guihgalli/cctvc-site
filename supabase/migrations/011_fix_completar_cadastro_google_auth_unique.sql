-- =============================================================================
-- Migration 011: Corrige vínculo Google→sócio pelo CPF (auth_user_id duplicado)
-- Depende de: 009
-- =============================================================================
-- Ao vincular sócio existente, o perfil provisório ainda tinha auth_user_id
-- preenchido; o UPDATE no sócio violava usuarios_auth_user_id_key.

CREATE OR REPLACE FUNCTION completar_cadastro_google(p_token text, p_cpf text, p_telefone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current usuarios%ROWTYPE;
  v_socio usuarios%ROWTYPE;
  v_auth_id uuid;
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

  v_auth_id := v_current.auth_user_id;
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

    IF v_socio.auth_user_id IS NOT NULL AND v_socio.auth_user_id <> v_auth_id THEN
      RAISE EXCEPTION
        'Este CPF já está vinculado a outra conta Google. Contate a secretaria.'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_socio.codigo_usuario IS NULL OR v_socio.codigo_usuario !~ '^\d{6}$' THEN
      RAISE EXCEPTION
        'Cadastro de sócio incompleto (matrícula). Contate a secretaria.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Libera auth_user_id no perfil provisório antes de vincular ao sócio
    UPDATE usuarios
    SET auth_user_id = NULL
    WHERE id = v_current.id;

    UPDATE usuarios
    SET
      auth_user_id = v_auth_id,
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

-- Exclusão admin: remove também auth.users para permitir novo teste com Google
CREATE OR REPLACE FUNCTION admin_excluir_usuario(p_token text, p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin usuarios%ROWTYPE;
  v_target usuarios%ROWTYPE;
  v_admins_restantes int;
  v_auth_id uuid;
BEGIN
  v_admin := app_require_admin(p_token);

  IF p_id = v_admin.id THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_target FROM usuarios WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0001';
  END IF;

  IF v_target.perfil = 'admin' AND v_target.ativo THEN
    SELECT COUNT(*)::int INTO v_admins_restantes
    FROM usuarios
    WHERE perfil = 'admin'
      AND ativo = true
      AND id <> p_id;

    IF v_admins_restantes = 0 THEN
      RAISE EXCEPTION 'Não é possível excluir o último administrador ativo.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_auth_id := v_target.auth_user_id;

  DELETE FROM usuarios WHERE id = p_id;

  IF v_auth_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_auth_id;
  END IF;

  RETURN json_build_object('ok', true, 'id', p_id);
END;
$$;

REVOKE ALL ON FUNCTION completar_cadastro_google(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION completar_cadastro_google(text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_excluir_usuario(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_excluir_usuario(text, uuid) TO anon, authenticated;
