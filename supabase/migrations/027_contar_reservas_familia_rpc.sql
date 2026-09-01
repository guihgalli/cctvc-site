-- Migration 027: expõe contagem semanal de reservas da família para validação no app

CREATE OR REPLACE FUNCTION contar_reservas_familia_semana(p_token text, p_data date)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user usuarios%ROWTYPE;
BEGIN
  v_user := app_require_usuario(p_token);

  IF v_user.tipo_socio <> 'socio' THEN
    RETURN 0;
  END IF;

  RETURN app_contar_reservas_familia_semana(v_user.id, p_data);
END;
$$;

REVOKE ALL ON FUNCTION contar_reservas_familia_semana(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION contar_reservas_familia_semana(text, date) TO anon, authenticated;
