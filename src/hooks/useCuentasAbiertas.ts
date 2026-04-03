// useCuentasAbiertas.ts — Gestión de cuentas abiertas (comandas / ventas por rondas)
//
// Caso de uso: cliente llega, pide cerveza, luego otra, luego una más.
// Al final paga todo junto. La cuenta persiste en IndexedDB aunque se cierre la app.

import { useState, useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../db/database'
import type { CuentaAbierta, ItemCuenta } from '../db/schema'

// ─── Hook reactivo ────────────────────────────────────────────────────────────

/** Retorna todas las cuentas abiertas en tiempo real */
export function useCuentasAbiertas() {
  const [cuentas, setCuentas] = useState<CuentaAbierta[] | undefined>(undefined)

  useEffect(() => {
    const sub = liveQuery(() =>
      db.cuentasAbiertas
        .where('estado')
        .equals('abierta')
        .reverse()           // más reciente primero
        .toArray()
    ).subscribe({
      next: setCuentas,
      error: () => setCuentas([]),
    })
    return () => sub.unsubscribe()
  }, [])

  return cuentas
}

/** Cuenta de cuentas abiertas (para indicador en header) */
export function useCantidadCuentasAbiertas(): number {
  const [cantidad, setCantidad] = useState(0)

  useEffect(() => {
    const sub = liveQuery(() =>
      db.cuentasAbiertas.where('estado').equals('abierta').count()
    ).subscribe({
      next: setCantidad,
      error: () => setCantidad(0),
    })
    return () => sub.unsubscribe()
  }, [])

  return cantidad
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/** Crea una nueva cuenta abierta. Retorna el id generado. */
export async function abrirCuenta(nombre: string, sesionCajaId?: number): Promise<number> {
  return db.cuentasAbiertas.add({
    nombre: nombre.trim(),
    items: [],
    total: 0,
    estado: 'abierta',
    sesionCajaId,
    creadaEn: new Date(),
    actualizadoEn: new Date(),
  })
}

/** Persiste todos los ítems del carrito actual en la cuenta. Llamar tras cada cambio en ventaStore. */
export async function sincronizarItemsCuenta(
  cuentaId: number,
  items: ItemCuenta[]
): Promise<void> {
  const total = items.reduce((s, i) => s + i.subtotal, 0)
  await db.cuentasAbiertas.update(cuentaId, {
    items,
    total,
    actualizadoEn: new Date(),
  })
}

/** Carga los ítems de una cuenta — para restaurar el carrito al seleccionarla. */
export async function obtenerCuenta(cuentaId: number): Promise<CuentaAbierta | undefined> {
  return db.cuentasAbiertas.get(cuentaId)
}

/** Marca la cuenta como cobrada. Llamar después de registrar la Venta. */
export async function marcarCuentaCobrada(cuentaId: number): Promise<void> {
  await db.cuentasAbiertas.update(cuentaId, {
    estado: 'cobrada',
    actualizadoEn: new Date(),
  })
}

/** Elimina definitivamente una cuenta abierta (borrar sin cobrar). */
export async function eliminarCuenta(cuentaId: number): Promise<void> {
  await db.cuentasAbiertas.delete(cuentaId)
}

/** Sugiere el siguiente nombre de mesa disponible: "Mesa 1", "Mesa 2", etc. */
export async function sugerirNombreCuenta(): Promise<string> {
  const cuentas = await db.cuentasAbiertas
    .where('estado')
    .equals('abierta')
    .toArray()

  const numerosMesa = cuentas
    .map((c) => {
      const m = c.nombre.match(/^Mesa\s+(\d+)$/i)
      return m ? parseInt(m[1]) : null
    })
    .filter((n): n is number => n !== null)

  // Siguiente número libre
  let siguiente = 1
  while (numerosMesa.includes(siguiente)) siguiente++
  return `Mesa ${siguiente}`
}
