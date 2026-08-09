-- =============================================================================
-- Migration: senha própria (hash) + RPC alterar_senha
-- Desacopla a senha dos 3 primeiros dígitos do CPF.
-- Senha inicial dos usuários existentes / novos = 3 primeiros dígitos do CPF.
-- Execute no SQL Editor do Supabase após a 003_security_hardening.sql.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Coluna de senha (bcrypt via pgcrypto)
-- -----------------------------------------------------------------------------
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS senha_hash TEXT;

COMMENT ON COLUMN usuarios.senha_hash IS 'Hash bcrypt da senha (inicialmente 3 primeiros dígitos do CPF)';
COMMENT ON COLUMN usuarios.cpf IS 'CPF completo (11 dígitos). Independente da senha após o cadastro.';

-- Backfill: usuários sem hash recebem senha = left(cpf, 3)
UPDATE usuarios
SET senha_hash = crypt(left(cpf, 3), gen_salt('bf'))
WHERE senha_hash IS NULL
  AND cpf IS NOT NULL
  AND length(cpf) >= 3;

ALTER TABLE usuarios
  ALTER COLUMN senha_hash SET NOT NULL;

-- -----------------------------------------------------------------------------
-- Login: valida senha_hash (mantém UX código 6 + senha 3 dígitos)
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
    -- Hash dummy fixo: força custo bcrypt semelhante quando o usuário
    -- não existe / está inativo (reduz oracle de timing).
    PERFORM crypt(
      p_senha,
      '$2a$06$dZzOtKcscL4pUx1Is0mVk.OUrGO.B5Ya7t53lgAoQALAeHfawXqKi'
    );
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

-- -----------------------------------------------------------------------------
-- Usuário logado altera a própria senha
-- - exige senha atual
-- - rate limit (5 falhas / 15 min) — evita brute-force do PIN via sessão roubada
-- - rotaciona o token da sessão (invalida a sessão antiga e todas as outras)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION alterar_senha(
  p_token text,
  p_senha_atual text,
  p_senha_nova text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_fails int;
  v_new_token text;
BEGIN
  v_user := app_require_usuario(p_token);

  DELETE FROM tentativas_login WHERE tentado_em < NOW() - INTERVAL '1 day';

  SELECT COUNT(*)::int INTO v_fails
  FROM tentativas_login
  WHERE codigo_usuario = v_user.codigo_usuario
    AND tentado_em > NOW() - INTERVAL '15 minutes';

  IF v_fails >= 5 THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde alguns minutos.' USING ERRCODE = 'P0001';
  END IF;

  IF p_senha_atual IS NULL OR p_senha_atual !~ '^\d{3}$'
     OR p_senha_nova IS NULL OR p_senha_nova !~ '^\d{3}$' THEN
    RAISE EXCEPTION 'A senha deve ter exatamente 3 dígitos numéricos.' USING ERRCODE = 'P0001';
  END IF;

  IF p_senha_atual IS NOT DISTINCT FROM p_senha_nova THEN
    RAISE EXCEPTION 'A nova senha deve ser diferente da senha atual.' USING ERRCODE = 'P0001';
  END IF;

  IF v_user.senha_hash IS NULL
     OR v_user.senha_hash IS DISTINCT FROM crypt(p_senha_atual, v_user.senha_hash) THEN
    INSERT INTO tentativas_login (codigo_usuario) VALUES (v_user.codigo_usuario);
    RAISE EXCEPTION 'Senha atual incorreta.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE usuarios
  SET senha_hash = crypt(p_senha_nova, gen_salt('bf'))
  WHERE id = v_user.id;

  DELETE FROM tentativas_login WHERE codigo_usuario = v_user.codigo_usuario;

  -- Invalida TODAS as sessões (inclui a atual) e emite novo token
  DELETE FROM sessoes WHERE usuario_id = v_user.id;
  v_new_token := app_new_token();
  INSERT INTO sessoes (token, usuario_id, expira_em)
  VALUES (v_new_token, v_user.id, NOW() + INTERVAL '7 days');

  RETURN json_build_object('ok', true, 'token', v_new_token);
END;
$$;

-- -----------------------------------------------------------------------------
-- Admin: criar usuário já com senha_hash (não retorna o hash)
-- -----------------------------------------------------------------------------
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

  INSERT INTO usuarios (codigo_usuario, cpf, nome, perfil, senha_hash)
  VALUES (
    p_codigo,
    v_cpf,
    trim(p_nome),
    COALESCE(p_perfil, 'usuario'),
    crypt(left(v_cpf, 3), gen_salt('bf'))
  )
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id', v_row.id,
    'codigo_usuario', v_row.codigo_usuario,
    'cpf', v_row.cpf,
    'nome', v_row.nome,
    'perfil', v_row.perfil,
    'ativo', v_row.ativo,
    'criado_em', v_row.criado_em
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Código de usuário ou CPF já cadastrado.' USING ERRCODE = 'P0001';
END;
$$;

-- Admin update: não vaza senha_hash no JSON
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

  IF v_row.ativo IS FALSE THEN
    DELETE FROM sessoes WHERE usuario_id = v_row.id;
  END IF;

  RETURN json_build_object(
    'id', v_row.id,
    'codigo_usuario', v_row.codigo_usuario,
    'cpf', v_row.cpf,
    'nome', v_row.nome,
    'perfil', v_row.perfil,
    'ativo', v_row.ativo,
    'criado_em', v_row.criado_em
  );
END;
$$;

-- Listagem admin já seleciona colunas explícitas (sem senha_hash) — reforço
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

-- -----------------------------------------------------------------------------
-- Grants (revoke PUBLIC primeiro — least privilege)
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION alterar_senha(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION fazer_login(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_criar_usuario(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_atualizar_usuario(text, uuid, text, text, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_listar_usuarios(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION alterar_senha(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fazer_login(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_criar_usuario(text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_atualizar_usuario(text, uuid, text, text, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_listar_usuarios(text) TO anon, authenticated;
