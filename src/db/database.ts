import Dexie, { type EntityTable } from 'dexie'
import type {
  Categoria,
  Producto,
  Cliente,
  SesionCaja,
  Venta,
  DetalleVenta,
  MovimientoFiado,
  GastoCaja,
  ConfigTienda,
  Proveedor,
  CompraProveedor,
  DetalleCompra,
  PagoProveedor,
  MovimientoStock,
  MapeoSKU,
  ConfigFiscal,
  CuentaAbierta,
} from './schema'

// Singleton de Dexie — única instancia para toda la aplicación
class POSDatabase extends Dexie {
  categorias!: EntityTable<Categoria, 'id'>
  productos!: EntityTable<Producto, 'id'>
  clientes!: EntityTable<Cliente, 'id'>
  sesionCaja!: EntityTable<SesionCaja, 'id'>
  ventas!: EntityTable<Venta, 'id'>
  detallesVenta!: EntityTable<DetalleVenta, 'id'>
  movimientosFiado!: EntityTable<MovimientoFiado, 'id'>
  gastosCaja!: EntityTable<GastoCaja, 'id'>
  configTienda!: EntityTable<ConfigTienda, 'id'>
  // v2 — módulo proveedores
  proveedores!: EntityTable<Proveedor, 'id'>
  comprasProveedor!: EntityTable<CompraProveedor, 'id'>
  detallesCompra!: EntityTable<DetalleCompra, 'id'>
  pagosProveedor!: EntityTable<PagoProveedor, 'id'>
  // v3 — módulo stock
  movimientosStock!: EntityTable<MovimientoStock, 'id'>
  // v4 — mapeo de SKUs de proveedor
  mapeosSKU!: EntityTable<MapeoSKU, 'id'>
  // v5 — facturación régimen simple
  configFiscal!: EntityTable<ConfigFiscal, 'id'>
  // v6 — cuentas abiertas / comandas
  cuentasAbiertas!: EntityTable<CuentaAbierta, 'id'>

  constructor() {
    super('POSTienda')

    // Versión 1: esquema inicial
    this.version(1).stores({
      // ++id = clave primaria auto-incremental
      // Los demás campos listados son índices para queries rápidas
      categorias:      '++id, orden',
      productos:       '++id, categoriaId, nombre, codigoBarras, activo, esFantasma',
      clientes:        '++id, nombre, activo',
      sesionCaja:      '++id, estado, abiertaEn',
      ventas:          '++id, sesionCajaId, clienteId, tipoPago, estado, creadaEn',
      detallesVenta:   '++id, ventaId, productoId',
      movimientosFiado:'++id, clienteId, ventaId, tipo, creadoEn',
      gastosCaja:      '++id, sesionCajaId, tipo',
      configTienda:    '++id',
    })

    // Versión 2: agrega módulo de proveedores y compras
    this.version(2).stores({
      proveedores:      '++id, nombre, activo',
      comprasProveedor: '++id, proveedorId, sesionCajaId, creadaEn',
      detallesCompra:   '++id, compraId, productoId',
      pagosProveedor:   '++id, proveedorId, compraId, sesionCajaId, creadoEn',
    })

    // Versión 3: agrega módulo de control de stock
    this.version(3).stores({
      movimientosStock: '++id, productoId, tipo, ventaId, compraId, creadoEn',
    })

    // Versión 4: tabla de mapeos SKU proveedor → producto interno
    this.version(4).stores({
      mapeosSKU: '++id, nombreProveedor, productoId, vecesUsado',
    })

    // Versión 5: tabla de configuración fiscal (régimen simple / consecutivo NV)
    this.version(5).stores({
      configFiscal: '++id',
    })

    // Versión 6: cuentas abiertas / comandas para ventas por rondas
    this.version(6).stores({
      cuentasAbiertas: '++id, estado, sesionCajaId, creadaEn',
    })
  }
}

// Exportar instancia única — nunca instanciar POSDatabase directamente
export const db = new POSDatabase()

// Re-exportar tipos para conveniencia de los hooks
export type {
  Categoria,
  Producto,
  Cliente,
  SesionCaja,
  Venta,
  DetalleVenta,
  MovimientoFiado,
  GastoCaja,
  ConfigTienda,
  Proveedor,
  CompraProveedor,
  DetalleCompra,
  PagoProveedor,
  MovimientoStock,
  MapeoSKU,
  ConfigFiscal,
  CuentaAbierta,
}
