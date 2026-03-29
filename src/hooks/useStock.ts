// Hook y funciones CRUD para el módulo de control de stock
// REGLA: todo acceso a DB pasa por estos hooks

import { useState, useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../db/database'
import type { Producto, MovimientoStock } from '../db/schema'

// ─── Hooks reactivos ──────────────────────────────────────────────────────────

/**
 * Productos activos cuyo stockActual <= stockMinimo.
 * Ordenados por déficit mayor primero.
 */
export function useProductosBajoStock() {
  const [productos, setProductos] = useState<Producto[] | undefined>(undefined)

  useEffect(() => {
    const sub = liveQuery(async () => {
      const todos = await db.productos
        .filter(
          (p) =>
            p.activo &&
            !p.esFantasma &&
            p.stockActual !== undefined &&
            p.stockActual !== null &&
            p.stockMinimo !== undefined &&
            p.stockMinimo !== null &&
            (p.stockActual as number) <= (p.stockMinimo as number)
        )
        .toArray()
      return todos.sort((a, b) => {
        const defA = (a.stockMinimo ?? 0) - (a.stockActual ?? 0)
        const defB = (b.stockMinimo ?? 0) - (b.stockActual ?? 0)
        return defB - defA
      })
    }).subscribe({
      next: setProductos,
      error: (err) => { console.error('[useProductosBajoStock]', err); setProductos([]) },
    })
    return () => sub.unsubscribe()
  }, [])

  return productos
}

/**
 * Productos activos con stock controlado (stockActual definido).
 * Filtra por query. Los bajo mínimo aparecen primero.
 */
export function useProductosConStock(query = '') {
  const [productos, setProductos] = useState<Producto[] | undefined>(undefined)

  useEffect(() => {
    setProductos(undefined)
    const sub = liveQuery(async () => {
      const todos = await db.productos
        .filter(
          (p) =>
            p.activo &&
            !p.esFantasma &&
            p.stockActual !== undefined &&
            p.stockActual !== null
        )
        .toArray()

      const lower = query.toLowerCase().trim()
      const filtrados = lower
        ? todos.filter((p) => p.nombre.toLowerCase().includes(lower))
        : todos

      return filtrados.sort((a, b) => {
        const aLow =
          a.stockMinimo !== undefined &&
          (a.stockActual as number) <= (a.stockMinimo as number)
        const bLow =
          b.stockMinimo !== undefined &&
          (b.stockActual as number) <= (b.stockMinimo as number)
        if (aLow && !bLow) return -1
        if (!aLow && bLow) return 1
        return a.nombre.localeCompare(b.nombre, 'es')
      })
    }).subscribe({
      next: setProductos,
      error: (err) => { console.error('[useProductosConStock]', err); setProductos([]) },
    })
    return () => sub.unsubscribe()
  }, [query])

  return productos
}

/**
 * Últimos 30 movimientos de stock de un producto específico (más recientes primero).
 */
export function useMovimientosStock(productoId: number | undefined) {
  const [movimientos, setMovimientos] = useState<MovimientoStock[] | undefined>(undefined)

  useEffect(() => {
    setMovimientos(undefined)
    if (!productoId) { setMovimientos([]); return }

    const sub = liveQuery(async () =>
      db.movimientosStock
        .where('productoId').equals(productoId)
        .reverse()
        .limit(30)
        .toArray()
    ).subscribe({
      next: setMovimientos,
      error: (err) => { console.error('[useMovimientosStock]', err); setMovimientos([]) },
    })
    return () => sub.unsubscribe()
  }, [productoId])

  return movimientos
}

// ─── Funciones de mutación ────────────────────────────────────────────────────

/**
 * Registra una entrada de stock (compra, devolución, corrección al alza).
 * No-op si el producto no tiene stock controlado (stockActual undefined).
 */
export async function registrarEntrada(
  productoId: number,
  cantidad: number,
  costo?: number,
  nota?: string,
  compraId?: number
): Promise<void> {
  const producto = await db.productos.get(productoId)
  if (!producto) return
  if (producto.stockActual === undefined || producto.stockActual === null) return

  const stockAnterior = producto.stockActual
  const stockNuevo = stockAnterior + cantidad

  await db.transaction('rw', [db.productos, db.movimientosStock], async () => {
    await db.productos.update(productoId, {
      stockActual: stockNuevo,
      actualizadoEn: new Date(),
    })
    await db.movimientosStock.add({
      productoId,
      tipo: 'entrada',
      cantidad,
      stockAnterior,
      stockNuevo,
      costo,
      nota,
      compraId,
      creadoEn: new Date(),
    })
  })
}

/**
 * Registra una salida de stock (venta, merma, robo, corrección a la baja).
 * No-op si el producto no tiene stock controlado.
 * Permite stock negativo — NUNCA bloquea.
 */
export async function registrarSalida(
  productoId: number,
  cantidad: number,
  motivo?: string,
  ventaId?: number
): Promise<void> {
  const producto = await db.productos.get(productoId)
  if (!producto) return
  if (producto.stockActual === undefined || producto.stockActual === null) return

  const stockAnterior = producto.stockActual
  const stockNuevo = stockAnterior - cantidad

  await db.transaction('rw', [db.productos, db.movimientosStock], async () => {
    await db.productos.update(productoId, {
      stockActual: stockNuevo,
      actualizadoEn: new Date(),
    })
    await db.movimientosStock.add({
      productoId,
      tipo: ventaId !== undefined ? 'venta' : 'salida',
      cantidad,
      stockAnterior,
      stockNuevo,
      nota: motivo,
      ventaId,
      creadoEn: new Date(),
    })
  })
}

/**
 * Ajusta el stock a un valor exacto (conteo físico).
 * Funciona incluso si el producto no tenía stock controlado antes
 * (se habilita con el ajuste).
 */
export async function registrarAjuste(
  productoId: number,
  stockNuevo: number,
  nota?: string
): Promise<void> {
  const producto = await db.productos.get(productoId)
  if (!producto) return

  const stockAnterior = producto.stockActual ?? 0
  const diferencia = stockNuevo - stockAnterior

  await db.transaction('rw', [db.productos, db.movimientosStock], async () => {
    await db.productos.update(productoId, {
      stockActual: stockNuevo,
      actualizadoEn: new Date(),
    })
    await db.movimientosStock.add({
      productoId,
      tipo: 'ajuste',
      cantidad: Math.abs(diferencia),
      stockAnterior,
      stockNuevo,
      nota: nota ?? `Ajuste: ${stockAnterior} → ${stockNuevo}`,
      creadoEn: new Date(),
    })
  })
}

/**
 * Verifica si una lista de ítems de venta dejaría algún producto en stock negativo.
 * Retorna los productos afectados (para mostrar advertencia, sin bloquear).
 */
export async function verificarStockInsuficiente(
  items: Array<{ productoId?: number; cantidad: number }>
): Promise<Array<{ nombre: string; stockActual: number; faltante: number }>> {
  const alertas: Array<{ nombre: string; stockActual: number; faltante: number }> = []

  for (const item of items) {
    if (!item.productoId) continue
    const producto = await db.productos.get(item.productoId)
    if (!producto || producto.stockActual === undefined || producto.stockActual === null) continue
    if (producto.stockActual - item.cantidad < 0) {
      alertas.push({
        nombre: producto.nombre,
        stockActual: producto.stockActual,
        faltante: item.cantidad - producto.stockActual,
      })
    }
  }

  return alertas
}
