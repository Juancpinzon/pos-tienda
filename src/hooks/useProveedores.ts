// Hook y funciones CRUD para el módulo de proveedores y compras
// REGLA: todo acceso a DB pasa por estos hooks

import { useState, useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../db/database'
import type { Proveedor, CompraProveedor, DetalleCompra, PagoProveedor } from '../db/schema'
import { registrarEntrada } from './useStock'

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface ItemCompra {
  productoId?: number
  nombreProducto: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

export interface CompraConDetalles extends CompraProveedor {
  detalles: DetalleCompra[]
}

export interface CuentaProveedorData {
  proveedor: Proveedor
  compras: CompraConDetalles[]
  pagos: PagoProveedor[]
}

export interface PagoProveedorConNombre {
  pago: PagoProveedor
  nombreProveedor: string
}

// ─── Hooks reactivos ──────────────────────────────────────────────────────────

/**
 * Lista reactiva de proveedores activos.
 * Filtra por query si se proporciona. Ordena por mayor saldo pendiente primero.
 */
export function useProveedores(query = '') {
  const [proveedores, setProveedores] = useState<Proveedor[] | undefined>(undefined)

  useEffect(() => {
    setProveedores(undefined)
    const sub = liveQuery(async () => {
      const todos = await db.proveedores.filter((p) => p.activo).toArray()
      const lower = query.toLowerCase().trim()
      const filtrados = lower
        ? todos.filter((p) => p.nombre.toLowerCase().includes(lower))
        : todos
      return filtrados.sort((a, b) => b.saldoPendiente - a.saldoPendiente)
    }).subscribe({
      next: setProveedores,
      error: (err) => { console.error('[useProveedores]', err); setProveedores([]) },
    })
    return () => sub.unsubscribe()
  }, [query])

  return proveedores
}

/**
 * Datos reactivos de la cuenta de un proveedor: info + historial compras + pagos.
 * Retorna:
 *   undefined             → cargando
 *   null                  → proveedor no encontrado o proveedorId undefined
 *   CuentaProveedorData   → datos completos
 */
export function useCuentaProveedor(proveedorId: number | undefined) {
  const [datos, setDatos] = useState<CuentaProveedorData | null | undefined>(undefined)

  useEffect(() => {
    setDatos(undefined)
    if (!proveedorId) { setDatos(null); return }

    const sub = liveQuery(async (): Promise<CuentaProveedorData | null> => {
      const [proveedor, comprasRaw, pagos] = await Promise.all([
        db.proveedores.get(proveedorId),
        db.comprasProveedor
          .where('proveedorId').equals(proveedorId)
          .reverse()
          .toArray(),
        db.pagosProveedor
          .where('proveedorId').equals(proveedorId)
          .reverse()
          .toArray(),
      ])
      if (!proveedor) return null

      const compras: CompraConDetalles[] = await Promise.all(
        comprasRaw.map(async (c) => {
          const detalles = await db.detallesCompra
            .where('compraId').equals(c.id!)
            .toArray()
          return { ...c, detalles }
        })
      )

      return { proveedor, compras, pagos }
    }).subscribe({
      next: setDatos,
      error: (err) => { console.error('[useCuentaProveedor]', err); setDatos(null) },
    })

    return () => sub.unsubscribe()
  }, [proveedorId])

  return datos
}

/**
 * Pagos a proveedores realizados en una sesión de caja específica.
 * Útil para CajaPage: mostrar salidas de caja hacia proveedores.
 */
export function usePagosProveedoresSesion(sesionCajaId: number | undefined) {
  const [pagos, setPagos] = useState<PagoProveedorConNombre[] | undefined>(undefined)

  useEffect(() => {
    setPagos(undefined)
    if (!sesionCajaId) { setPagos([]); return }

    const sub = liveQuery(async (): Promise<PagoProveedorConNombre[]> => {
      const pagosRaw = await db.pagosProveedor
        .where('sesionCajaId').equals(sesionCajaId)
        .toArray()
      if (pagosRaw.length === 0) return []

      const provIds = [...new Set(pagosRaw.map((p) => p.proveedorId))]
      const provs = await db.proveedores.where('id').anyOf(provIds).toArray()
      const provMap: Record<number, string> = {}
      for (const pv of provs) {
        if (pv.id !== undefined) provMap[pv.id] = pv.nombre
      }

      return pagosRaw.map((p) => ({
        pago: p,
        nombreProveedor: provMap[p.proveedorId] ?? 'Proveedor',
      }))
    }).subscribe({
      next: setPagos,
      error: (err) => { console.error('[usePagosProveedoresSesion]', err); setPagos([]) },
    })

    return () => sub.unsubscribe()
  }, [sesionCajaId])

  return pagos
}

// ─── Funciones de mutación ────────────────────────────────────────────────────

/**
 * Crea un proveedor nuevo. Solo el nombre es obligatorio.
 * Retorna el ID del nuevo proveedor.
 */
export async function crearProveedor(
  nombre: string,
  extras?: Partial<Pick<Proveedor, 'telefono' | 'contacto' | 'diasVisita'>>
): Promise<number> {
  const id = await db.proveedores.add({
    nombre: nombre.trim(),
    saldoPendiente: 0,
    activo: true,
    creadoEn: new Date(),
    ...extras,
  })
  return id as number
}

/**
 * Busca proveedores por nombre para autocompletar (máximo 6 resultados).
 * No reactiva — usar en debounce de inputs.
 */
export async function buscarProveedores(query: string): Promise<Proveedor[]> {
  if (query.trim().length < 1) return []
  const lower = query.toLowerCase()
  return db.proveedores
    .filter((p) => p.activo && p.nombre.toLowerCase().includes(lower))
    .limit(6)
    .toArray()
}

/**
 * Registra una compra a un proveedor.
 * - Crea CompraProveedor + DetalleCompra records
 * - Actualiza precioCompra de cada producto catalogado
 * - Actualiza saldoPendiente del proveedor
 * - Si pagado > 0: crea PagoProveedor y GastoCaja (tipo 'proveedor')
 * Retorna el ID de la compra creada.
 */
export async function registrarCompra(
  proveedorId: number,
  items: ItemCompra[],
  tipoPago: CompraProveedor['tipoPago'],
  pagado: number,
  notas?: string,
  sesionCajaId?: number
): Promise<number> {
  const total = items.reduce((s, i) => s + i.subtotal, 0)
  const saldo = total - pagado

  // 1. Crear CompraProveedor + DetalleCompra + actualizar precios (transacción)
  const compraId = await db.transaction(
    'rw',
    [db.comprasProveedor, db.detallesCompra, db.productos],
    async () => {
      const id = await db.comprasProveedor.add({
        proveedorId,
        sesionCajaId,
        total,
        pagado,
        saldo,
        tipoPago,
        notas,
        creadaEn: new Date(),
      })

      await Promise.all(
        items.map((item) =>
          db.detallesCompra.add({
            compraId: id as number,
            productoId: item.productoId,
            nombreProducto: item.nombreProducto,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
          })
        )
      )

      // Actualizar precioCompra de los productos catalogados
      await Promise.all(
        items
          .filter((i) => i.productoId !== undefined)
          .map((i) =>
            db.productos.update(i.productoId!, {
              precioCompra: i.precioUnitario,
              actualizadoEn: new Date(),
            })
          )
      )

      return id as number
    }
  )

  // 2. Actualizar saldoPendiente del proveedor (atómico, fuera de transacción)
  await db.proveedores
    .where('id').equals(proveedorId)
    .modify((p) => { p.saldoPendiente = (p.saldoPendiente ?? 0) + saldo })

  // 3. Registrar entradas de stock para productos catalogados con stockActual definido
  await Promise.all(
    items
      .filter((i) => i.productoId !== undefined)
      .map((i) =>
        registrarEntrada(
          i.productoId!,
          i.cantidad,
          i.precioUnitario,
          `Compra a proveedor${notas ? ` — ${notas}` : ''}`,
          compraId,
        )
      )
  )

  // 3. Si se pagó algo: crear PagoProveedor y descontar de caja
  if (pagado > 0) {
    await db.pagosProveedor.add({
      proveedorId,
      compraId,
      monto: pagado,
      sesionCajaId,
      notas: notas ? `Pago al registrar compra — ${notas}` : 'Pago al contado',
      creadoEn: new Date(),
    })

    if (sesionCajaId) {
      const proveedor = await db.proveedores.get(proveedorId)
      await db.gastosCaja.add({
        sesionCajaId,
        descripcion: `Compra a ${proveedor?.nombre ?? 'proveedor'}${notas ? ` — ${notas}` : ''}`,
        monto: pagado,
        tipo: 'proveedor',
        creadoEn: new Date(),
      })
    }
  }

  return compraId
}

/**
 * Registra un pago (abono) a un proveedor por deuda pendiente.
 * - Crea PagoProveedor
 * - Actualiza saldoPendiente del proveedor
 * - Si compraId: actualiza saldo de esa compra específica
 * - Si sesionCajaId: crea GastoCaja (tipo 'proveedor')
 */
export async function registrarPagoProveedor(
  proveedorId: number,
  monto: number,
  compraId?: number,
  sesionCajaId?: number,
  notas?: string
): Promise<void> {
  // 1. Registrar el pago
  await db.pagosProveedor.add({
    proveedorId,
    compraId,
    monto,
    sesionCajaId,
    notas,
    creadoEn: new Date(),
  })

  // 2. Actualizar saldo del proveedor (atómico)
  await db.proveedores
    .where('id').equals(proveedorId)
    .modify((p) => { p.saldoPendiente = Math.max(0, (p.saldoPendiente ?? 0) - monto) })

  // 3. Si viene de una compra específica, actualizar su saldo
  if (compraId !== undefined) {
    await db.comprasProveedor
      .where('id').equals(compraId)
      .modify((c) => {
        c.pagado = (c.pagado ?? 0) + monto
        c.saldo = Math.max(0, (c.saldo ?? 0) - monto)
      })
  }

  // 4. Si hay sesión activa, crear salida de caja
  if (sesionCajaId) {
    const proveedor = await db.proveedores.get(proveedorId)
    await db.gastosCaja.add({
      sesionCajaId,
      descripcion: `Pago a ${proveedor?.nombre ?? 'proveedor'}${notas ? ` — ${notas}` : ''}`,
      monto,
      tipo: 'proveedor',
      creadoEn: new Date(),
    })
  }
}
