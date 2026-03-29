// Hook y funciones CRUD para el módulo de fiados/cartera
// REGLA: todo acceso a DB pasa por estos hooks, nunca directo desde componentes

import { useState, useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../db/database'
import type { Cliente, MovimientoFiado } from '../db/schema'
import { formatCOP } from '../utils/moneda'

// ─── Tipos exportados ────────────────────────────────────────────────────────

export interface ClienteConMovimientos {
  cliente: Cliente
  movimientos: MovimientoFiado[]
}

// ─── Hooks reactivos (para componentes que necesitan re-render automático) ───

/**
 * Lista reactiva de todos los clientes activos.
 * Filtra por `query` si se proporciona. Ordena por mayor deuda primero.
 * Retorna undefined mientras carga, Cliente[] cuando resuelve.
 */
export function useClientes(query = '') {
  const [clientes, setClientes] = useState<Cliente[] | undefined>(undefined)

  useEffect(() => {
    // Resetear a "cargando" cuando cambia el filtro de búsqueda
    setClientes(undefined)

    const subscription = liveQuery(async () => {
      const todos = await db.clientes.filter((c) => c.activo).toArray()
      const lower = query.toLowerCase().trim()
      const filtrados = lower
        ? todos.filter((c) => c.nombre.toLowerCase().includes(lower))
        : todos
      return filtrados.sort((a, b) => b.totalDeuda - a.totalDeuda)
    }).subscribe({
      next: setClientes,
      error: (err) => {
        console.error('[useClientes]', err)
        setClientes([])
      },
    })

    return () => subscription.unsubscribe()
  }, [query])

  return clientes
}

/**
 * Datos reactivos de la cuenta de un cliente: info + historial de movimientos.
 * Retorna:
 *   undefined              → cargando
 *   null                   → cliente no encontrado (o clienteId undefined)
 *   ClienteConMovimientos  → datos del cliente con su historial
 */
export function useCuentaCliente(clienteId: number | undefined) {
  const [datos, setDatos] = useState<ClienteConMovimientos | null | undefined>(undefined)

  useEffect(() => {
    setDatos(undefined)

    if (!clienteId) {
      setDatos(null)
      return
    }

    const subscription = liveQuery(async (): Promise<ClienteConMovimientos | null> => {
      const [cliente, movimientos] = await Promise.all([
        db.clientes.get(clienteId),
        db.movimientosFiado
          .where('clienteId')
          .equals(clienteId)
          .reverse()   // más recientes primero
          .toArray(),
      ])
      if (!cliente) return null
      return { cliente, movimientos: movimientos ?? [] }
    }).subscribe({
      next: setDatos,
      error: (err) => {
        console.error('[useCuentaCliente]', err)
        setDatos(null)
      },
    })

    return () => subscription.unsubscribe()
  }, [clienteId])

  return datos
}

// ─── Funciones de mutación (async, no reactivas) ─────────────────────────────

/**
 * Busca clientes por nombre para autocompletar (máximo 6 resultados).
 * No reactiva — usar en debounce de inputs.
 */
export async function buscarClientes(query: string): Promise<Cliente[]> {
  if (query.trim().length < 1) return []
  const lower = query.toLowerCase()
  return db.clientes
    .filter((c) => c.activo && c.nombre.toLowerCase().includes(lower))
    .limit(6)
    .toArray()
}

/**
 * Crea un cliente nuevo. Solo el nombre es obligatorio.
 * Retorna el ID del nuevo cliente.
 */
export async function crearCliente(
  nombre: string,
  extras?: Partial<Pick<Cliente, 'telefono' | 'direccion' | 'limiteCredito'>>
): Promise<number> {
  const id = await db.clientes.add({
    nombre: nombre.trim(),
    totalDeuda: 0,
    activo: true,
    creadoEn: new Date(),
    ...extras,
  })
  return id as number
}

/**
 * Registra un pago contra la deuda de un cliente.
 * Transacción atómica: crea MovimientoFiado y actualiza totalDeuda.
 * Permite pagos parciales, totales y "sobrepagos" (crédito a favor).
 */
export async function registrarPago(
  clienteId: number,
  monto: number,
  sesionCajaId?: number
): Promise<void> {
  await db.transaction('rw', [db.movimientosFiado, db.clientes], async () => {
    await db.movimientosFiado.add({
      clienteId,
      tipo: 'pago',
      monto,
      descripcion: `Pago de deuda — ${formatCOP(monto)}`,
      creadoEn: new Date(),
      sesionCajaId,
    })
    const cliente = await db.clientes.get(clienteId)
    if (cliente) {
      // Permitir saldo negativo (crédito a favor del cliente)
      await db.clientes.update(clienteId, {
        totalDeuda: (cliente.totalDeuda ?? 0) - monto,
      })
    }
  })
}

/**
 * Obtiene un cliente por ID (una sola vez, no reactivo).
 */
export async function obtenerCliente(clienteId: number): Promise<Cliente | undefined> {
  return db.clientes.get(clienteId)
}
