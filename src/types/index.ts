// Todos los tipos TypeScript del sistema POS

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
  precio: number
  precioCompra?: number
  codigoBarras?: string
  stockActual?: number
  stockMinimo?: number
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
  limiteCredito?: number
  totalDeuda: number
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
  clienteId?: number
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
  productoId?: number
  nombreProducto: string
  cantidad: number
  precioUnitario: number
  descuento: number
  subtotal: number
  esProductoFantasma: boolean
}

export interface MovimientoFiado {
  id?: number
  clienteId: number
  ventaId?: number
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
  id?: number
  nombreTienda: string
  direccion?: string
  telefono?: string
  nit?: string
  mensajeRecibo?: string
  monedaSimbol: string
  impuestoIVA: number
  permitirStockNegativo: boolean
  limiteFiadoPorDefecto: number
}

// Tipos auxiliares para la UI
export interface ItemCarrito {
  productoId?: number
  nombreProducto: string
  cantidad: number
  precioUnitario: number
  descuento: number
  subtotal: number
  esProductoFantasma: boolean
}
