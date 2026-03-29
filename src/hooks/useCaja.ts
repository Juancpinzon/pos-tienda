// Hook y funciones CRUD para el módulo de caja
// REGLA: todo acceso a DB pasa por estos hooks

import { useState, useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../db/database'
import type { SesionCaja, GastoCaja } from '../db/schema'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ResumenCaja {
  sesion: SesionCaja
  totalVentas: number
  totalEfectivo: number
  totalFiado: number
  totalTransferencia: number
  totalGastos: number
  cantidadVentas: number
  efectivoEsperado: number   // montoApertura + totalEfectivo - totalGastos
  gastos: GastoCaja[]
  ultimasVentas: UltimaVenta[]
}

export interface UltimaVenta {
  id: number
  total: number
  tipoPago: string
  creadaEn: Date
  itemCount: number
}

// ─── Hooks reactivos ─────────────────────────────────────────────────────────

/**
 * Sesión de caja actualmente abierta.
 * Retorna:
 *   undefined  → cargando (query en curso)
 *   null       → no hay sesión abierta
 *   SesionCaja → sesión activa
 *
 * NOTA: distinguir null de undefined es crítico para CajaPage y el badge
 * de "Caja sin abrir" en el header. Con useLiveQuery esto no funcionaba
 * porque retornaba undefined tanto para "cargando" como para "sin sesión".
 */
export function useSesionActual() {
  const [sesion, setSesion] = useState<SesionCaja | null | undefined>(undefined)

  useEffect(() => {
    const subscription = liveQuery(
      () => db.sesionCaja.where('estado').equals('abierta').first()
    ).subscribe({
      // .first() retorna SesionCaja | undefined; mapeamos undefined → null
      next: (result) => setSesion(result ?? null),
      error: (err) => {
        console.error('[useSesionActual]', err)
        setSesion(null)
      },
    })
    return () => subscription.unsubscribe()
  }, [])

  return sesion
}

/**
 * Resumen completo de una sesión de caja (ventas, gastos, totales calculados).
 * Retorna undefined mientras carga, null si no hay sesión, o ResumenCaja.
 */
export function useResumenCaja(sesionId: number | undefined) {
  const [resumen, setResumen] = useState<ResumenCaja | null | undefined>(undefined)

  useEffect(() => {
    // Reiniciar a "cargando" cada vez que cambia la sesión
    setResumen(undefined)

    if (!sesionId) {
      setResumen(null)
      return
    }

    const subscription = liveQuery(async (): Promise<ResumenCaja | null> => {
      const sesion = await db.sesionCaja.get(sesionId)
      if (!sesion) return null

      const ventas = await db.ventas
        .where('sesionCajaId').equals(sesionId)
        .filter((v) => v.estado === 'completada')
        .toArray()

      const gastos = await db.gastosCaja
        .where('sesionCajaId').equals(sesionId)
        .toArray()

      const totalVentas = ventas.reduce((s, v) => s + v.total, 0)
      const totalEfectivo = ventas
        .filter((v) => v.tipoPago === 'efectivo')
        .reduce((s, v) => s + v.total, 0)
      const totalFiado = ventas
        .filter((v) => v.tipoPago === 'fiado')
        .reduce((s, v) => s + v.total, 0)
      const totalTransferencia = ventas
        .filter((v) => v.tipoPago === 'transferencia')
        .reduce((s, v) => s + v.total, 0)
      const totalGastos = gastos.reduce((s, g) => s + g.monto, 0)
      const efectivoEsperado = sesion.montoApertura + totalEfectivo - totalGastos

      // Últimas 10 ventas con conteo de ítems
      const ultimasVentas = await Promise.all(
        ventas
          .sort((a, b) => b.creadaEn.getTime() - a.creadaEn.getTime())
          .slice(0, 10)
          .map(async (v) => {
            const itemCount = await db.detallesVenta
              .where('ventaId').equals(v.id!)
              .count()
            return {
              id: v.id!,
              total: v.total,
              tipoPago: v.tipoPago,
              creadaEn: v.creadaEn,
              itemCount,
            }
          })
      )

      return {
        sesion,
        totalVentas,
        totalEfectivo,
        totalFiado,
        totalTransferencia,
        totalGastos,
        cantidadVentas: ventas.length,
        efectivoEsperado,
        gastos,
        ultimasVentas,
      }
    }).subscribe({
      next: (result) => setResumen(result),
      error: (err) => {
        console.error('[useResumenCaja]', err)
        setResumen(null)
      },
    })

    return () => subscription.unsubscribe()
  }, [sesionId])

  return resumen
}

/**
 * Historial de las últimas 30 sesiones (más recientes primero).
 */
export function useHistorialCajas() {
  const [historial, setHistorial] = useState<SesionCaja[] | undefined>(undefined)

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const todas = await db.sesionCaja.toArray()
      return todas
        .sort((a, b) => b.abiertaEn.getTime() - a.abiertaEn.getTime())
        .slice(0, 30)
    }).subscribe({
      next: setHistorial,
      error: (err) => {
        console.error('[useHistorialCajas]', err)
        setHistorial([])
      },
    })
    return () => subscription.unsubscribe()
  }, [])

  return historial
}

// ─── Funciones de mutación ────────────────────────────────────────────────────

/**
 * Abre una nueva sesión de caja. Retorna el ID de la sesión creada.
 */
export async function abrirCaja(montoApertura: number): Promise<number> {
  const existente = await db.sesionCaja.where('estado').equals('abierta').first()
  if (existente) throw new Error('Ya hay una sesión de caja abierta')

  const id = await db.sesionCaja.add({
    montoApertura,
    totalVentas: 0,
    totalEfectivo: 0,
    totalFiado: 0,
    totalGastos: 0,
    abiertaEn: new Date(),
    estado: 'abierta',
  })
  return id as number
}

/**
 * Cierra la sesión activa recalculando todos los totales desde las ventas reales.
 */
export async function cerrarCaja(
  sesionId: number,
  montoCierre: number,
  notas?: string
): Promise<void> {
  const sesion = await db.sesionCaja.get(sesionId)
  if (!sesion) throw new Error('Sesión no encontrada')
  if (sesion.estado === 'cerrada') throw new Error('La sesión ya está cerrada')

  const ventas = await db.ventas
    .where('sesionCajaId').equals(sesionId)
    .filter((v) => v.estado === 'completada')
    .toArray()

  const gastos = await db.gastosCaja
    .where('sesionCajaId').equals(sesionId)
    .toArray()

  const totalVentas = ventas.reduce((s, v) => s + v.total, 0)
  const totalEfectivo = ventas
    .filter((v) => v.tipoPago === 'efectivo')
    .reduce((s, v) => s + v.total, 0)
  const totalFiado = ventas
    .filter((v) => v.tipoPago === 'fiado')
    .reduce((s, v) => s + v.total, 0)
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0)

  await db.sesionCaja.update(sesionId, {
    estado: 'cerrada',
    montoCierre,
    totalVentas,
    totalEfectivo,
    totalFiado,
    totalGastos,
    cerradaEn: new Date(),
    notas,
  })
}

/**
 * Registra un gasto en la sesión indicada.
 */
export async function registrarGasto(
  sesionCajaId: number,
  descripcion: string,
  monto: number,
  tipo: GastoCaja['tipo']
): Promise<void> {
  await db.gastosCaja.add({
    sesionCajaId,
    descripcion,
    monto,
    tipo,
    creadoEn: new Date(),
  })
}

/**
 * Obtiene la sesión actualmente abierta (no-reactiva, para uso en mutaciones).
 */
export async function obtenerSesionActiva(): Promise<SesionCaja | undefined> {
  return db.sesionCaja.where('estado').equals('abierta').first()
}

/**
 * Obtiene la última sesión de caja cerrada (la más reciente por fecha de cierre).
 * Sirve para sugerir el monto de apertura de la siguiente jornada.
 */
export async function obtenerUltimaCajaCerrada(): Promise<SesionCaja | undefined> {
  const cerradas = await db.sesionCaja.where('estado').equals('cerrada').toArray()
  if (cerradas.length === 0) return undefined
  return cerradas.sort(
    (a, b) => (b.cerradaEn?.getTime() ?? 0) - (a.cerradaEn?.getTime() ?? 0)
  )[0]
}
