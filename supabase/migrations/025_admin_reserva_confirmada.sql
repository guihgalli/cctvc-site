-- Migration 025: Reservas criadas pelo admin já nascem confirmadas (sem etapa de aprovação)

CREATE OR REPLACE FUNCTION admin_criar_reserva(
  p_token text,
  p_usuario_id uuid,
  p_quadra_id uuid,
  p_data date,
  p_hora_inicio time,
  p_hora_fim time,
  p_participantes uuid[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row reservas%ROWTYPE;
  v_user usuarios%ROWTYPE;
  v_participante uuid;
BEGIN
  PERFORM app_require_admin(p_token);
  PERFORM expirar_reservas_pendentes();

  SELECT * INTO v_user FROM usuarios WHERE id = p_usuario_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM quadras WHERE id = p_quadra_id AND ativo = true) THEN
    RAISE EXCEPTION 'Quadra indisponível' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO reservas (quadra_id, usuario_id, data_reserva, hora_inicio, hora_fim, status)
  VALUES (p_quadra_id, p_usuario_id, p_data, p_hora_inicio, p_hora_fim, 'confirmada')
  RETURNING * INTO v_row;

  IF p_participantes IS NOT NULL THEN
    FOREACH v_participante IN ARRAY p_participantes LOOP
      IF v_participante <> p_usuario_id THEN
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
