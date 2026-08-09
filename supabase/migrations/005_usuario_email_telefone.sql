-- =============================================================================
-- Contato do usuário: email e telefone
-- Depende de 004_alterar_senha (senha_hash + RPCs admin sem vazar hash)
-- =============================================================================

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS telefone VARCHAR(11);

COMMENT ON COLUMN usuarios.email IS 'E-mail de contato do sócio';
COMMENT ON COLUMN usuarios.telefone IS 'Telefone com DDD (10 ou 11 dígitos)';

-- -----------------------------------------------------------------------------
-- Listagem admin: inclui email e telefone (sem senha_hash)
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
        SELECT id, codigo_usuario, cpf, nome, email, telefone, perfil, ativo, criado_em
        FROM usuarios
      ) u
    ),
    '[]'::json
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Criação: exige email e telefone; mantém senha_hash inicial do CPF
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS admin_criar_usuario(text, text, text, text, text);

CREATE OR REPLACE FUNCTION admin_criar_usuario(
  p_token text,
  p_codigo text,
  p_cpf text,
  p_nome text,
  p_email text,
  p_telefone text,
  p_perfil text DEFAULT 'usuario'
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
  IF p_nome IS NULL OR length(trim(p_nome)) = 0 THEN
    RAISE EXCEPTION 'Nome é obrigatório' USING ERRCODE = 'P0001';
  END IF;
  IF v_email IS NULL OR v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'E-mail inválido' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_telefone) NOT IN (10, 11) THEN
    RAISE EXCEPTION 'Telefone deve ter 10 ou 11 dígitos (com DDD)' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(p_perfil, 'usuario') NOT IN ('usuario', 'admin') THEN
    RAISE EXCEPTION 'Perfil inválido' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO usuarios (codigo_usuario, cpf, nome, email, telefone, perfil, senha_hash)
  VALUES (
    p_codigo,
    v_cpf,
    trim(p_nome),
    v_email,
    v_telefone,
    COALESCE(p_perfil, 'usuario'),
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
    'ativo', v_row.ativo,
    'criado_em', v_row.criado_em
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Código de usuário ou CPF já cadastrado.' USING ERRCODE = 'P0001';
END;
$$;

-- -----------------------------------------------------------------------------
-- Atualização: permite alterar email e telefone (sem vazar senha_hash)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS admin_atualizar_usuario(text, uuid, text, text, boolean, text);

CREATE OR REPLACE FUNCTION admin_atualizar_usuario(
  p_token text,
  p_id uuid,
  p_nome text DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL,
  p_perfil text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_telefone text DEFAULT NULL
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

  IF p_cpf IS NOT NULL THEN
    v_cpf := regexp_replace(p_cpf, '\D', '', 'g');
    IF length(v_cpf) <> 11 THEN
      RAISE EXCEPTION 'CPF deve ter 11 dígitos' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_email IS NOT NULL THEN
    v_email := lower(trim(p_email));
    IF v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'E-mail inválido' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_telefone IS NOT NULL THEN
    v_telefone := regexp_replace(p_telefone, '\D', '', 'g');
    IF length(v_telefone) NOT IN (10, 11) THEN
      RAISE EXCEPTION 'Telefone deve ter 10 ou 11 dígitos (com DDD)' USING ERRCODE = 'P0001';
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
    perfil = COALESCE(p_perfil, perfil),
    email = COALESCE(v_email, email),
    telefone = COALESCE(v_telefone, telefone)
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
    'ativo', v_row.ativo,
    'criado_em', v_row.criado_em
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_criar_usuario(text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_atualizar_usuario(text, uuid, text, text, boolean, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_listar_usuarios(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION admin_criar_usuario(text, text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_atualizar_usuario(text, uuid, text, text, boolean, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_listar_usuarios(text) TO anon, authenticated;
