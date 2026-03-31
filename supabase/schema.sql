-- ╔══════════════════════════════════════════════════════════════════╗
-- ║        POS Tienda de Barrio — Schema Supabase                   ║
-- ║        Ejecutar en: Dashboard > SQL Editor > New query          ║
-- ╚══════════════════════════════════════════════════════════════════╝
--
-- INSTRUCCIONES:
-- 1. Crear un proyecto nuevo en https://supabase.com
-- 2. Ir a SQL Editor y pegar TODO este script
-- 3. Ejecutar con "Run"
-- 4. Copiar la URL y la anon key en .env.local
-- 5. En Authentication > Settings: habilitar "Enable Email Confirmations" = OFF
--    (para que el tendero pueda entrar sin confirmar email)

-- ─── Extensiones ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── TIENDAS ────────────────────────────────────────────────────────────────
-- Una fila por negocio. El dueño la crea al registrarse.
CREATE TABLE tiendas (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre         TEXT NOT NULL,
  direccion      TEXT,
  telefono       TEXT,
  nit            TEXT,
  mensaje_recibo TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USUARIOS ───────────────────────────────────────────────────────────────
-- Extiende auth.users de Supabase con rol y tienda.
CREATE TABLE usuarios (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  tienda_id  UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL,
  email      TEXT NOT NULL,
  nombre     TEXT NOT NULL,
  rol        TEXT CHECK (rol IN ('dueno', 'empleado')) NOT NULL DEFAULT 'empleado',
  activo     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CATEGORÍAS ─────────────────────────────────────────────────────────────
CREATE TABLE categorias (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL,
  device_id TEXT NOT NULL,   -- UUID del dispositivo de origen
  local_id  INTEGER NOT NULL, -- ID en Dexie del dispositivo origen
  nombre    TEXT NOT NULL,
  emoji     TEXT NOT NULL DEFAULT '📦',
  orden     INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tienda_id, device_id, local_id)
);

-- ─── PRODUCTOS ──────────────────────────────────────────────────────────────
CREATE TABLE productos (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id          UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL,
  device_id          TEXT NOT NULL,
  local_id           INTEGER NOT NULL,
  categoria_local_id INTEGER,
  nombre             TEXT NOT NULL,
  precio             INTEGER NOT NULL,
  precio_compra      INTEGER,
  codigo_barras      TEXT,
  stock_actual       NUMERIC,
  stock_minimo       NUMERIC,
  unidad             TEXT CHECK (unidad IN ('unidad','gramo','mililitro','porcion')) DEFAULT 'unidad',
  es_fantasma        BOOLEAN DEFAULT FALSE,
  activo             BOOLEAN DEFAULT TRUE,
  creado_en          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tienda_id, device_id, local_id)
);

-- ─── CLIENTES ───────────────────────────────────────────────────────────────
CREATE TABLE clientes (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id      UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL,
  device_id      TEXT NOT NULL,
  local_id       INTEGER NOT NULL,
  nombre         TEXT NOT NULL,
  telefono       TEXT,
  direccion      TEXT,
  limite_credito INTEGER,
  total_deuda        INTEGER NOT NULL DEFAULT 0,
  ultimo_movimiento  TIMESTAMPTZ,      -- fecha del último cargo o pago (para calcular mora)
  activo             BOOLEAN DEFAULT TRUE,
  creado_en          TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tienda_id, device_id, local_id)
);

-- ─── SESIONES DE CAJA ───────────────────────────────────────────────────────
CREATE TABLE sesiones_caja (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id      UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL,
  device_id      TEXT NOT NULL,
  local_id       INTEGER NOT NULL,
  monto_apertura INTEGER NOT NULL,
  monto_cierre   INTEGER,
  total_ventas   INTEGER NOT NULL DEFAULT 0,
  total_efectivo INTEGER NOT NULL DEFAULT 0,
  total_fiado    INTEGER NOT NULL DEFAULT 0,
  total_gastos   INTEGER NOT NULL DEFAULT 0,
  abierta_en     TIMESTAMPTZ NOT NULL,
  cerrada_en     TIMESTAMPTZ,
  estado         TEXT CHECK (estado IN ('abierta','cerrada')) DEFAULT 'abierta',
  notas          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tienda_id, device_id, local_id)
);

-- ─── VENTAS ─────────────────────────────────────────────────────────────────
CREATE TABLE ventas (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id             UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL,
  device_id             TEXT NOT NULL,
  local_id              INTEGER NOT NULL,
  sesion_caja_local_id  INTEGER,
  cliente_local_id      INTEGER,
  subtotal              INTEGER NOT NULL,
  descuento             INTEGER NOT NULL DEFAULT 0,
  total                 INTEGER NOT NULL,
  tipo_pago             TEXT CHECK (tipo_pago IN ('efectivo','fiado','transferencia','mixto')) NOT NULL,
  efectivo_recibido     INTEGER,
  cambio                INTEGER,
  estado                TEXT CHECK (estado IN ('completada','anulada')) DEFAULT 'completada',
  notas                 TEXT,
  creada_en             TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tienda_id, device_id, local_id)
);

-- ─── DETALLES DE VENTA ──────────────────────────────────────────────────────
CREATE TABLE detalles_venta (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id             UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL,
  device_id             TEXT NOT NULL,
  local_id              INTEGER NOT NULL,
  venta_local_id        INTEGER NOT NULL,
  producto_local_id     INTEGER,
  nombre_producto       TEXT NOT NULL,
  cantidad              NUMERIC NOT NULL,
  precio_unitario       INTEGER NOT NULL,
  descuento               INTEGER NOT NULL DEFAULT 0,
  subtotal                INTEGER NOT NULL,
  precio_compra_snapshot  INTEGER,          -- snapshot del costo al vender (para margen)
  es_producto_fantasma    BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tienda_id, device_id, local_id)
);

-- ─── MOVIMIENTOS FIADO ──────────────────────────────────────────────────────
CREATE TABLE movimientos_fiado (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id             UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL,
  device_id             TEXT NOT NULL,
  local_id              INTEGER NOT NULL,
  cliente_local_id      INTEGER NOT NULL,
  venta_local_id        INTEGER,
  tipo                  TEXT CHECK (tipo IN ('cargo','pago')) NOT NULL,
  monto                 INTEGER NOT NULL,
  descripcion           TEXT NOT NULL,
  sesion_caja_local_id  INTEGER,
  creado_en             TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tienda_id, device_id, local_id)
);

-- ─── GASTOS DE CAJA ─────────────────────────────────────────────────────────
CREATE TABLE gastos_caja (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id             UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL,
  device_id             TEXT NOT NULL,
  local_id              INTEGER NOT NULL,
  sesion_caja_local_id  INTEGER NOT NULL,
  descripcion           TEXT NOT NULL,
  monto                 INTEGER NOT NULL,
  tipo                  TEXT CHECK (tipo IN ('hormiga','proveedor','servicio','otro')) NOT NULL,
  creado_en             TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tienda_id, device_id, local_id)
);

-- ─── CONFIGURACIÓN DE TIENDA ────────────────────────────────────────────────
CREATE TABLE config_tienda (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id                UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nombre_tienda            TEXT NOT NULL,
  direccion                TEXT,
  telefono                 TEXT,
  nit                      TEXT,
  mensaje_recibo           TEXT,
  moneda_simbol            TEXT DEFAULT '$',
  impuesto_iva             INTEGER DEFAULT 0,
  permitir_stock_negativo  BOOLEAN DEFAULT TRUE,
  limite_fiado_por_defecto INTEGER DEFAULT 0,
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PROVEEDORES ────────────────────────────────────────────────────────────
CREATE TABLE proveedores (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id       UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL,
  device_id       TEXT NOT NULL,
  local_id        INTEGER NOT NULL,
  nombre          TEXT NOT NULL,
  telefono        TEXT,
  contacto        TEXT,
  dias_visita     TEXT,
  saldo_pendiente INTEGER NOT NULL DEFAULT 0,
  activo          BOOLEAN DEFAULT TRUE,
  creado_en       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tienda_id, device_id, local_id)
);

-- ─── COMPRAS A PROVEEDOR ────────────────────────────────────────────────────
CREATE TABLE compras_proveedor (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id             UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL,
  device_id             TEXT NOT NULL,
  local_id              INTEGER NOT NULL,
  proveedor_local_id    INTEGER NOT NULL,
  sesion_caja_local_id  INTEGER,
  total                 INTEGER NOT NULL,
  pagado                INTEGER NOT NULL DEFAULT 0,
  saldo                 INTEGER NOT NULL DEFAULT 0,
  tipo_pago             TEXT CHECK (tipo_pago IN ('contado','credito','mixto')) NOT NULL,
  notas                 TEXT,
  creada_en             TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tienda_id, device_id, local_id)
);

-- ─── DETALLES DE COMPRA ─────────────────────────────────────────────────────
CREATE TABLE detalles_compra (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id          UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL,
  device_id          TEXT NOT NULL,
  local_id           INTEGER NOT NULL,
  compra_local_id    INTEGER NOT NULL,
  producto_local_id  INTEGER,
  nombre_producto    TEXT NOT NULL,
  cantidad           NUMERIC NOT NULL,
  precio_unitario    INTEGER NOT NULL,
  subtotal           INTEGER NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tienda_id, device_id, local_id)
);

-- ─── PAGOS A PROVEEDOR ──────────────────────────────────────────────────────
CREATE TABLE pagos_proveedor (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id             UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL,
  device_id             TEXT NOT NULL,
  local_id              INTEGER NOT NULL,
  proveedor_local_id    INTEGER NOT NULL,
  compra_local_id       INTEGER,
  monto                 INTEGER NOT NULL,
  sesion_caja_local_id  INTEGER,
  notas                 TEXT,
  creado_en             TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tienda_id, device_id, local_id)
);

-- ─── MOVIMIENTOS DE STOCK ───────────────────────────────────────────────────
CREATE TABLE movimientos_stock (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tienda_id          UUID REFERENCES tiendas(id) ON DELETE CASCADE NOT NULL,
  device_id          TEXT NOT NULL,
  local_id           INTEGER NOT NULL,
  producto_local_id  INTEGER NOT NULL,
  tipo               TEXT CHECK (tipo IN ('entrada','salida','ajuste','venta')) NOT NULL,
  cantidad           NUMERIC NOT NULL,
  stock_anterior     NUMERIC NOT NULL,
  stock_nuevo        NUMERIC NOT NULL,
  costo              INTEGER,
  nota               TEXT,
  venta_local_id     INTEGER,
  compra_local_id    INTEGER,
  creado_en          TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tienda_id, device_id, local_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
--                       ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════

-- Función helper: retorna el tienda_id del usuario autenticado
CREATE OR REPLACE FUNCTION get_tienda_id()
RETURNS UUID AS $$
  SELECT tienda_id FROM usuarios WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Habilitar RLS en todas las tablas de datos
ALTER TABLE tiendas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias        ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones_caja     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalles_venta    ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_fiado ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_caja       ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_tienda     ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_proveedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalles_compra   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_proveedor   ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

-- ─── Policies: tiendas ───────────────────────────────────────────────────────
-- Solo puede ver / editar su propia tienda
CREATE POLICY "tiendas_select" ON tiendas
  FOR SELECT USING (id = get_tienda_id());

-- Cualquier usuario autenticado puede crear una tienda (necesario en el registro,
-- cuando aún no existe fila en `usuarios` y get_tienda_id() devuelve NULL)
CREATE POLICY "tiendas_insert" ON tiendas
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "tiendas_update" ON tiendas
  FOR UPDATE USING (id = get_tienda_id());

-- ─── Policies: usuarios ─────────────────────────────────────────────────────
CREATE POLICY "usuarios_select" ON usuarios
  FOR SELECT USING (tienda_id = get_tienda_id());

-- Solo puede insertar su propio perfil (auth.uid() = id)
CREATE POLICY "usuarios_insert" ON usuarios
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "usuarios_update" ON usuarios
  FOR UPDATE USING (tienda_id = get_tienda_id());

-- ─── Macro policy para tablas de datos ──────────────────────────────────────
-- Cada tabla solo es visible para usuarios de la misma tienda

CREATE POLICY "categorias_all"        ON categorias        USING (tienda_id = get_tienda_id()) WITH CHECK (tienda_id = get_tienda_id());
CREATE POLICY "productos_all"         ON productos         USING (tienda_id = get_tienda_id()) WITH CHECK (tienda_id = get_tienda_id());
CREATE POLICY "clientes_all"          ON clientes          USING (tienda_id = get_tienda_id()) WITH CHECK (tienda_id = get_tienda_id());
CREATE POLICY "sesiones_caja_all"     ON sesiones_caja     USING (tienda_id = get_tienda_id()) WITH CHECK (tienda_id = get_tienda_id());
CREATE POLICY "ventas_all"            ON ventas            USING (tienda_id = get_tienda_id()) WITH CHECK (tienda_id = get_tienda_id());
CREATE POLICY "detalles_venta_all"    ON detalles_venta    USING (tienda_id = get_tienda_id()) WITH CHECK (tienda_id = get_tienda_id());
CREATE POLICY "movimientos_fiado_all" ON movimientos_fiado USING (tienda_id = get_tienda_id()) WITH CHECK (tienda_id = get_tienda_id());
CREATE POLICY "gastos_caja_all"       ON gastos_caja       USING (tienda_id = get_tienda_id()) WITH CHECK (tienda_id = get_tienda_id());
CREATE POLICY "config_tienda_all"     ON config_tienda     USING (tienda_id = get_tienda_id()) WITH CHECK (tienda_id = get_tienda_id());
CREATE POLICY "proveedores_all"       ON proveedores       USING (tienda_id = get_tienda_id()) WITH CHECK (tienda_id = get_tienda_id());
CREATE POLICY "compras_proveedor_all" ON compras_proveedor USING (tienda_id = get_tienda_id()) WITH CHECK (tienda_id = get_tienda_id());
CREATE POLICY "detalles_compra_all"   ON detalles_compra   USING (tienda_id = get_tienda_id()) WITH CHECK (tienda_id = get_tienda_id());
CREATE POLICY "pagos_proveedor_all"   ON pagos_proveedor   USING (tienda_id = get_tienda_id()) WITH CHECK (tienda_id = get_tienda_id());
CREATE POLICY "movimientos_stock_all" ON movimientos_stock USING (tienda_id = get_tienda_id()) WITH CHECK (tienda_id = get_tienda_id());

-- ═══════════════════════════════════════════════════════════════════════════
--                    TRIGGERS: updated_at automático
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tiendas', 'categorias', 'productos', 'clientes',
    'sesiones_caja', 'ventas', 'detalles_venta', 'movimientos_fiado',
    'gastos_caja', 'config_tienda', 'proveedores', 'compras_proveedor',
    'detalles_compra', 'pagos_proveedor', 'movimientos_stock'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
--                    PERMISOS POR ROL (check en frontend)
-- ═══════════════════════════════════════════════════════════════════════════
--
--  dueno   → acceso completo a todos los módulos
--  empleado → solo POS y Fiados
--
--  El control de acceso por rol se hace en el frontend (App.tsx).
--  RLS garantiza que solo vean datos de su tienda, independiente del rol.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  ÍNDICES DE RENDIMIENTO
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX idx_ventas_tienda_creada   ON ventas (tienda_id, creada_en DESC);
CREATE INDEX idx_ventas_tienda_sesion   ON ventas (tienda_id, sesion_caja_local_id);
CREATE INDEX idx_clientes_tienda_nombre ON clientes (tienda_id, nombre);
CREATE INDEX idx_productos_tienda_activo ON productos (tienda_id, activo);
CREATE INDEX idx_mov_fiado_cliente      ON movimientos_fiado (tienda_id, cliente_local_id);


-- ═══════════════════════════════════════════════════════════════════════════
--  TABLA: mapeos_sku  (Fase 15 — aprendizaje de nombres de proveedor)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS mapeos_sku (
  id                 BIGSERIAL PRIMARY KEY,
  tienda_id          UUID        NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
  device_id          TEXT        NOT NULL,
  local_id           INTEGER     NOT NULL,
  nombre_proveedor   TEXT        NOT NULL,
  producto_id_local  INTEGER,
  nombre_producto    TEXT        NOT NULL,
  veces_usado        INTEGER     NOT NULL DEFAULT 1,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tienda_id, device_id, local_id)
);

ALTER TABLE mapeos_sku ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mapeos_sku: solo su tienda"
  ON mapeos_sku FOR ALL
  USING (tienda_id = (
    SELECT tienda_id FROM usuarios WHERE user_id = auth.uid() LIMIT 1
  ));

CREATE INDEX idx_mapeos_sku_tienda ON mapeos_sku (tienda_id, nombre_proveedor);

-- ═══════════════════════════════════════════════════════════════════════════
--  Fase 18 — Multi-tienda
--  Un dueño puede ser propietario de N tiendas.
--  La tabla propietarios_tienda es la fuente de verdad.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS propietarios_tienda (
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tienda_id  UUID REFERENCES tiendas(id)    ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (usuario_id, tienda_id)
);

ALTER TABLE propietarios_tienda ENABLE ROW LEVEL SECURITY;

-- Un dueño solo ve sus propias relaciones
CREATE POLICY "propietarios_select" ON propietarios_tienda
  FOR SELECT USING (usuario_id = auth.uid());

-- Solo puede crear relaciones propias
CREATE POLICY "propietarios_insert" ON propietarios_tienda
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

-- Puede borrar sus propias relaciones (ej. ceder tienda)
CREATE POLICY "propietarios_delete" ON propietarios_tienda
  FOR DELETE USING (usuario_id = auth.uid());

-- ─── Función helper: devuelve TODOS los tienda_ids accesibles al usuario ───────
-- Empleados: solo su tienda_id del registro de usuarios
-- Dueños con multi-tienda: todas sus tiendas vía propietarios_tienda

CREATE OR REPLACE FUNCTION get_tiendas_accesibles()
RETURNS SETOF UUID AS $$
  SELECT tienda_id FROM propietarios_tienda WHERE usuario_id = auth.uid()
  UNION
  SELECT tienda_id FROM usuarios WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Políticas de LECTURA cross-tienda (aditivas a las existentes) ────────────
-- Estas políticas permiten que un dueño con varias tiendas lea datos
-- de todas ellas. Son SELECT-only; las escrituras siguen restringidas
-- a la tienda activa (get_tienda_id() en las políticas existentes).

CREATE POLICY "tiendas_propietario_read" ON tiendas
  FOR SELECT USING (id IN (SELECT get_tiendas_accesibles()));

CREATE POLICY "ventas_propietario_read" ON ventas
  FOR SELECT USING (tienda_id IN (SELECT get_tiendas_accesibles()));

CREATE POLICY "sesiones_caja_propietario_read" ON sesiones_caja
  FOR SELECT USING (tienda_id IN (SELECT get_tiendas_accesibles()));

CREATE POLICY "clientes_propietario_read" ON clientes
  FOR SELECT USING (tienda_id IN (SELECT get_tiendas_accesibles()));

-- ─── Migración: poblar propietarios_tienda para dueños existentes ────────────
-- Ejecutar una sola vez en producción.
INSERT INTO propietarios_tienda (usuario_id, tienda_id)
  SELECT id, tienda_id FROM usuarios WHERE rol = 'dueno'
ON CONFLICT DO NOTHING;
