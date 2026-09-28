-- Promoções e mensagem personalizada da quadra de locação (editáveis no admin)

CREATE TABLE IF NOT EXISTS configuracoes_site (
  chave          TEXT PRIMARY KEY,
  valor          TEXT,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE configuracoes_site IS 'Textos/configurações do site editáveis pelo admin (chave/valor)';

CREATE TABLE IF NOT EXISTS promocoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        TEXT NOT NULL,
  mensagem      TEXT,
  quadra_id     UUID REFERENCES quadras(id) ON DELETE CASCADE,
  publico       TEXT NOT NULL DEFAULT 'todos' CHECK (publico IN ('todos', 'socios', 'visitantes')),
  data_inicio   DATE,
  data_fim      DATE,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT promocoes_periodo_chk CHECK (data_inicio IS NULL OR data_fim IS NULL OR data_fim >= data_inicio)
);

COMMENT ON TABLE promocoes IS 'Promoções/avisos exibidos na tela de reserva (quadra_id NULL = todas as quadras)';

ALTER TABLE configuracoes_site ENABLE ROW LEVEL SECURITY;
ALTER TABLE promocoes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.promocao_json(p promocoes)
RETURNS json
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'id', p.id,
    'titulo', p.titulo,
    'mensagem', p.mensagem,
    'quadra_id', p.quadra_id,
    'publico', p.publico,
    'data_inicio', p.data_inicio,
    'data_fim', p.data_fim,
    'ativo', p.ativo,
    'criado_em', p.criado_em
  );
$$;

-- Leitura pública (tela de reservas): mensagem de locação + promoções vigentes hoje (Brasília)
CREATE OR REPLACE FUNCTION public.listar_avisos_reserva()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  RETURN json_build_object(
    'mensagem_locacao',
    (SELECT NULLIF(trim(valor), '') FROM configuracoes_site WHERE chave = 'mensagem_locacao'),
    'promocoes',
    COALESCE(
      (
        SELECT json_agg(promocao_json(p) ORDER BY p.criado_em DESC)
        FROM promocoes p
        WHERE p.ativo = true
          AND (p.data_inicio IS NULL OR p.data_inicio <= v_hoje)
          AND (p.data_fim IS NULL OR p.data_fim >= v_hoje)
      ),
      '[]'::json
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_avisos_reserva() TO anon, authenticated;

-- Admin
CREATE OR REPLACE FUNCTION public.admin_listar_promocoes(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM app_require_admin(p_token);

  RETURN json_build_object(
    'mensagem_locacao',
    (SELECT NULLIF(trim(valor), '') FROM configuracoes_site WHERE chave = 'mensagem_locacao'),
    'promocoes',
    COALESCE(
      (SELECT json_agg(promocao_json(p) ORDER BY p.criado_em DESC) FROM promocoes p),
      '[]'::json
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_salvar_mensagem_locacao(p_token text, p_mensagem text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM app_require_admin(p_token);

  IF p_mensagem IS NULL OR trim(p_mensagem) = '' THEN
    DELETE FROM configuracoes_site WHERE chave = 'mensagem_locacao';
    RETURN;
  END IF;

  IF length(p_mensagem) > 2000 THEN
    RAISE EXCEPTION 'A mensagem deve ter no máximo 2000 caracteres.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO configuracoes_site (chave, valor, atualizado_em)
  VALUES ('mensagem_locacao', trim(p_mensagem), now())
  ON CONFLICT (chave) DO UPDATE
    SET valor = EXCLUDED.valor, atualizado_em = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_salvar_promocao(
  p_token text,
  p_id uuid,
  p_titulo text,
  p_mensagem text,
  p_quadra_id uuid,
  p_publico text,
  p_data_inicio date,
  p_data_fim date,
  p_ativo boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row promocoes%ROWTYPE;
  v_publico text := COALESCE(NULLIF(trim(p_publico), ''), 'todos');
BEGIN
  PERFORM app_require_admin(p_token);

  IF p_titulo IS NULL OR trim(p_titulo) = '' THEN
    RAISE EXCEPTION 'Informe o título da promoção.' USING ERRCODE = 'P0001';
  END IF;

  IF v_publico NOT IN ('todos', 'socios', 'visitantes') THEN
    RAISE EXCEPTION 'Público inválido.' USING ERRCODE = 'P0001';
  END IF;

  IF p_data_inicio IS NOT NULL AND p_data_fim IS NOT NULL AND p_data_fim < p_data_inicio THEN
    RAISE EXCEPTION 'A data final deve ser igual ou posterior à data inicial.' USING ERRCODE = 'P0001';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO promocoes (titulo, mensagem, quadra_id, publico, data_inicio, data_fim, ativo)
    VALUES (
      trim(p_titulo),
      NULLIF(trim(p_mensagem), ''),
      p_quadra_id,
      v_publico,
      p_data_inicio,
      p_data_fim,
      COALESCE(p_ativo, true)
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE promocoes
    SET
      titulo = trim(p_titulo),
      mensagem = NULLIF(trim(p_mensagem), ''),
      quadra_id = p_quadra_id,
      publico = v_publico,
      data_inicio = p_data_inicio,
      data_fim = p_data_fim,
      ativo = COALESCE(p_ativo, ativo)
    WHERE id = p_id
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Promoção não encontrada.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN promocao_json(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_excluir_promocao(p_token text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM app_require_admin(p_token);

  DELETE FROM promocoes WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promoção não encontrada.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
