-- Inclui dados do titular no JSON de usuário (login/sessão) e na listagem admin.

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
          'codigo_usuario', t.codigo_usuario
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
          u.ativo,
          u.criado_em,
          CASE
            WHEN u.titular_id IS NOT NULL THEN json_build_object(
              'nome', t.nome,
              'codigo_usuario', t.codigo_usuario
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
  v_titular json;
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

  SELECT CASE
    WHEN v_row.titular_id IS NOT NULL THEN json_build_object(
      'nome', t.nome,
      'codigo_usuario', t.codigo_usuario
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
    'ativo', v_row.ativo,
    'criado_em', v_row.criado_em
  );
END;
$$;
