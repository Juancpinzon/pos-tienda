-- Tabla de rate limiting para Edge Functions
-- Solo accesible via service_role_key; sin RLS intencional.

CREATE TABLE IF NOT EXISTS rate_limits (
  id         BIGSERIAL    PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accion     TEXT         NOT NULL,  -- 'validar_codigo' | 'analizar_factura'
  creado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_accion_tiempo
  ON rate_limits (user_id, accion, creado_en DESC);
