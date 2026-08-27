-- Admin: buscar qualquer usuário ativo para reservas administrativas
CREATE OR REPLACE FUNCTION admin_buscar_usuarios(p_token text, p_busca text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term text := trim(COALESCE(p_busca, ''));
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
            OR cpf LIKE '%' || regexp_replace(v_term, '\D', '', 'g') || '%'
          )
        LIMIT 20
      ) x
    ),
    '[]'::json
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_buscar_usuarios(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_buscar_usuarios(text, text) TO anon, authenticated;
