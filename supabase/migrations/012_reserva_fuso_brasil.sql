-- =============================================================================
-- Migration 012: Validação de reservas no fuso America/Sao_Paulo
-- Depende de: 006
-- =============================================================================
-- Supabase Postgres usa UTC; horários de quadra são locais (Brasil).
-- CURRENT_DATE / LOCALTIME em UTC bloqueavam slots ainda válidos no horário local.

CREATE OR REPLACE FUNCTION app_hoje_brasil()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

CREATE OR REPLACE FUNCTION app_agora_brasil()
RETURNS time
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (NOW() AT TIME ZONE 'America/Sao_Paulo')::time;
$$;

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

CREATE OR REPLACE FUNCTION listar_minhas_reservas(p_token text)
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
      SELECT json_agg(row_to_json(x) ORDER BY x.data_reserva, x.hora_inicio)
      FROM (
        SELECT
          r.id, r.quadra_id, r.usuario_id, r.data_reserva,
          r.hora_inicio, r.hora_fim, r.status, r.criado_em,
          json_build_object('nome', q.nome, 'tipo_esporte', q.tipo_esporte) AS quadras
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

REVOKE ALL ON FUNCTION app_hoje_brasil() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_hoje_brasil() TO anon, authenticated;

REVOKE ALL ON FUNCTION app_agora_brasil() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_agora_brasil() TO anon, authenticated;

REVOKE ALL ON FUNCTION criar_reserva(text, uuid, date, time, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION criar_reserva(text, uuid, date, time, time) TO anon, authenticated;

REVOKE ALL ON FUNCTION listar_minhas_reservas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION listar_minhas_reservas(text) TO anon, authenticated;
