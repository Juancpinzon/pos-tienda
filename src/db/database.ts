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
  Empleado,
  PeriodoNomina,
  LiquidacionPrestaciones,
  AdelantoEmpleado,
  PedidoDomicilio,
  CatalogoPublico,
  AuditoriaAnulacion,
  Merma,
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
  // v7 — módulo de nómina
  empleados!: EntityTable<Empleado, 'id'>
  periodosNomina!: EntityTable<PeriodoNomina, 'id'>
  liquidacionesPrestaciones!: EntityTable<LiquidacionPrestaciones, 'id'>
  adelantosEmpleado!: EntityTable<AdelantoEmpleado, 'id'>
  // v8 — módulo de domicilios y catálogo público
  pedidosDomicilio!: EntityTable<PedidoDomicilio, 'id'>
  catalogoPublico!: EntityTable<CatalogoPublico, 'id'>
  // v10 — auditoría de anulaciones
  auditoriaAnulaciones!: EntityTable<AuditoriaAnulacion, 'id'>
  // v11 — módulo de mermas
  mermas!: EntityTable<Merma, 'id'>

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

    // Versión 7: módulo de nómina para empleados
    this.version(7).stores({
      empleados: "++id, activo, nombre",
      periodosNomina: "++id, empleadoId, estado, fechaInicio",
      liquidacionesPrestaciones: "++id, empleadoId, tipo, periodo, estado",
      adelantosEmpleado: "++id, empleadoId, descontadoEn",
    })

    // Versión 8: módulo de domicilios y catálogo público
    this.version(8).stores({
      pedidosDomicilio: '++id, ventaId, estado, sesionCajaId, creadoEn',
      catalogoPublico:  '++id',
    })

    // Versión 9: feature flags — plan básico / pro
    // Migración: registros existentes de configTienda arrancan en "basico"
    this.version(9).stores({}).upgrade(async (tx) => {
      await tx.table('configTienda').toCollection().modify((cfg) => {
        if (!cfg.planActivo) {
          cfg.planActivo = 'basico'
        }
      })
    })

    // Versión 10: auditoría de anulaciones
    this.version(10).stores({
      auditoriaAnulaciones: '++id, ventaId, usuarioRol, usuarioNombre, creadoEn',
    })

    // Versión 11: módulo de mermas — pérdidas por vencimiento, daño o consumo
    this.version(11).stores({
      mermas: '++id, productoId, tipo, sesionCajaId, creadoEn',
    })

    // Versión 12: valores legales de nómina editables por el dueño
    this.version(12).stores({}).upgrade(async (tx) => {
      await tx.table('configTienda').toCollection().modify((cfg) => {
        if (!cfg.smmlv) cfg.smmlv = 1_423_500
        if (!cfg.subsidioTransporte) cfg.subsidioTransporte = 200_000
      })
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
  Empleado,
  PeriodoNomina,
  LiquidacionPrestaciones,
  AdelantoEmpleado,
  PedidoDomicilio,
  CatalogoPublico,
  AuditoriaAnulacion,
  Merma,
}
