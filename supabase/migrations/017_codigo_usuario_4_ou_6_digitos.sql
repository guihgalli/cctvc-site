-- Permite código de sócio com 4 dígitos (titular/dependente) ou visitante com 6.
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_codigo_usuario_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_codigo_usuario_check
  CHECK (codigo_usuario ~ '^\d{4}$' OR codigo_usuario ~ '^\d{6}$');
