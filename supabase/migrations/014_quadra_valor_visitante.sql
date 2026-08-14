-- =============================================================================
-- Migration 014: Valor para visitantes (não-sócios) por quadra
-- Depende de: 013
-- =============================================================================

ALTER TABLE quadras
  ADD COLUMN IF NOT EXISTS valor_visitante NUMERIC(10, 2)
    CHECK (valor_visitante IS NULL OR valor_visitante >= 0);

COMMENT ON COLUMN quadras.valor_visitante IS
  'Valor cobrado por reserva de visitante (não-sócio) nesta quadra, em reais';

-- listar_minhas_reservas: incluir valor da quadra
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
        SELECT
          r.id, r.quadra_id, r.usuario_id, r.data_reserva,
          r.hora_inicio, r.hora_fim, r.status, r.criado_em,
          json_build_object(
            'nome', q.nome,
            'tipo_esporte', q.tipo_esporte,
            'expiracao_pendente_minutos', q.expiracao_pendente_minutos,
            'valor_visitante', q.valor_visitante
          ) AS quadras
        FROM reservas r
        JOIN quadras q ON q.id = r.quadra_id
        WHERE r.usuario_id = v_user.id
          AND r.status IN ('pendente', 'confirmada', 'recusada')
          AND r.data_reserva >= app_hoje_brasil()
      ) x
    ),
    '[]'::json
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_criar_quadra(
  p_token text,
  p_nome text,
  p_descricao text DEFAULT NULL,
  p_tipo_esporte text DEFAULT NULL,
  p_expiracao_pendente_minutos integer DEFAULT 60,
  p_valor_visitante numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row quadras%ROWTYPE;
  v_dia int;
BEGIN
  PERFORM app_require_admin(p_token);

  IF p_nome IS NULL OR length(trim(p_nome)) = 0 THEN
    RAISE EXCEPTION 'Nome da quadra é obrigatório' USING ERRCODE = 'P0001';
  END IF;

  IF p_expiracao_pendente_minutos IS NULL
     OR p_expiracao_pendente_minutos < 5
     OR p_expiracao_pendente_minutos > 10080 THEN
    RAISE EXCEPTION 'Expiração de reserva pendente deve ser entre 5 minutos e 7 dias.' USING ERRCODE = 'P0001';
  END IF;

  IF p_valor_visitante IS NOT NULL AND p_valor_visitante < 0 THEN
    RAISE EXCEPTION 'Valor para visitante não pode ser negativo.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO quadras (nome, descricao, tipo_esporte, expiracao_pendente_minutos, valor_visitante)
  VALUES (
    trim(p_nome),
    NULLIF(trim(p_descricao), ''),
    NULLIF(trim(p_tipo_esporte), ''),
    p_expiracao_pendente_minutos,
    p_valor_visitante
  )
  RETURNING * INTO v_row;

  FOR v_dia IN 0..6 LOOP
    INSERT INTO horarios_quadra (quadra_id, dia_semana, hora_inicio, hora_fim, intervalo_min)
    VALUES (v_row.id, v_dia, TIME '07:00', TIME '22:00', 60)
    ON CONFLICT (quadra_id, dia_semana) DO NOTHING;
  END LOOP;

  RETURN row_to_json(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION admin_atualizar_quadra(
  p_token text,
  p_id uuid,
  p_nome text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_tipo_esporte text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL,
  p_expiracao_pendente_minutos integer DEFAULT NULL,
  p_valor_visitante numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row quadras%ROWTYPE;
BEGIN
  PERFORM app_require_admin(p_token);

  IF p_expiracao_pendente_minutos IS NOT NULL
     AND (p_expiracao_pendente_minutos < 5 OR p_expiracao_pendente_minutos > 10080) THEN
    RAISE EXCEPTION 'Expiração de reserva pendente deve ser entre 5 minutos e 7 dias.' USING ERRCODE = 'P0001';
  END IF;

  IF p_valor_visitante IS NOT NULL AND p_valor_visitante < 0 THEN
    RAISE EXCEPTION 'Valor para visitante não pode ser negativo.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE quadras
  SET
    nome = COALESCE(NULLIF(trim(p_nome), ''), nome),
    descricao = CASE WHEN p_descricao IS NULL THEN descricao ELSE NULLIF(trim(p_descricao), '') END,
    tipo_esporte = CASE WHEN p_tipo_esporte IS NULL THEN tipo_esporte ELSE NULLIF(trim(p_tipo_esporte), '') END,
    ativo = COALESCE(p_ativo, ativo),
    expiracao_pendente_minutos = COALESCE(p_expiracao_pendente_minutos, expiracao_pendente_minutos),
    valor_visitante = CASE WHEN p_valor_visitante IS NULL THEN valor_visitante ELSE p_valor_visitante END
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quadra não encontrada' USING ERRCODE = 'P0001';
  END IF;

  RETURN row_to_json(v_row);
END;
$$;

REVOKE ALL ON FUNCTION listar_minhas_reservas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION listar_minhas_reservas(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_criar_quadra(text, text, text, text, integer, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_criar_quadra(text, text, text, text, integer, numeric) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_atualizar_quadra(text, uuid, text, text, text, boolean, integer, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_atualizar_quadra(text, uuid, text, text, text, boolean, integer, numeric) TO anon, authenticated;
