-- ══════════════════════════════════════════════════════════════════
-- Migración: restringir creación de tiendas por rol
-- Fecha: 2026-06-17
-- Problema: la política tiendas_insert tenía WITH CHECK (true),
--   lo que permitía a cualquier usuario autenticado (incluyendo
--   empleados y encargados) crear tiendas ilimitadas.
-- Solución: solo permitir inserción a usuarios que:
--   a) aún no existen en la tabla usuarios (registro inicial), o
--   b) son dueños (pueden crear tiendas adicionales en multi-tienda).
-- Es idempotente: se puede correr más de una vez sin efectos adversos.
-- ══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "tiendas_insert" ON tiendas;

CREATE POLICY "tiendas_insert" ON tiendas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Caso 1: usuario en proceso de registro (aún no tiene fila en usuarios)
    NOT EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid())
    OR
    -- Caso 2: usuario ya registrado con rol dueño (multi-tienda)
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'dueno')
  );
