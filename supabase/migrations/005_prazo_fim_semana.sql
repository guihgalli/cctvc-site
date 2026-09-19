-- Prazo: reservas de sábado e domingo só até sexta-feira 17h (America/Sao_Paulo)

CREATE OR REPLACE FUNCTION public.app_prazo_fim_semana_ok(p_data date)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_dow int;
  v_sexta date;
  v_agora timestamp;
  v_limite timestamp;
BEGIN
  -- EXTRACT(DOW): 0=domingo … 6=sábado
  v_dow := EXTRACT(DOW FROM p_data)::int;
  IF v_dow NOT IN (0, 6) THEN
    RETURN true;
  END IF;

  v_sexta := p_data - CASE WHEN v_dow = 6 THEN 1 ELSE 2 END;
  v_agora := (NOW() AT TIME ZONE 'America/Sao_Paulo');
  v_limite := v_sexta::timestamp + TIME '17:00';

  RETURN v_agora < v_limite;
END;
$$;

COMMENT ON FUNCTION public.app_prazo_fim_semana_ok(date) IS
  'True se a data não é fim de semana, ou se ainda não passou sexta 17h do fim de semana correspondente';

CREATE OR REPLACE FUNCTION public.criar_reserva(
  p_token text,
  p_quadra_id uuid,
  p_data date,
  p_hora_inicio time without time zone,
  p_hora_fim time without time zone,
  p_participantes uuid[] DEFAULT NULL::uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_row reservas%ROWTYPE;
  v_status text;
  v_tipo_quadra text;
  v_hoje date := app_hoje_brasil();
  v_agora time := app_agora_brasil();
  v_participante uuid;
BEGIN
  PERFORM expirar_reservas_pendentes();

  v_user := app_require_usuario(p_token);

  IF v_user.perfil <> 'admin' THEN
    IF v_user.tipo_socio = 'socio' AND NOT v_user.ativo THEN
      RAISE EXCEPTION 'Há pendências financeiras em sua associação. Procure a secretaria do clube para regularizar antes de agendar.' USING ERRCODE = 'P0001';
    END IF;

    IF v_user.tipo_socio = 'socio'
       AND app_contar_reservas_familia_semana(v_user.id, p_data) >= 2 THEN
      RAISE EXCEPTION 'Sua família (titular e dependentes) pode agendar no máximo 2 vezes por semana (segunda a domingo).' USING ERRCODE = 'P0001';
    END IF;

    IF NOT app_quadra_permitida_usuario(v_user, p_quadra_id, p_data, p_hora_inicio) THEN
      RAISE EXCEPTION 'Esta quadra não está disponível para o seu perfil.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT tipo_quadra INTO v_tipo_quadra FROM quadras WHERE id = p_quadra_id;

  IF v_user.tipo_socio = 'nao_socio' THEN
    IF v_user.telefone IS NULL OR length(regexp_replace(v_user.telefone, '\D', '', 'g')) NOT IN (10, 11) THEN
      RAISE EXCEPTION 'Cadastre seu WhatsApp em Conta antes de solicitar uma reserva.' USING ERRCODE = 'P0001';
    END IF;
    v_status := 'pendente';
  ELSIF v_tipo_quadra = 'locacao' THEN
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

  IF v_user.perfil <> 'admin' AND NOT app_data_reservavel(p_data) THEN
    RAISE EXCEPTION 'Data fora do período liberado. A próxima semana abre aos domingos.' USING ERRCODE = 'P0001';
  END IF;

  IF v_user.perfil <> 'admin' AND NOT app_prazo_fim_semana_ok(p_data) THEN
    RAISE EXCEPTION 'Reservas de sábado e domingo devem ser solicitadas até sexta-feira às 17h. O prazo para este fim de semana já encerrou.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT app_quadra_aberta(p_quadra_id, p_data, p_hora_inicio, p_hora_fim) THEN
    RAISE EXCEPTION 'Quadra fechada ou horário inválido neste dia.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO reservas (quadra_id, usuario_id, data_reserva, hora_inicio, hora_fim, status)
  VALUES (p_quadra_id, v_user.id, p_data, p_hora_inicio, p_hora_fim, v_status)
  RETURNING * INTO v_row;

  IF p_participantes IS NOT NULL AND array_length(p_participantes, 1) > 0 THEN
    FOREACH v_participante IN ARRAY p_participantes LOOP
      IF v_participante = v_user.id THEN
        CONTINUE;
      END IF;
      IF EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = v_participante
          AND u.tipo_socio = 'socio'
          AND u.ativo = true
      ) THEN
        INSERT INTO reserva_participantes (reserva_id, usuario_id)
        VALUES (v_row.id, v_participante)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN row_to_json(v_row);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Este horário já está reservado para esta quadra.' USING ERRCODE = 'P0001';
END;
$$;
