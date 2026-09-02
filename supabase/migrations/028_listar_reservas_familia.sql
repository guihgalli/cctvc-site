-- Migration 028: Minhas reservas inclui agendamentos da família (titular + dependentes)

CREATE OR REPLACE FUNCTION app_usuario_mesma_familia(p_usuario_id uuid, p_outro_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_titular uuid;
  v_titular_outro uuid;
BEGIN
  IF p_usuario_id = p_outro_id THEN
    RETURN true;
  END IF;

  v_titular := app_titular_id_familia(p_usuario_id);
  v_titular_outro := app_titular_id_familia(p_outro_id);

  RETURN v_titular IS NOT NULL AND v_titular = v_titular_outro;
END;
$$;

CREATE OR REPLACE FUNCTION listar_minhas_reservas(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
BEGIN
  PERFORM expirar_reservas_pendentes();

  v_user := app_require_usuario(p_token);

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(x) ORDER BY x.data_reserva, x.hora_inicio)
      FROM (
        SELECT DISTINCT ON (r.id)
          r.id, r.quadra_id, r.usuario_id, r.data_reserva,
          r.hora_inicio, r.hora_fim, r.status, r.criado_em,
          EXISTS (
            SELECT 1 FROM reserva_participantes rp
            WHERE rp.reserva_id = r.id AND rp.usuario_id = v_user.id
          ) AS participante,
          (
            r.usuario_id <> v_user.id
            AND v_user.tipo_socio = 'socio'
            AND app_usuario_mesma_familia(v_user.id, r.usuario_id)
          ) AS reserva_familiar,
          json_build_object(
            'nome', q.nome,
            'tipo_esporte', q.tipo_esporte,
            'tipo_quadra', q.tipo_quadra,
            'expiracao_pendente_minutos', q.expiracao_pendente_minutos,
            'valor_visitante', q.valor_visitante
          ) AS quadras,
          (
            SELECT COALESCE(json_agg(json_build_object(
              'id', u.id,
              'nome', u.nome,
              'codigo_usuario', u.codigo_usuario,
              'categoria_socio', u.categoria_socio
            ) ORDER BY u.nome), '[]'::json)
            FROM reserva_participantes rp
            JOIN usuarios u ON u.id = rp.usuario_id
            WHERE rp.reserva_id = r.id
          ) AS participantes,
          CASE WHEN r.usuario_id <> v_user.id THEN
            json_build_object('nome', tit.nome, 'codigo_usuario', tit.codigo_usuario)
          ELSE NULL END AS titular_reserva
        FROM reservas r
        JOIN quadras q ON q.id = r.quadra_id
        LEFT JOIN usuarios tit ON tit.id = r.usuario_id
        WHERE r.status IN ('pendente', 'confirmada', 'recusada')
          AND r.data_reserva >= app_hoje_brasil()
          AND (
            r.usuario_id = v_user.id
            OR EXISTS (
              SELECT 1 FROM reserva_participantes rp
              WHERE rp.reserva_id = r.id AND rp.usuario_id = v_user.id
            )
            OR (
              v_user.tipo_socio = 'socio'
              AND app_usuario_mesma_familia(v_user.id, r.usuario_id)
            )
          )
        ORDER BY r.id, r.data_reserva, r.hora_inicio
      ) x
    ),
    '[]'::json
  );
END;
$$;

REVOKE ALL ON FUNCTION app_usuario_mesma_familia(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION listar_minhas_reservas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_usuario_mesma_familia(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION listar_minhas_reservas(text) TO anon, authenticated;
