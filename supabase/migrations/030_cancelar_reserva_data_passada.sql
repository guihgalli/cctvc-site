-- Migration 030: impede cancelamento de reservas em datas anteriores

CREATE OR REPLACE FUNCTION cancelar_reserva(p_token text, p_reserva_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
  v_row reservas%ROWTYPE;
BEGIN
  v_user := app_require_usuario(p_token);

  SELECT * INTO v_row FROM reservas WHERE id = p_reserva_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada' USING ERRCODE = 'P0001';
  END IF;

  IF v_user.perfil IS DISTINCT FROM 'admin' AND v_row.usuario_id IS DISTINCT FROM v_user.id THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  IF v_row.data_reserva < app_hoje_brasil() THEN
    RAISE EXCEPTION 'Não é possível cancelar reservas de datas anteriores.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE reservas
  SET status = 'cancelada'
  WHERE id = p_reserva_id
  RETURNING * INTO v_row;

  RETURN json_build_object('ok', true, 'id', v_row.id);
END;
$$;

REVOKE ALL ON FUNCTION cancelar_reserva(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancelar_reserva(text, uuid) TO anon, authenticated;
