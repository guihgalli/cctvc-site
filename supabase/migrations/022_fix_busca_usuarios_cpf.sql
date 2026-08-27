-- Evita cpf LIKE '%%' quando a busca não contém dígitos (retornava todos os usuários)
CREATE OR REPLACE FUNCTION admin_buscar_usuarios(p_token text, p_busca text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term text := trim(COALESCE(p_busca, ''));
  v_cpf_term text := regexp_replace(v_term, '\D', '', 'g');
BEGIN
  PERFORM app_require_admin(p_token);

  IF length(v_term) < 2 THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(x) ORDER BY x.nome)
      FROM (
        SELECT id, codigo_usuario, nome, categoria_socio, tipo_socio, ativo
        FROM usuarios
        WHERE ativo = true
          AND (
            nome ILIKE '%' || v_term || '%'
            OR codigo_usuario LIKE v_term || '%'
            OR (
              length(v_cpf_term) >= 2
              AND cpf LIKE '%' || v_cpf_term || '%'
            )
          )
        ORDER BY nome
        LIMIT 20
      ) x
    ),
    '[]'::json
  );
END;
$$;

-- Mesma correção de CPF na busca de participantes
CREATE OR REPLACE FUNCTION buscar_participantes_reserva(p_token text, p_busca text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_term text := trim(COALESCE(p_busca, ''));
  v_cpf_term text := regexp_replace(v_term, '\D', '', 'g');
BEGIN
  v_user := app_require_usuario(p_token);

  IF length(v_term) < 2 THEN
    RETURN COALESCE(
      (
        SELECT json_agg(row_to_json(x) ORDER BY x.nome)
        FROM (
          SELECT
            u.id,
            u.codigo_usuario,
            u.nome,
            u.categoria_socio,
            u.tipo_socio,
            true AS eh_dependente
          FROM usuarios u
          WHERE u.ativo = true
            AND u.id <> v_user.id
            AND u.titular_id = v_user.id
          ORDER BY u.nome
          LIMIT 30
        ) x
      ),
      '[]'::json
    );
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(x) ORDER BY x.eh_dependente DESC, x.nome)
      FROM (
        SELECT
          u.id,
          u.codigo_usuario,
          u.nome,
          u.categoria_socio,
          u.tipo_socio,
          (u.titular_id = v_user.id) AS eh_dependente
        FROM usuarios u
        WHERE u.ativo = true
          AND u.id <> v_user.id
          AND (
            u.nome ILIKE '%' || v_term || '%'
            OR u.codigo_usuario LIKE v_term || '%'
            OR (
              length(v_cpf_term) >= 2
              AND u.cpf LIKE '%' || v_cpf_term || '%'
            )
          )
        ORDER BY (u.titular_id = v_user.id) DESC, u.nome
        LIMIT 20
      ) x
    ),
    '[]'::json
  );
END;
$$;
