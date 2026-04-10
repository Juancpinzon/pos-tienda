// src/hooks/useMermas.ts
// Hook para registrar y consultar mermas (pérdidas de producto por
// vencimiento, daño o consumo interno). Offline-first — usa Dexie.

import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../db/database'
import type { Merma } from '../db/schema'

// ─── Utilidades de fecha ───────────────────────────────────────────────────────

function inicioDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
}

function inicioMes(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useMermas() {
  const [mermas, setMermas]     = useState<Merma[]>([])
  const [mermasHoy, setMermasHoy] = useState<Merma[]>([])

  // Suscripción reactiva a TODAS las mermas (recientes primero)
  useEffect(() => {
    const sub = liveQuery(async () => {
      const todas = await db.mermas.orderBy('creadoEn').reverse().toArray()
      return todas
    }).subscribe({
      next: setMermas,
      error: (e) => console.error('[useMermas]', e),
    })
    return () => sub.unsubscribe()
  }, [])

  // Suscripción reactiva a las mermas de hoy
  useEffect(() => {
    const sub = liveQuery(async () => {
      const hoy = inicioDia(new Date())
      return db.mermas
        .where('creadoEn').aboveOrEqual(hoy)
        .reverse()
        .toArray()
    }).subscribe({
      next: setMermasHoy,
      error: (e) => console.error('[useMermas:hoy]', e),
    })
    return () => sub.unsubscribe()
  }, [])

  // ── Métricas derivadas ─────────────────────────────────────────────────────

  const costoTotalMermasHoy: number =
    mermasHoy.reduce((s, m) => s + m.costoTotal, 0)

  const costoTotalMermasMes: number =
    mermas
      .filter((m) => m.creadoEn >= inicioMes())
      .reduce((s, m) => s + m.costoTotal, 0)

  // ── Registrar una merma ────────────────────────────────────────────────────

  async function registrarMerma(
    datos: Omit<Merma, 'id' | 'creadoEn'>,
  ): Promise<void> {
    // Calcular costoTotal con exactitud
    const costoTotal = datos.cantidad * datos.precioCompra

    await db.transaction('rw', [db.mermas, db.productos], async () => {
      // Guardar la merma
      await db.mermas.add({
        ...datos,
        costoTotal,
        creadoEn: new Date(),
      })

      // Descontar del stock si el producto está catalogado y tiene stock controlado
      if (datos.productoId !== undefined) {
        const producto = await db.productos.get(datos.productoId)
        if (
          producto &&
          producto.stockActual !== undefined &&
          producto.stockActual !== null
        ) {
          const nuevoStock = Math.max(0, producto.stockActual - datos.cantidad)
          await db.productos.update(datos.productoId, {
            stockActual: nuevoStock,
            actualizadoEn: new Date(),
          })
        }
      }
    })
  }

  // ── Consulta por período ───────────────────────────────────────────────────

  async function getMermasPorPeriodo(desde: Date, hasta: Date): Promise<Merma[]> {
    return db.mermas
      .where('creadoEn')
      .between(desde, hasta, true, true)
      .reverse()
      .toArray()
  }

  return {
    mermas,
    mermasHoy,
    costoTotalMermasHoy,
    costoTotalMermasMes,
    registrarMerma,
    getMermasPorPeriodo,
  }
}
