-- Inclui reservas recusadas e canceladas na listagem admin (quando não filtrar só pendentes)

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
  PERFORM expirar_reservas_pendentes();
  PERFORM app_require_admin(p_token);

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(x) ORDER BY x.data_reserva DESC, x.hora_inicio)
      FROM (
        SELECT
          r.id, r.quadra_id, r.usuario_id, r.data_reserva,
          r.hora_inicio, r.hora_fim, r.status, r.criado_em,
          json_build_object(
            'nome', q.nome,
            'expiracao_pendente_minutos', q.expiracao_pendente_minutos
          ) AS quadras,
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
            ELSE r.status IN ('pendente', 'confirmada', 'recusada', 'cancelada')
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

REVOKE ALL ON FUNCTION admin_listar_reservas(text, uuid, date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_listar_reservas(text, uuid, date, boolean) TO anon, authenticated;
