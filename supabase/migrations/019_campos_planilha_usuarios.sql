-- Campos da planilha Relatorio_Associados_e_Dependentes.xlsx

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS matricula INTEGER,
  ADD COLUMN IF NOT EXISTS categoria_clube VARCHAR(50),
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS data_admissao DATE,
  ADD COLUMN IF NOT EXISTS parentesco VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sexo VARCHAR(1) CHECK (sexo IS NULL OR sexo IN ('F', 'M')),
  ADD COLUMN IF NOT EXISTS numero_dependente SMALLINT;

COMMENT ON COLUMN usuarios.matricula IS 'Matrícula do clube (coluna Matrícula da planilha)';
COMMENT ON COLUMN usuarios.categoria_clube IS 'Categoria do titular: CONTRIBUINTE, SOCIO, REMIDO';
COMMENT ON COLUMN usuarios.data_nascimento IS 'Data de nascimento do sócio ou dependente';
COMMENT ON COLUMN usuarios.data_admissao IS 'Data de admissão no clube (titular)';
COMMENT ON COLUMN usuarios.parentesco IS 'Parentesco do dependente (ESPOSA(O), FILHO(A), etc.)';
COMMENT ON COLUMN usuarios.sexo IS 'Sexo: F ou M';
COMMENT ON COLUMN usuarios.numero_dependente IS 'Número do dependente na família (coluna Dep)';

CREATE INDEX IF NOT EXISTS idx_usuarios_matricula ON usuarios(matricula);

CREATE OR REPLACE FUNCTION app_user_json(u usuarios)
RETURNS json
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT json_build_object(
    'id', u.id,
    'codigo_usuario', u.codigo_usuario,
    'nome', u.nome,
    'perfil', u.perfil,
    'tipo_socio', u.tipo_socio,
    'categoria_socio', u.categoria_socio,
    'matricula', u.matricula,
    'categoria_clube', u.categoria_clube,
    'data_nascimento', u.data_nascimento,
    'data_admissao', u.data_admissao,
    'parentesco', u.parentesco,
    'sexo', u.sexo,
    'numero_dependente', u.numero_dependente,
    'telefone', u.telefone,
    'email', u.email,
    'ativo', u.ativo,
    'inadimplente', (u.tipo_socio = 'socio' AND NOT u.ativo),
    'precisa_telefone', (
      u.tipo_socio = 'nao_socio'
      AND (u.telefone IS NULL OR length(regexp_replace(u.telefone, '\D', '', 'g')) NOT IN (10, 11))
    ),
    'titular', CASE
      WHEN u.titular_id IS NOT NULL THEN (
        SELECT json_build_object(
          'nome', t.nome,
          'codigo_usuario', t.codigo_usuario,
          'matricula', t.matricula,
          'categoria_clube', t.categoria_clube,
          'data_nascimento', t.data_nascimento,
          'data_admissao', t.data_admissao
        )
        FROM usuarios t
        WHERE t.id = u.titular_id
      )
      ELSE NULL
    END
  );
$$;

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
        SELECT
          u.id,
          u.codigo_usuario,
          u.cpf,
          u.nome,
          u.email,
          u.telefone,
          u.perfil,
          u.tipo_socio,
          u.categoria_socio,
          u.titular_id,
          u.matricula,
          u.categoria_clube,
          u.data_nascimento,
          u.data_admissao,
          u.parentesco,
          u.sexo,
          u.numero_dependente,
          u.ativo,
          u.criado_em,
          CASE
            WHEN u.titular_id IS NOT NULL THEN json_build_object(
              'nome', t.nome,
              'codigo_usuario', t.codigo_usuario,
              'matricula', t.matricula,
              'categoria_clube', t.categoria_clube,
              'data_nascimento', t.data_nascimento,
              'data_admissao', t.data_admissao
            )
            ELSE NULL
          END AS titular
        FROM usuarios u
        LEFT JOIN usuarios t ON t.id = u.titular_id
      ) u
    ),
    '[]'::json
  );
END;
$$;

DROP FUNCTION IF EXISTS admin_criar_usuario(text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION admin_criar_usuario(
  p_token text,
  p_codigo text,
  p_cpf text,
  p_nome text,
  p_email text,
  p_telefone text,
  p_perfil text DEFAULT 'usuario',
  p_tipo_socio text DEFAULT 'socio',
  p_matricula integer DEFAULT NULL,
  p_categoria_clube text DEFAULT NULL,
  p_data_nascimento date DEFAULT NULL,
  p_data_admissao date DEFAULT NULL,
  p_parentesco text DEFAULT NULL,
  p_sexo text DEFAULT NULL,
  p_numero_dependente smallint DEFAULT NULL
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
  v_sexo text;
BEGIN
  PERFORM app_require_admin(p_token);

  v_cpf := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
  v_telefone := regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g');
  v_email := lower(trim(COALESCE(p_email, '')));
  v_sexo := upper(trim(COALESCE(p_sexo, '')));
  IF v_sexo = '' THEN
    v_sexo := NULL;
  ELSIF v_sexo NOT IN ('F', 'M') THEN
    RAISE EXCEPTION 'Sexo inválido (use F ou M)' USING ERRCODE = 'P0001';
  END IF;

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
    categoria_socio, titular_id, senha_hash,
    matricula, categoria_clube, data_nascimento, data_admissao,
    parentesco, sexo, numero_dependente
  )
  VALUES (
    p_codigo, v_cpf, trim(p_nome), v_email, v_telefone,
    COALESCE(p_perfil, 'usuario'),
    COALESCE(p_tipo_socio, 'socio'),
    v_categoria,
    v_titular_id,
    crypt(left(v_cpf, 6), gen_salt('bf')),
    p_matricula,
    NULLIF(trim(p_categoria_clube), ''),
    p_data_nascimento,
    p_data_admissao,
    NULLIF(trim(p_parentesco), ''),
    v_sexo,
    p_numero_dependente
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
    'matricula', v_row.matricula,
    'categoria_clube', v_row.categoria_clube,
    'data_nascimento', v_row.data_nascimento,
    'data_admissao', v_row.data_admissao,
    'parentesco', v_row.parentesco,
    'sexo', v_row.sexo,
    'numero_dependente', v_row.numero_dependente,
    'ativo', v_row.ativo,
    'criado_em', v_row.criado_em
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Código de usuário ou CPF já cadastrado.' USING ERRCODE = 'P0001';
END;
$$;

DROP FUNCTION IF EXISTS admin_atualizar_usuario(text, uuid, text, text, boolean, text, text, text, text);

CREATE OR REPLACE FUNCTION admin_atualizar_usuario(
  p_token text,
  p_id uuid,
  p_nome text DEFAULT NULL,
  p_cpf text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL,
  p_perfil text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_tipo_socio text DEFAULT NULL,
  p_matricula integer DEFAULT NULL,
  p_categoria_clube text DEFAULT NULL,
  p_data_nascimento date DEFAULT NULL,
  p_data_admissao date DEFAULT NULL,
  p_parentesco text DEFAULT NULL,
  p_sexo text DEFAULT NULL,
  p_numero_dependente smallint DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row usuarios%ROWTYPE;
  v_titular json;
  v_sexo text;
BEGIN
  PERFORM app_require_admin(p_token);

  IF p_tipo_socio IS NOT NULL AND p_tipo_socio NOT IN ('socio', 'nao_socio') THEN
    RAISE EXCEPTION 'Tipo de sócio inválido' USING ERRCODE = 'P0001';
  END IF;

  v_sexo := upper(trim(COALESCE(p_sexo, '')));
  IF v_sexo = '' THEN
    v_sexo := NULL;
  ELSIF v_sexo NOT IN ('F', 'M') THEN
    RAISE EXCEPTION 'Sexo inválido (use F ou M)' USING ERRCODE = 'P0001';
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
    END,
    matricula = COALESCE(p_matricula, matricula),
    categoria_clube = CASE
      WHEN p_categoria_clube IS NULL THEN categoria_clube
      ELSE NULLIF(trim(p_categoria_clube), '')
    END,
    data_nascimento = COALESCE(p_data_nascimento, data_nascimento),
    data_admissao = COALESCE(p_data_admissao, data_admissao),
    parentesco = CASE
      WHEN p_parentesco IS NULL THEN parentesco
      ELSE NULLIF(trim(p_parentesco), '')
    END,
    sexo = CASE WHEN p_sexo IS NULL THEN sexo ELSE v_sexo END,
    numero_dependente = COALESCE(p_numero_dependente, numero_dependente)
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_row.ativo THEN
    DELETE FROM sessoes WHERE usuario_id = v_row.id;
  END IF;

  SELECT CASE
    WHEN v_row.titular_id IS NOT NULL THEN json_build_object(
      'nome', t.nome,
      'codigo_usuario', t.codigo_usuario,
      'matricula', t.matricula,
      'categoria_clube', t.categoria_clube,
      'data_nascimento', t.data_nascimento,
      'data_admissao', t.data_admissao
    )
    ELSE NULL
  END
  INTO v_titular
  FROM usuarios t
  WHERE t.id = v_row.titular_id;

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
    'titular', v_titular,
    'matricula', v_row.matricula,
    'categoria_clube', v_row.categoria_clube,
    'data_nascimento', v_row.data_nascimento,
    'data_admissao', v_row.data_admissao,
    'parentesco', v_row.parentesco,
    'sexo', v_row.sexo,
    'numero_dependente', v_row.numero_dependente,
    'ativo', v_row.ativo,
    'criado_em', v_row.criado_em
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_criar_usuario(
  text, text, text, text, text, text, text, text,
  integer, text, date, date, text, text, smallint
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_criar_usuario(
  text, text, text, text, text, text, text, text,
  integer, text, date, date, text, text, smallint
) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_atualizar_usuario(
  text, uuid, text, text, boolean, text, text, text, text,
  integer, text, date, date, text, text, smallint
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_atualizar_usuario(
  text, uuid, text, text, boolean, text, text, text, text,
  integer, text, date, date, text, text, smallint
) TO anon, authenticated;
