// Motor de sincronización Dexie ↔ Supabase
//
// Estrategia:
//   - PUSH: lee todos los registros de Dexie y los hace upsert en Supabase
//     usando (tienda_id, device_id, local_id) como clave única.
//   - PULL: descarga registros de otros dispositivos de la misma tienda
//     y los funde en Dexie (solo lectura, no crea IDs conflictivos).
//   - La sincronización es silenciosa. Si falla, se reintenta en el próximo ciclo.
//   - Si no hay internet o no hay credenciales, no hace nada.

import { supabase, supabaseConfigurado } from './supabase'
import { db } from '../db/database'

// ─── Device ID ───────────────────────────────────────────────────────────────
// UUID estable por dispositivo/navegador. Se genera la primera vez y persiste.

const DEVICE_KEY = 'pos-device-id'

export function obtenerDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

// ─── Last sync tracking ──────────────────────────────────────────────────────

function getLastSyncAt(): Date | null {
  const ts = localStorage.getItem('pos-last-sync-at')
  return ts ? new Date(ts) : null
}

function setLastSyncAt(d: Date) {
  localStorage.setItem('pos-last-sync-at', d.toISOString())
}

// ─── Push: Dexie → Supabase ──────────────────────────────────────────────────

export async function syncToSupabase(tiendaId: string): Promise<void> {
  if (!supabaseConfigurado) return
  if (!navigator.onLine) return

  const deviceId = obtenerDeviceId()

  try {
    await Promise.all([
      pushCategorias(tiendaId, deviceId),
      pushProductos(tiendaId, deviceId),
      pushClientes(tiendaId, deviceId),
      pushSesionesCaja(tiendaId, deviceId),
      pushVentas(tiendaId, deviceId),
      pushDetallesVenta(tiendaId, deviceId),
      pushMovimientosFiado(tiendaId, deviceId),
      pushGastosCaja(tiendaId, deviceId),
      pushProveedores(tiendaId, deviceId),
      pushComprasProveedor(tiendaId, deviceId),
      pushDetallesCompra(tiendaId, deviceId),
      pushPagosProveedor(tiendaId, deviceId),
      pushMovimientosStock(tiendaId, deviceId),
      pushConfigTienda(tiendaId),
    ])
    setLastSyncAt(new Date())
  } catch (e) {
    // Silencioso — se reintenta en el próximo ciclo
    console.warn('[sync] Error en push:', e)
  }
}

// ─── Pull: Supabase → Dexie ──────────────────────────────────────────────────
// Solo se llama en login o cuando el usuario lo solicita manualmente.
// Fusiona datos de OTROS dispositivos sin tocar los locales.

export async function pullFromSupabase(tiendaId: string): Promise<{ ok: boolean; mensaje: string }> {
  if (!supabaseConfigurado) return { ok: false, mensaje: 'Supabase no configurado' }

  const deviceId = obtenerDeviceId()

  try {
    await Promise.all([
      pullClientes(tiendaId, deviceId),
      pullProductos(tiendaId, deviceId),
      pullVentas(tiendaId, deviceId),
      pullMovimientosFiado(tiendaId, deviceId),
    ])
    return { ok: true, mensaje: 'Datos sincronizados correctamente' }
  } catch (e) {
    console.error('[sync] Error en pull:', e)
    return { ok: false, mensaje: 'Error al sincronizar. Intenta de nuevo.' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//                         FUNCIONES DE PUSH POR TABLA
// ═══════════════════════════════════════════════════════════════════════════

async function pushCategorias(tiendaId: string, deviceId: string) {
  const registros = await db.categorias.toArray()
  if (!registros.length) return
  await supabase.from('categorias').upsert(
    registros.map((r) => ({
      tienda_id: tiendaId, device_id: deviceId, local_id: r.id,
      nombre: r.nombre, emoji: r.emoji, orden: r.orden,
    })),
    { onConflict: 'tienda_id,device_id,local_id', ignoreDuplicates: false }
  )
}

async function pushProductos(tiendaId: string, deviceId: string) {
  const registros = await db.productos.toArray()
  if (!registros.length) return
  await supabase.from('productos').upsert(
    registros.map((r) => ({
      tienda_id: tiendaId, device_id: deviceId, local_id: r.id,
      categoria_local_id: r.categoriaId,
      nombre: r.nombre, precio: r.precio,
      precio_compra: r.precioCompra ?? null,
      codigo_barras: r.codigoBarras ?? null,
      stock_actual: r.stockActual ?? null,
      stock_minimo: r.stockMinimo ?? null,
      unidad: r.unidad,
      es_fantasma: r.esFantasma,
      activo: r.activo,
      creado_en: r.creadoEn,
    })),
    { onConflict: 'tienda_id,device_id,local_id', ignoreDuplicates: false }
  )
}

async function pushClientes(tiendaId: string, deviceId: string) {
  const registros = await db.clientes.toArray()
  if (!registros.length) return
  await supabase.from('clientes').upsert(
    registros.map((r) => ({
      tienda_id: tiendaId, device_id: deviceId, local_id: r.id,
      nombre: r.nombre,
      telefono: r.telefono ?? null,
      direccion: r.direccion ?? null,
      limite_credito: r.limiteCredito ?? null,
      total_deuda: r.totalDeuda,
      activo: r.activo,
      creado_en: r.creadoEn,
    })),
    { onConflict: 'tienda_id,device_id,local_id', ignoreDuplicates: false }
  )
}

async function pushSesionesCaja(tiendaId: string, deviceId: string) {
  const registros = await db.sesionCaja.toArray()
  if (!registros.length) return
  await supabase.from('sesiones_caja').upsert(
    registros.map((r) => ({
      tienda_id: tiendaId, device_id: deviceId, local_id: r.id,
      monto_apertura: r.montoApertura,
      monto_cierre: r.montoCierre ?? null,
      total_ventas: r.totalVentas,
      total_efectivo: r.totalEfectivo,
      total_fiado: r.totalFiado,
      total_gastos: r.totalGastos,
      abierta_en: r.abiertaEn,
      cerrada_en: r.cerradaEn ?? null,
      estado: r.estado,
      notas: r.notas ?? null,
    })),
    { onConflict: 'tienda_id,device_id,local_id', ignoreDuplicates: false }
  )
}

async function pushVentas(tiendaId: string, deviceId: string) {
  const registros = await db.ventas.toArray()
  if (!registros.length) return
  await supabase.from('ventas').upsert(
    registros.map((r) => ({
      tienda_id: tiendaId, device_id: deviceId, local_id: r.id,
      sesion_caja_local_id: r.sesionCajaId,
      cliente_local_id: r.clienteId ?? null,
      subtotal: r.subtotal,
      descuento: r.descuento,
      total: r.total,
      tipo_pago: r.tipoPago,
      efectivo_recibido: r.efectivoRecibido ?? null,
      cambio: r.cambio ?? null,
      estado: r.estado,
      notas: r.notas ?? null,
      creada_en: r.creadaEn,
    })),
    { onConflict: 'tienda_id,device_id,local_id', ignoreDuplicates: false }
  )
}

async function pushDetallesVenta(tiendaId: string, deviceId: string) {
  const registros = await db.detallesVenta.toArray()
  if (!registros.length) return
  // Lotes de 500 para no exceder el límite de Supabase
  for (let i = 0; i < registros.length; i += 500) {
    const lote = registros.slice(i, i + 500)
    await supabase.from('detalles_venta').upsert(
      lote.map((r) => ({
        tienda_id: tiendaId, device_id: deviceId, local_id: r.id,
        venta_local_id: r.ventaId,
        producto_local_id: r.productoId ?? null,
        nombre_producto: r.nombreProducto,
        cantidad: r.cantidad,
        precio_unitario: r.precioUnitario,
        descuento: r.descuento,
        subtotal: r.subtotal,
        es_producto_fantasma: r.esProductoFantasma,
      })),
      { onConflict: 'tienda_id,device_id,local_id', ignoreDuplicates: false }
    )
  }
}

async function pushMovimientosFiado(tiendaId: string, deviceId: string) {
  const registros = await db.movimientosFiado.toArray()
  if (!registros.length) return
  await supabase.from('movimientos_fiado').upsert(
    registros.map((r) => ({
      tienda_id: tiendaId, device_id: deviceId, local_id: r.id,
      cliente_local_id: r.clienteId,
      venta_local_id: r.ventaId ?? null,
      tipo: r.tipo,
      monto: r.monto,
      descripcion: r.descripcion,
      sesion_caja_local_id: r.sesionCajaId ?? null,
      creado_en: r.creadoEn,
    })),
    { onConflict: 'tienda_id,device_id,local_id', ignoreDuplicates: false }
  )
}

async function pushGastosCaja(tiendaId: string, deviceId: string) {
  const registros = await db.gastosCaja.toArray()
  if (!registros.length) return
  await supabase.from('gastos_caja').upsert(
    registros.map((r) => ({
      tienda_id: tiendaId, device_id: deviceId, local_id: r.id,
      sesion_caja_local_id: r.sesionCajaId,
      descripcion: r.descripcion,
      monto: r.monto,
      tipo: r.tipo,
      creado_en: r.creadoEn,
    })),
    { onConflict: 'tienda_id,device_id,local_id', ignoreDuplicates: false }
  )
}

async function pushProveedores(tiendaId: string, deviceId: string) {
  const registros = await db.proveedores.toArray()
  if (!registros.length) return
  await supabase.from('proveedores').upsert(
    registros.map((r) => ({
      tienda_id: tiendaId, device_id: deviceId, local_id: r.id,
      nombre: r.nombre,
      telefono: r.telefono ?? null,
      contacto: r.contacto ?? null,
      dias_visita: r.diasVisita ?? null,
      saldo_pendiente: r.saldoPendiente,
      activo: r.activo,
      creado_en: r.creadoEn,
    })),
    { onConflict: 'tienda_id,device_id,local_id', ignoreDuplicates: false }
  )
}

async function pushComprasProveedor(tiendaId: string, deviceId: string) {
  const registros = await db.comprasProveedor.toArray()
  if (!registros.length) return
  await supabase.from('compras_proveedor').upsert(
    registros.map((r) => ({
      tienda_id: tiendaId, device_id: deviceId, local_id: r.id,
      proveedor_local_id: r.proveedorId,
      sesion_caja_local_id: r.sesionCajaId ?? null,
      total: r.total, pagado: r.pagado, saldo: r.saldo,
      tipo_pago: r.tipoPago,
      notas: r.notas ?? null,
      creada_en: r.creadaEn,
    })),
    { onConflict: 'tienda_id,device_id,local_id', ignoreDuplicates: false }
  )
}

async function pushDetallesCompra(tiendaId: string, deviceId: string) {
  const registros = await db.detallesCompra.toArray()
  if (!registros.length) return
  await supabase.from('detalles_compra').upsert(
    registros.map((r) => ({
      tienda_id: tiendaId, device_id: deviceId, local_id: r.id,
      compra_local_id: r.compraId,
      producto_local_id: r.productoId ?? null,
      nombre_producto: r.nombreProducto,
      cantidad: r.cantidad,
      precio_unitario: r.precioUnitario,
      subtotal: r.subtotal,
    })),
    { onConflict: 'tienda_id,device_id,local_id', ignoreDuplicates: false }
  )
}

async function pushPagosProveedor(tiendaId: string, deviceId: string) {
  const registros = await db.pagosProveedor.toArray()
  if (!registros.length) return
  await supabase.from('pagos_proveedor').upsert(
    registros.map((r) => ({
      tienda_id: tiendaId, device_id: deviceId, local_id: r.id,
      proveedor_local_id: r.proveedorId,
      compra_local_id: r.compraId ?? null,
      monto: r.monto,
      sesion_caja_local_id: r.sesionCajaId ?? null,
      notas: r.notas ?? null,
      creado_en: r.creadoEn,
    })),
    { onConflict: 'tienda_id,device_id,local_id', ignoreDuplicates: false }
  )
}

async function pushMovimientosStock(tiendaId: string, deviceId: string) {
  const registros = await db.movimientosStock.toArray()
  if (!registros.length) return
  for (let i = 0; i < registros.length; i += 500) {
    const lote = registros.slice(i, i + 500)
    await supabase.from('movimientos_stock').upsert(
      lote.map((r) => ({
        tienda_id: tiendaId, device_id: deviceId, local_id: r.id,
        producto_local_id: r.productoId,
        tipo: r.tipo,
        cantidad: r.cantidad,
        stock_anterior: r.stockAnterior,
        stock_nuevo: r.stockNuevo,
        costo: r.costo ?? null,
        nota: r.nota ?? null,
        venta_local_id: r.ventaId ?? null,
        compra_local_id: r.compraId ?? null,
        creado_en: r.creadoEn,
      })),
      { onConflict: 'tienda_id,device_id,local_id', ignoreDuplicates: false }
    )
  }
}

async function pushConfigTienda(tiendaId: string) {
  const cfg = await db.configTienda.get(1)
  if (!cfg) return
  await supabase.from('config_tienda').upsert(
    {
      tienda_id: tiendaId,
      nombre_tienda: cfg.nombreTienda,
      direccion: cfg.direccion ?? null,
      telefono: cfg.telefono ?? null,
      nit: cfg.nit ?? null,
      mensaje_recibo: cfg.mensajeRecibo ?? null,
      moneda_simbol: cfg.monedaSimbol,
      impuesto_iva: cfg.impuestoIVA,
      permitir_stock_negativo: cfg.permitirStockNegativo,
      limite_fiado_por_defecto: cfg.limiteFiadoPorDefecto,
    },
    { onConflict: 'tienda_id' }
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//                    FUNCIONES DE PULL POR TABLA
//  Solo descarga datos de OTROS dispositivos (device_id != myDeviceId).
//  Los inserta en Dexie sin tocar los registros locales existentes.
// ═══════════════════════════════════════════════════════════════════════════

// Los IDs de registros remotos en Dexie usan un offset alto para no colisionar
// con los IDs locales (que son auto-increment desde 1).
// El offset se basa en el hash del device_id remoto.
function remoteOffset(deviceId: string): number {
  let hash = 0
  for (let i = 0; i < deviceId.length; i++) {
    hash = ((hash << 5) - hash) + deviceId.charCodeAt(i)
    hash |= 0
  }
  // Offset de 10,000,000 + módulo para separar espacios de IDs
  return 10_000_000 + Math.abs(hash % 10_000_000)
}

async function pullClientes(tiendaId: string, myDeviceId: string) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('tienda_id', tiendaId)
    .neq('device_id', myDeviceId)

  if (error || !data) return

  for (const r of data) {
    const offset = remoteOffset(r.device_id)
    const localId = offset + r.local_id
    const existente = await db.clientes.get(localId)
    if (!existente) {
      await db.clientes.put({
        id: localId,
        nombre: r.nombre,
        telefono: r.telefono ?? undefined,
        direccion: r.direccion ?? undefined,
        limiteCredito: r.limite_credito ?? undefined,
        totalDeuda: r.total_deuda,
        activo: r.activo,
        creadoEn: new Date(r.creado_en ?? r.created_at),
      })
    } else {
      // Actualizar solo si el registro remoto es más reciente
      await db.clientes.update(localId, {
        totalDeuda: r.total_deuda,
        activo: r.activo,
      })
    }
  }
}

async function pullProductos(tiendaId: string, myDeviceId: string) {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('tienda_id', tiendaId)
    .neq('device_id', myDeviceId)
    .eq('activo', true)

  if (error || !data) return

  for (const r of data) {
    const offset = remoteOffset(r.device_id)
    const localId = offset + r.local_id
    const existente = await db.productos.get(localId)
    if (!existente) {
      await db.productos.put({
        id: localId,
        nombre: r.nombre,
        categoriaId: r.categoria_local_id ?? 13,
        precio: r.precio,
        precioCompra: r.precio_compra ?? undefined,
        codigoBarras: r.codigo_barras ?? undefined,
        stockActual: r.stock_actual ?? undefined,
        stockMinimo: r.stock_minimo ?? undefined,
        unidad: r.unidad ?? 'unidad',
        esFantasma: r.es_fantasma,
        activo: r.activo,
        creadoEn: new Date(r.creado_en ?? r.created_at),
        actualizadoEn: new Date(r.updated_at),
      })
    }
  }
}

async function pullVentas(tiendaId: string, myDeviceId: string) {
  const { data, error } = await supabase
    .from('ventas')
    .select('*')
    .eq('tienda_id', tiendaId)
    .neq('device_id', myDeviceId)
    .order('creada_en', { ascending: false })
    .limit(1000) // Últimas 1000 ventas de otros dispositivos

  if (error || !data) return

  for (const r of data) {
    const offset = remoteOffset(r.device_id)
    const localId = offset + r.local_id
    const existente = await db.ventas.get(localId)
    if (!existente) {
      await db.ventas.put({
        id: localId,
        sesionCajaId: offset + (r.sesion_caja_local_id ?? 0),
        clienteId: r.cliente_local_id ? offset + r.cliente_local_id : undefined,
        subtotal: r.subtotal,
        descuento: r.descuento,
        total: r.total,
        tipoPago: r.tipo_pago,
        efectivoRecibido: r.efectivo_recibido ?? undefined,
        cambio: r.cambio ?? undefined,
        estado: r.estado,
        notas: r.notas ?? undefined,
        creadaEn: new Date(r.creada_en),
      })
    }
  }
}

async function pullMovimientosFiado(tiendaId: string, myDeviceId: string) {
  const { data, error } = await supabase
    .from('movimientos_fiado')
    .select('*')
    .eq('tienda_id', tiendaId)
    .neq('device_id', myDeviceId)
    .order('creado_en', { ascending: false })
    .limit(500)

  if (error || !data) return

  for (const r of data) {
    const offset = remoteOffset(r.device_id)
    const localId = offset + r.local_id
    const existente = await db.movimientosFiado.get(localId)
    if (!existente) {
      await db.movimientosFiado.put({
        id: localId,
        clienteId: offset + r.cliente_local_id,
        ventaId: r.venta_local_id ? offset + r.venta_local_id : undefined,
        tipo: r.tipo,
        monto: r.monto,
        descripcion: r.descripcion,
        sesionCajaId: r.sesion_caja_local_id ? offset + r.sesion_caja_local_id : undefined,
        creadoEn: new Date(r.creado_en),
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//                    AUTO-SYNC: intervalo + reconexión
// ═══════════════════════════════════════════════════════════════════════════

let syncInterval: ReturnType<typeof setInterval> | null = null

export function startAutoSync(tiendaId: string) {
  if (!supabaseConfigurado) return

  // Sincronizar inmediatamente al arrancar
  syncToSupabase(tiendaId)

  // Luego cada 30 segundos
  syncInterval = setInterval(() => {
    syncToSupabase(tiendaId)
  }, 30_000)

  // Sincronizar también al recuperar internet
  window.addEventListener('online', () => syncToSupabase(tiendaId))
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
  window.removeEventListener('online', () => {})
}

export { getLastSyncAt }
