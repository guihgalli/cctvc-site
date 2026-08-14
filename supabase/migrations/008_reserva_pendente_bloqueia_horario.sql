-- =============================================================================
-- Migration 008: reservas pendentes também bloqueiam o horário
-- Depende de: 006_google_socio_aprovacao.sql
-- =============================================================================

-- Índice único: um slot por quadra/data/hora enquanto pendente ou confirmada
DROP INDEX IF EXISTS idx_reserva_sem_conflito;
CREATE UNIQUE INDEX idx_reserva_sem_conflito
  ON reservas(quadra_id, data_reserva, hora_inicio)
  WHERE status IN ('pendente', 'confirmada');

COMMENT ON INDEX idx_reserva_sem_conflito IS
  'Impede dupla reserva no mesmo horário (pendente ou confirmada)';

-- Grade de horários: exibir slots ocupados por reservas pendentes e confirmadas
CREATE OR REPLACE FUNCTION listar_reservas_quadra_data(
  p_token text,
  p_quadra_id uuid,
  p_data date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
BEGIN
  v_user := app_require_usuario(p_token);

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(x) ORDER BY x.hora_inicio)
      FROM (
        SELECT
          r.id,
          r.quadra_id,
          r.usuario_id,
          r.data_reserva,
          r.hora_inicio,
          r.hora_fim,
          r.status,
          r.criado_em,
          CASE
            WHEN v_user.perfil = 'admin' OR r.usuario_id = v_user.id THEN
              json_build_object(
                'nome', u.nome,
                'codigo_usuario', u.codigo_usuario
              )
            ELSE NULL
          END AS usuarios
        FROM reservas r
        JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.quadra_id = p_quadra_id
          AND r.data_reserva = p_data
          AND r.status IN ('pendente', 'confirmada')
      ) x
    ),
    '[]'::json
  );
END;
$$;
