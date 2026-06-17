-- ══════════════════════════════════════════════════════════════════
-- Migración: seguridad y roles
-- Fecha: 2026-06-17
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Es idempotente: se puede correr más de una vez sin efectos adversos.
-- ══════════════════════════════════════════════════════════════════

-- ─── 1. Agregar rol 'encargado' al check constraint de usuarios ──────────────
-- El código maneja tres roles (dueno, empleado, encargado) pero la BD solo
-- permite dos. Esto provoca error 23514 al crear/actualizar un encargado.

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('dueno', 'empleado', 'encargado'));

-- ─── 2. Corregir política RLS de mapeos_sku (solo si la tabla existe) ────────
-- La política original referencia `user_id` que no existe en la tabla usuarios
-- (la columna correcta es `id`). Esto hace que la política nunca funcione.
-- Si la tabla no existe todavía, este bloque no hace nada.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mapeos_sku'
  ) THEN
    DROP POLICY IF EXISTS "mapeos_sku: solo su tienda" ON mapeos_sku;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename  = 'mapeos_sku'
        AND policyname = 'mapeos_sku_all'
    ) THEN
      EXECUTE $pol$
        CREATE POLICY "mapeos_sku_all"
          ON mapeos_sku FOR ALL
          USING      (tienda_id = get_tienda_id())
          WITH CHECK (tienda_id = get_tienda_id())
      $pol$;
    END IF;
  END IF;
END $$;

-- ─── 3. Tabla codigos_activacion ─────────────────────────────────────────────
-- Permite emitir códigos individuales por tienda (en lugar de códigos genéricos
-- visibles en el bundle del cliente). La Edge Function validar-codigo la consulta.

CREATE TABLE IF NOT EXISTS codigos_activacion (
  id         BIGSERIAL    PRIMARY KEY,
  codigo     TEXT         NOT NULL UNIQUE,
  plan       TEXT         NOT NULL CHECK (plan IN ('basico', 'pro', 'upgrade')),
  usado      BOOLEAN      NOT NULL DEFAULT FALSE,
  tienda_id  UUID         REFERENCES tiendas(id) ON DELETE SET NULL,
  creado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  usado_en   TIMESTAMPTZ
);

-- Solo accesible por service_role (Edge Function) — ningún cliente puede leerla
ALTER TABLE codigos_activacion ENABLE ROW LEVEL SECURITY;

-- Sin políticas públicas: la tabla es invisible para usuarios autenticados.
-- La Edge Function usa service_role_key para consultarla.

-- Índice para búsqueda rápida por código
CREATE INDEX IF NOT EXISTS idx_codigos_activacion_codigo
  ON codigos_activacion (codigo);

-- ─── 4. Índices de rendimiento faltantes ─────────────────────────────────────

DO $$
BEGIN
  -- movimientos_stock.creado_en — queries de rango por fecha
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'movimientos_stock'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'idx_movimientos_stock_creado_en'
    ) THEN
      EXECUTE 'CREATE INDEX idx_movimientos_stock_creado_en
               ON movimientos_stock (tienda_id, creado_en DESC)';
    END IF;
  END IF;

  -- detalles_venta.venta_local_id — join de historial de ventas
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'detalles_venta'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'idx_detalles_venta_venta_id'
    ) THEN
      EXECUTE 'CREATE INDEX idx_detalles_venta_venta_id
               ON detalles_venta (tienda_id, venta_local_id)';
    END IF;
  END IF;
END $$;
