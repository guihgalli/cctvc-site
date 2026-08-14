-- =============================================================================
-- Migration 010: admin pode excluir usuário
-- Depende de: 003_security_hardening.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_excluir_usuario(p_token text, p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin usuarios%ROWTYPE;
  v_target usuarios%ROWTYPE;
  v_admins_restantes int;
BEGIN
  v_admin := app_require_admin(p_token);

  IF p_id = v_admin.id THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_target FROM usuarios WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0001';
  END IF;

  IF v_target.perfil = 'admin' AND v_target.ativo THEN
    SELECT COUNT(*)::int INTO v_admins_restantes
    FROM usuarios
    WHERE perfil = 'admin'
      AND ativo = true
      AND id <> p_id;

    IF v_admins_restantes = 0 THEN
      RAISE EXCEPTION 'Não é possível excluir o último administrador ativo.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  DELETE FROM usuarios WHERE id = p_id;

  RETURN json_build_object('ok', true, 'id', p_id);
END;
$$;

REVOKE ALL ON FUNCTION admin_excluir_usuario(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_excluir_usuario(text, uuid) TO anon, authenticated;
