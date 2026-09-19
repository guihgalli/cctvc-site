-- Extrato diário por e-mail: destinatários, log e RPCs

CREATE TABLE extrato_destinatarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  nome          TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX extrato_destinatarios_email_lower_idx
  ON extrato_destinatarios (lower(trim(email)));

COMMENT ON TABLE extrato_destinatarios IS 'Destinatários do extrato diário de reservas (e-mail)';

CREATE TABLE extrato_envios_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enviado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  destinatarios   TEXT[] NOT NULL DEFAULT '{}',
  qtd_reservas    INT NOT NULL DEFAULT 0,
  ok              BOOLEAN NOT NULL,
  erro            TEXT,
  periodo_inicio  DATE,
  periodo_fim     DATE
);

COMMENT ON TABLE extrato_envios_log IS 'Histórico de envios do extrato diário';

ALTER TABLE extrato_destinatarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE extrato_envios_log ENABLE ROW LEVEL SECURITY;

-- Leitura interna (Edge Function com service_role)
CREATE OR REPLACE FUNCTION public.listar_extrato_destinatarios_ativos()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object('email', lower(trim(email)), 'nome', nome)
      ORDER BY lower(trim(email))
    ),
    '[]'::json
  )
  FROM extrato_destinatarios
  WHERE ativo = true;
$$;

CREATE OR REPLACE FUNCTION public.listar_reservas_extrato(p_inicio date, p_fim date)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    json_agg(row_to_json(x) ORDER BY x.data_reserva, x.quadra_nome, x.hora_inicio),
    '[]'::json
  )
  FROM (
    SELECT
      r.id,
      r.data_reserva,
      r.hora_inicio,
      r.hora_fim,
      r.status,
      q.nome AS quadra_nome,
      u.nome AS usuario_nome,
      u.codigo_usuario,
      u.telefone,
      u.tipo_socio
    FROM reservas r
    JOIN quadras q ON q.id = r.quadra_id
    JOIN usuarios u ON u.id = r.usuario_id
    WHERE r.data_reserva >= p_inicio
      AND r.data_reserva <= p_fim
      AND r.status IN ('pendente', 'confirmada')
  ) x;
$$;

CREATE OR REPLACE FUNCTION public.registrar_extrato_envio(
  p_destinatarios text[],
  p_qtd_reservas int,
  p_ok boolean,
  p_erro text DEFAULT NULL,
  p_periodo_inicio date DEFAULT NULL,
  p_periodo_fim date DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO extrato_envios_log (
    destinatarios, qtd_reservas, ok, erro, periodo_inicio, periodo_fim
  )
  VALUES (
    COALESCE(p_destinatarios, '{}'),
    COALESCE(p_qtd_reservas, 0),
    p_ok,
    p_erro,
    p_periodo_inicio,
    p_periodo_fim
  );
$$;

REVOKE ALL ON FUNCTION public.listar_extrato_destinatarios_ativos() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_reservas_extrato(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_extrato_envio(text[], int, boolean, text, date, date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.listar_extrato_destinatarios_ativos() TO service_role;
GRANT EXECUTE ON FUNCTION public.listar_reservas_extrato(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_extrato_envio(text[], int, boolean, text, date, date) TO service_role;

-- Admin CRUD
CREATE OR REPLACE FUNCTION public.admin_listar_extrato_destinatarios(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM app_require_admin(p_token);

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', d.id,
          'email', d.email,
          'nome', d.nome,
          'ativo', d.ativo,
          'criado_em', d.criado_em
        )
        ORDER BY lower(trim(d.email))
      )
      FROM extrato_destinatarios d
    ),
    '[]'::json
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adicionar_extrato_destinatario(
  p_token text,
  p_email text,
  p_nome text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_row extrato_destinatarios%ROWTYPE;
BEGIN
  PERFORM app_require_admin(p_token);

  IF v_email IS NULL OR v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Informe um e-mail válido.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO extrato_destinatarios (email, nome, ativo)
  VALUES (v_email, NULLIF(trim(p_nome), ''), true)
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id', v_row.id,
    'email', v_row.email,
    'nome', v_row.nome,
    'ativo', v_row.ativo,
    'criado_em', v_row.criado_em
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Este e-mail já está cadastrado.' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_atualizar_extrato_destinatario(
  p_token text,
  p_id uuid,
  p_email text DEFAULT NULL,
  p_nome text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row extrato_destinatarios%ROWTYPE;
  v_email text;
BEGIN
  PERFORM app_require_admin(p_token);

  v_email := CASE
    WHEN p_email IS NULL THEN NULL
    ELSE lower(trim(p_email))
  END;

  IF v_email IS NOT NULL AND (v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RAISE EXCEPTION 'Informe um e-mail válido.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE extrato_destinatarios
  SET
    email = COALESCE(v_email, email),
    nome = CASE
      WHEN p_nome IS NULL THEN nome
      ELSE NULLIF(trim(p_nome), '')
    END,
    ativo = COALESCE(p_ativo, ativo)
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Destinatário não encontrado.' USING ERRCODE = 'P0001';
  END IF;

  RETURN json_build_object(
    'id', v_row.id,
    'email', v_row.email,
    'nome', v_row.nome,
    'ativo', v_row.ativo,
    'criado_em', v_row.criado_em
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Este e-mail já está cadastrado.' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_excluir_extrato_destinatario(p_token text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM app_require_admin(p_token);

  DELETE FROM extrato_destinatarios WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Destinatário não encontrado.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_listar_extrato_envios_log(p_token text, p_limit int DEFAULT 20)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM app_require_admin(p_token);

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(x) ORDER BY x.enviado_em DESC)
      FROM (
        SELECT
          id,
          enviado_em,
          destinatarios,
          qtd_reservas,
          ok,
          erro,
          periodo_inicio,
          periodo_fim
        FROM extrato_envios_log
        ORDER BY enviado_em DESC
        LIMIT LEAST(GREATEST(p_limit, 1), 100)
      ) x
    ),
    '[]'::json
  );
END;
$$;
