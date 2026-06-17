-- Índices de rendimiento para queries frecuentes en Supabase
-- Ejecutar después de 20260617_04 si existe, o directamente en SQL Editor

-- ventas: historial por tienda ordenado por fecha (pantalla historial y sync pull)
CREATE INDEX IF NOT EXISTS idx_ventas_tienda_fecha
  ON ventas(tienda_id, creada_en DESC);

-- ventas: filtrar por estado dentro de una tienda (reportes, conciliación)
CREATE INDEX IF NOT EXISTS idx_ventas_tienda_estado
  ON ventas(tienda_id, estado);

-- detalles_venta: join desde venta (carga de historial, contexto IA, sugerido compra)
CREATE INDEX IF NOT EXISTS idx_detalles_venta_join
  ON detalles_venta(tienda_id, venta_local_id);

-- productos: filtrar activos para sync y catálogo público
CREATE INDEX IF NOT EXISTS idx_productos_activo
  ON productos(tienda_id, activo) WHERE activo = true;

-- movimientos_fiado: filtrar por sesión de caja (resumen cierre)
CREATE INDEX IF NOT EXISTS idx_mov_fiado_sesion
  ON movimientos_fiado(tienda_id, sesion_caja_local_id);

-- movimientos_stock: sync incremental por dispositivo y fecha
-- (sincronizado vive solo en Dexie local, no en Supabase)
CREATE INDEX IF NOT EXISTS idx_mov_stock_sync
  ON movimientos_stock(tienda_id, device_id, creado_en DESC);
