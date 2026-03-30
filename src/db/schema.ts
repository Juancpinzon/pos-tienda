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
  tipoPago: 'efectivo' | 'fiado' | 'transferencia' | 'mixto'
  efectivoRecibido?: number
  cambio?: number
  estado: 'completada' | 'anulada'
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
  creadoEn: Date
}
