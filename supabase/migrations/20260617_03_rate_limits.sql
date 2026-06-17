-- Tabla para rate limiting de Edge Functions
-- Solo accesible via service_role (sin políticas RLS públicas)
-- La Edge Function validar-codigo consulta registros de la última hora
-- y los acumula aquí. Registros viejos no se limpian automáticamente
-- pero tampoco afectan el funcionamiento (la query filtra por creado_en).

CREATE TABLE IF NOT EXISTS rate_limits (
  id        bigserial   PRIMARY KEY,
  user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accion    text        NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Índice para: WHERE user_id = $1 AND accion = $2 AND creado_en >= now() - interval '1 hour'
CREATE INDEX IF NOT EXISTS rate_limits_user_accion_ts
  ON rate_limits (user_id, accion, creado_en DESC);
