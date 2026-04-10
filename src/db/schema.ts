// Definición de tablas Dexie — fuente de verdad del modelo de datos
// Las interfaces aquí son las mismas que en src/types/index.ts,
// exportadas desde este módulo para que database.ts las use como tipos de tabla.

export interface Categoria {
  id?: number
  nombre: string
  emoji: string
  orden: number
}

export interface Producto {
  id?: number
  nombre: string
  categoriaId: number
  precio: number           // Pesos COP, sin decimales
  precioCompra?: number    // Costo (para calcular margen)
  codigoBarras?: string
  stockActual?: number     // null = no controla stock
  stockMinimo?: number     // Para alertas de stock bajo
  unidad: 'unidad' | 'gramo' | 'mililitro' | 'porcion'
  esFantasma: boolean
  activo: boolean
  creadoEn: Date
  actualizadoEn: Date
  fechaVencimiento?: Date  // Opcional: para productos perecederos
  loteNumero?: string       // Opcional: número de lote
}

export interface Cliente {
  id?: number
  nombre: string
  telefono?: string
  direccion?: string
  limiteCredito?: number   // COP. undefined = sin límite
  totalDeuda: number       // Se actualiza con cada movimiento
  ultimoMovimiento?: Date  // Fecha del último cargo o pago (para calcular mora)
  activo: boolean
  creadoEn: Date
}

export interface SesionCaja {
  id?: number
  montoApertura: number
  montoCierre?: number
  totalVentas: number
  totalEfectivo: number
  totalFiado: number
  totalGastos: number
  abiertaEn: Date
  cerradaEn?: Date
  estado: 'abierta' | 'cerrada'
  notas?: string
}

export interface Venta {
  id?: number
  sesionCajaId: number
  clienteId?: number       // undefined = cliente anónimo (mostrador)
  subtotal: number
  descuento: number
  total: number
  tipoPago: 'efectivo' | 'fiado' | 'transferencia' | 'tarjeta' | 'mixto'
  subtipoTarjeta?: 'debito' | 'credito'   // Solo cuando tipoPago='tarjeta'
  efectivoRecibido?: number
  cambio?: number
  canal?: 'mostrador' | 'domicilio'       // Canal de venta (default: mostrador)
  estado: 'completada' | 'anulada'
  estadoPago?: 'verificado' | 'pendiente_verificacion'  // Solo para tipoPago === 'transferencia'
  deviceId?: string        // UUID del dispositivo que creó la venta — para deduplicación en sync
  notas?: string
  creadaEn: Date
}

export interface DetalleVenta {
  id?: number
  ventaId: number
  productoId?: number      // undefined = producto fantasma
  nombreProducto: string   // Snapshot del nombre al momento de vender
  cantidad: number         // Permite fracciones: 0.5, 250
  precioUnitario: number   // Snapshot del precio al vender
  precioCompraSnapshot?: number  // Snapshot del costo al vender (para calcular margen)
  descuento: number
  subtotal: number
  esProductoFantasma: boolean
}

export interface MovimientoFiado {
  id?: number
  clienteId: number
  ventaId?: number         // undefined = pago directo de deuda
  tipo: 'cargo' | 'pago'
  monto: number
  descripcion: string
  formaCobro?: string      // 'efectivo' | 'Nequi' | 'Daviplata' | 'Dale' | 'tarjeta_debito' | 'tarjeta_credito'
  creadoEn: Date
  sesionCajaId?: number
}

export interface GastoCaja {
  id?: number
  sesionCajaId: number
  descripcion: string
  monto: number
  tipo: 'hormiga' | 'proveedor' | 'servicio' | 'otro'
  creadoEn: Date
}

export interface ConfigTienda {
  id?: number              // Siempre 1 (singleton)
  nombreTienda: string
  direccion?: string
  telefono?: string
  nit?: string
  mensajeRecibo?: string
  monedaSimbol: string     // "$"
  impuestoIVA: number      // 0 = no aplica IVA
  permitirStockNegativo: boolean
  limiteFiadoPorDefecto: number   // COP. 0 = sin límite
  tourCompletado?: boolean        // true = el tendero ya vio el tour de onboarding
  tieneDatafono?: boolean         // true = mostrar opción Tarjeta en el cobro
  // ── Notificaciones push (Fase 22) ──────────────────────────────────────────
  notificacionesActivas?: boolean // Master toggle de notificaciones
  notifFiado?: boolean            // Recordatorios de mora de fiado
  notifStock?: boolean            // Alertas de productos agotados
  notifCaja?: boolean             // Recordatorio de apertura de caja
  horaCaja?: string               // Hora configurada para el recordatorio, ej "07:00"
  // ── Feature flags — Plan comercial ─────────────────────────────────────────
  planActivo?: 'basico' | 'pro'   // Plan del POS. Default: "basico"
  planActivadoEn?: Date           // Cuándo se activó el plan Pro
  codigoActivacion?: string       // Código usado para activar Pro
  // ── Valores legales — Nómina ────────────────────────────────────────────────
  smmlv?: number                  // Salario Mínimo Mensual Legal Vigente. Default: 1_423_500 (2025)
  subsidioTransporte?: number     // Subsidio de transporte. Default: 200_000 (2025)
}

// ─── Módulo de Proveedores y Compras (v2) ─────────────────────────────────────

export interface Proveedor {
  id?: number
  nombre: string           // "Lácteos El Campo", "Distribuidora Colanta"
  telefono?: string
  contacto?: string        // Nombre del vendedor
  diasVisita?: string      // "Lunes y Jueves"
  saldoPendiente: number   // Lo que le debo al proveedor
  activo: boolean
  creadoEn: Date
}

export interface CompraProveedor {
  id?: number
  proveedorId: number
  sesionCajaId?: number
  total: number
  pagado: number           // Puede pagar parcial
  saldo: number            // total - pagado
  tipoPago: 'contado' | 'credito' | 'mixto'
  notas?: string           // "Factura #1234"
  creadaEn: Date
}

export interface DetalleCompra {
  id?: number
  compraId: number
  productoId?: number
  nombreProducto: string
  cantidad: number
  precioUnitario: number   // Precio de costo
  subtotal: number
}

export interface PagoProveedor {
  id?: number
  proveedorId: number
  compraId?: number        // undefined = abono general
  monto: number
  sesionCajaId?: number
  notas?: string
  creadoEn: Date
}

// ─── Módulo de Mapeo de SKUs de Proveedor (v4) ───────────────────────────────
// Asocia el texto exacto de una factura con un producto interno del catálogo.
// Ejemplo: "LCH ENT 1.1" → producto id 42 "Leche Entera 1L"

export interface MapeoSKU {
  id?: number
  nombreProveedor: string   // Texto exacto tal como aparece en la factura
  productoId: number        // FK → productos.id
  nombreProducto: string    // Snapshot del nombre interno al momento de crear
  vecesUsado: number        // Incrementa cada vez que se aplica este mapeo
  creadoEn: Date
  actualizadoEn: Date
}

// ─── Módulo de Nota de Venta — Régimen Simple (v5) ──────────────────────────

export interface ConfigFiscal {
  id?: number              // Siempre 1 (singleton)
  ultimoConsecutivo: number  // Se incrementa con cada nota generada
  prefijo: string            // 'NV' por defecto
  // Campos para futura facturación electrónica DIAN:
  resolucionDIAN?: string   // Ej: "18764000001" (cuando sea obligatorio)
  rangoDesde?: number
  rangoHasta?: number
  vigenciaHasta?: Date
}

// ─── Módulo de Cuentas Abiertas / Comandas (v6) ──────────────────────────────

/** Ítem dentro de una cuenta abierta — misma estructura que ItemCarrito */
export interface ItemCuenta {
  productoId?: number
  nombreProducto: string
  cantidad: number
  precioUnitario: number
  precioCompraSnapshot?: number
  descuento: number
  subtotal: number
  esProductoFantasma: boolean
}

export interface CuentaAbierta {
  id?: number
  nombre: string                // "Mesa 1", "Don Carlos", "La barra"
  items: ItemCuenta[]           // Productos acumulados — JSON array en Dexie
  total: number                 // Calculado: suma de subtotales
  estado: 'abierta' | 'cobrada'
  sesionCajaId?: number
  creadaEn: Date
  actualizadoEn: Date
}

// ─── Módulo de Control de Stock (v3) ─────────────────────────────────────────

export interface MovimientoStock {
  id?: number
  productoId: number
  tipo: 'entrada' | 'salida' | 'ajuste' | 'venta'
  cantidad: number       // siempre positivo; tipo indica la dirección
  stockAnterior: number
  stockNuevo: number
  costo?: number         // precio de costo para entradas
  nota?: string
  ventaId?: number       // link a venta si tipo='venta'
  compraId?: number      // link a compra si tipo='entrada'
  deviceId?: string      // UUID del dispositivo origen — para deduplicar al recibir movimientos remotos
  sincronizado?: boolean // true = ya fue enviado a Supabase exitosamente
  creadoEn: Date
}

// ─── Módulo de Nómina y Empleados (v7) ───────────────────────────────────────

export interface Empleado {
  id?: number;
  nombre: string;
  cedula?: string;
  cargo?: string;
  salario: number;
  tipoContrato: "indefinido" | "fijo" | "obra_labor";
  fechaIngreso: Date;
  telefono?: string;
  activo: boolean;
  creadoEn: Date;
}

export interface PeriodoNomina {
  id?: number;
  empleadoId: number;
  tipo: "quincenal" | "mensual";
  fechaInicio: Date;
  fechaFin: Date;
  salarioBase: number;
  diasTrabajados: number;
  horasExtra?: number;
  bonificaciones: number;
  deduccionSalud: number;
  deduccionPension: number;
  otrasDeduciones: number;
  totalDevengado: number;
  totalDeducciones: number;
  netoAPagar: number;
  estado: "borrador" | "pagado";
  fechaPago?: Date;
  notas?: string;
  creadoEn: Date;
}

export interface LiquidacionPrestaciones {
  id?: number;
  empleadoId: number;
  tipo: "prima" | "cesantias" | "intereses_cesantias" | "vacaciones";
  periodo: string; // "2025-S1", "2025", "2025-S2"
  baseCalculo: number; // Salario promedio del período
  diasCalculo: number; // Días trabajados en el período
  monto: number;
  estado: "pendiente" | "pagado";
  fechaPago?: Date;
  creadoEn: Date;
}

export interface AdelantoEmpleado {
  id?: number;
  empleadoId: number;
  monto: number;
  descripcion?: string;
  sesionCajaId?: number;
  descontadoEn?: number; // ID del PeriodoNomina donde se descontó
  creadoEn: Date;
}

// ─── Módulo de Domicilios y Catálogo Público (v8) ─────────────────────────────

export interface PedidoDomicilio {
  id?: number
  ventaId?: number             // Se asocia tras confirmar la venta
  nombre: string               // Nombre del cliente
  telefono?: string
  direccion: string            // Dirección de entrega
  barrio?: string              // Barrio o sector
  indicaciones?: string        // Indicaciones adicionales (apto, color de puerta, etc.)
  repartidor?: string          // Nombre del repartidor asignado
  costoEnvio: number           // En COP
  estado: 'pendiente' | 'en_camino' | 'entregado' | 'cancelado'
  notas?: string
  sesionCajaId?: number
  creadoEn: Date
  actualizadoEn: Date
}

export interface CatalogoPublico {
  id?: number                  // Siempre 1 (singleton)
  activo: boolean
  slug: string                 // URL-friendly: "tienda-dona-rosa"
  whatsappNumero: string       // Número sin +57, ej: "3001234567"
  mensajeBienvenida?: string
  costoEnvioPorDefecto: number // En COP
  categoriasMostrar: number[]  // IDs de categorías visibles — JSON en Dexie
}

// ─── Módulo de Auditoría de Anulaciones (v10) ────────────────────────────────

export interface AuditoriaAnulacion {
  id?: number
  ventaId: number
  ventaTotal: number          // Snapshot del total anulado
  ventaTipoPago: string       // Snapshot del tipo de pago
  usuarioNombre: string       // Nombre del usuario que anuló
  usuarioRol: string          // Rol: dueno | encargado | empleado
  motivo: string              // Obligatorio — mínimo 10 caracteres
  creadoEn: Date
}

// ─── Módulo de Mermas (v11) ───────────────────────────────────────────────────

export interface Merma {
  id?: number
  productoId?: number         // undefined = producto no catalogado
  nombreProducto: string      // Snapshot del nombre al registrar
  cantidad: number            // Unidades o gramos perdidos
  unidad: string              // Snapshot de la unidad del producto
  precioCompra: number        // Costo unitario al momento del registro
  costoTotal: number          // cantidad × precioCompra
  tipo: 'vencido' | 'dañado' | 'consumo_interno' | 'otro'
  sesionCajaId?: number       // Sesión de caja activa al registrar
  notas?: string
  creadoEn: Date
}

