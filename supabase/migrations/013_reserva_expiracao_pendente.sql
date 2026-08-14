-- =============================================================================
-- Migration 013: Expiração configurável de reservas pendentes por quadra
-- Depende de: 008, 012
-- =============================================================================

ALTER TABLE quadras
  ADD COLUMN IF NOT EXISTS expiracao_pendente_minutos INTEGER NOT NULL DEFAULT 60
    CHECK (expiracao_pendente_minutos BETWEEN 5 AND 10080);

COMMENT ON COLUMN quadras.expiracao_pendente_minutos IS
  'Minutos até cancelar reserva pendente (não-sócio) e liberar o horário';

-- Cancela reservas pendentes cujo prazo de pagamento expirou
CREATE OR REPLACE FUNCTION expirar_reservas_pendentes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE reservas r
  SET status = 'cancelada'
  FROM quadras q
  WHERE r.quadra_id = q.id
    AND r.status = 'pendente'
    AND r.criado_em + (q.expiracao_pendente_minutos * interval '1 minute') <= NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION expirar_reservas_pendentes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expirar_reservas_pendentes() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- criar_reserva: expira pendentes antes de validar conflito de horário
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION criar_reserva(
  p_token text,
  p_quadra_id uuid,
  p_data date,
  p_hora_inicio time,
  p_hora_fim time
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_row reservas%ROWTYPE;
  v_status text;
  v_hoje date := app_hoje_brasil();
  v_agora time := app_agora_brasil();
BEGIN
  PERFORM expirar_reservas_pendentes();

  v_user := app_require_usuario(p_token);

  IF v_user.tipo_socio = 'nao_socio' THEN
    IF v_user.telefone IS NULL OR length(regexp_replace(v_user.telefone, '\D', '', 'g')) NOT IN (10, 11) THEN
      RAISE EXCEPTION 'Cadastre seu WhatsApp em Conta antes de solicitar uma reserva.' USING ERRCODE = 'P0001';
    END IF;
    v_status := 'pendente';
  ELSE
    v_status := 'confirmada';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM quadras WHERE id = p_quadra_id AND ativo = true) THEN
    RAISE EXCEPTION 'Quadra indisponível' USING ERRCODE = 'P0001';
  END IF;

  IF p_data < v_hoje THEN
    RAISE EXCEPTION 'Não é possível reservar datas passadas.' USING ERRCODE = 'P0001';
  END IF;

  IF p_data = v_hoje AND p_hora_inicio <= v_agora THEN
    RAISE EXCEPTION 'Não é possível reservar horários passados.' USING ERRCODE = 'P0001';
  END IF;

  IF p_data > v_hoje + 21 THEN
    RAISE EXCEPTION 'Data fora do período permitido para reservas.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT app_quadra_aberta(p_quadra_id, p_data, p_hora_inicio, p_hora_fim) THEN
    RAISE EXCEPTION 'Quadra fechada ou horário inválido neste dia.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO reservas (quadra_id, usuario_id, data_reserva, hora_inicio, hora_fim, status)
  VALUES (p_quadra_id, v_user.id, p_data, p_hora_inicio, p_hora_fim, v_status)
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Este horário já está reservado para esta quadra.' USING ERRCODE = 'P0001';
END;
$$;

-- ---------------------------------------------------------------------------
-- listar_reservas_quadra_data
-- ---------------------------------------------------------------------------
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
  PERFORM expirar_reservas_pendentes();

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

-- ---------------------------------------------------------------------------
-- listar_minhas_reservas
-- ---------------------------------------------------------------------------
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
            'expiracao_pendente_minutos', q.expiracao_pendente_minutos
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

-- ---------------------------------------------------------------------------
-- admin_listar_reservas
-- ---------------------------------------------------------------------------
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
      SELECT json_agg(row_to_json(x) ORDER BY x.data_reserva, x.hora_inicio)
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
            ELSE r.status IN ('pendente', 'confirmada')
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

-- ---------------------------------------------------------------------------
-- admin_aprovar_reserva: expira antes de aprovar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_aprovar_reserva(p_token text, p_reserva_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row reservas%ROWTYPE;
  v_user usuarios%ROWTYPE;
  v_quadra quadras%ROWTYPE;
BEGIN
  PERFORM expirar_reservas_pendentes();
  PERFORM app_require_admin(p_token);

  SELECT * INTO v_row FROM reservas WHERE id = p_reserva_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta reserva não está pendente.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT app_quadra_aberta(v_row.quadra_id, v_row.data_reserva, v_row.hora_inicio, v_row.hora_fim) THEN
    RAISE EXCEPTION 'Horário inválido ou quadra fechada.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE reservas SET status = 'confirmada' WHERE id = p_reserva_id
  RETURNING * INTO v_row;

  SELECT * INTO v_user FROM usuarios WHERE id = v_row.usuario_id;
  SELECT * INTO v_quadra FROM quadras WHERE id = v_row.quadra_id;

  RETURN json_build_object(
    'ok', true,
    'reserva', row_to_json(v_row),
    'telefone', v_user.telefone,
    'nome', v_user.nome,
    'quadra', v_quadra.nome
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Horário já confirmado para outra reserva.' USING ERRCODE = 'P0001';
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_criar_quadra / admin_atualizar_quadra
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_criar_quadra(
  p_token text,
  p_nome text,
  p_descricao text DEFAULT NULL,
  p_tipo_esporte text DEFAULT NULL,
  p_expiracao_pendente_minutos integer DEFAULT 60
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

  INSERT INTO quadras (nome, descricao, tipo_esporte, expiracao_pendente_minutos)
  VALUES (
    trim(p_nome),
    NULLIF(trim(p_descricao), ''),
    NULLIF(trim(p_tipo_esporte), ''),
    p_expiracao_pendente_minutos
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
  p_expiracao_pendente_minutos integer DEFAULT NULL
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

  UPDATE quadras
  SET
    nome = COALESCE(NULLIF(trim(p_nome), ''), nome),
    descricao = CASE WHEN p_descricao IS NULL THEN descricao ELSE NULLIF(trim(p_descricao), '') END,
    tipo_esporte = CASE WHEN p_tipo_esporte IS NULL THEN tipo_esporte ELSE NULLIF(trim(p_tipo_esporte), '') END,
    ativo = COALESCE(p_ativo, ativo),
    expiracao_pendente_minutos = COALESCE(p_expiracao_pendente_minutos, expiracao_pendente_minutos)
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quadra não encontrada' USING ERRCODE = 'P0001';
  END IF;

  RETURN row_to_json(v_row);
END;
$$;

REVOKE ALL ON FUNCTION criar_reserva(text, uuid, date, time, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION criar_reserva(text, uuid, date, time, time) TO anon, authenticated;

REVOKE ALL ON FUNCTION listar_reservas_quadra_data(text, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION listar_reservas_quadra_data(text, uuid, date) TO anon, authenticated;

REVOKE ALL ON FUNCTION listar_minhas_reservas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION listar_minhas_reservas(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_listar_reservas(text, uuid, date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_listar_reservas(text, uuid, date, boolean) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_aprovar_reserva(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_aprovar_reserva(text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_criar_quadra(text, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_criar_quadra(text, text, text, text, integer) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_atualizar_quadra(text, uuid, text, text, text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_atualizar_quadra(text, uuid, text, text, text, boolean, integer) TO anon, authenticated;
