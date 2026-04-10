// Hook y funciones CRUD para ventas — historial y anulación
// REGLA: todo acceso a DB pasa por estos hooks

import { useState, useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../db/database'
import { registrarEntrada } from './useStock'
import type { Venta, DetalleVenta } from '../db/schema'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface VentaConDetalles {
  venta: Venta & { id: number }
  detalles: DetalleVenta[]
  nombreCliente?: string
}

// ─── Hook reactivo ────────────────────────────────────────────────────────────

/**
 * Retorna todas las ventas (completadas Y anuladas) dentro del rango [inicio, fin).
 * Incluye detalles y nombre del cliente para ventas a fiado.
 * Ordenadas de más reciente a más antigua.
 */
export function useVentasPeriodo(inicio: Date, fin: Date) {
  const [ventas, setVentas] = useState<VentaConDetalles[] | undefined>(undefined)

  useEffect(() => {
    setVentas(undefined)

    const sub = liveQuery(async (): Promise<VentaConDetalles[]> => {
      const ventasRaw = await db.ventas
        .where('creadaEn')
        .between(inicio, fin, true, false)
        .reverse()
        .toArray()

      // Cargar detalles y nombres de clientes en paralelo
      const resultados = await Promise.all(
        ventasRaw.map(async (venta) => {
          const detalles = await db.detallesVenta
            .where('ventaId')
            .equals(venta.id!)
            .toArray()

          let nombreCliente: string | undefined
          if (venta.clienteId !== undefined) {
            const cliente = await db.clientes.get(venta.clienteId)
            nombreCliente = cliente?.nombre
          }

          return {
            venta: venta as Venta & { id: number },
            detalles,
            nombreCliente,
          }
        })
      )

      return resultados
    }).subscribe({
      next: setVentas,
      error: (err) => {
        console.error('[useVentasPeriodo]', err)
        setVentas([])
      },
    })

    return () => sub.unsubscribe()
  }, [inicio, fin])

  return ventas
}

// ─── Función de anulación ─────────────────────────────────────────────────────

/**
 * Anula una venta completada.
 * - Registra en auditoriaAnulaciones quién anuló, por qué y qué venta era
 * - Marca la venta como 'anulada' en Dexie
 * - Si era fiado: crea un MovimientoFiado de tipo 'pago' para revertir el cargo
 *   y reduce la totalDeuda del cliente
 * - Restaura stock para productos con control activo
 * Las ventas anuladas nunca se borran — quedan visibles en el historial.
 */
export async function anularVenta(
  ventaId: number,
  motivo: string,
  usuarioNombre: string,
  usuarioRol: string,
): Promise<void> {
  const venta = await db.ventas.get(ventaId)
  if (!venta) throw new Error('Venta no encontrada')
  if (venta.estado === 'anulada') throw new Error('La venta ya está anulada')

  const ahora = new Date()

  // Transacción atómica: anular venta + revertir fiado si aplica
  await db.transaction('rw', [db.ventas, db.movimientosFiado, db.clientes], async () => {
    await db.ventas.update(ventaId, { estado: 'anulada' })

    if (venta.tipoPago === 'fiado' && venta.clienteId !== undefined) {
      await db.movimientosFiado.add({
        clienteId: venta.clienteId,
        ventaId,
        tipo: 'pago',
        monto: venta.total,
        descripcion: `Anulación de venta #${ventaId}`,
        creadoEn: ahora,
        sesionCajaId: venta.sesionCajaId,
      })

      // Revertir deuda — no puede quedar negativa
      await db.clientes
        .where('id').equals(venta.clienteId)
        .modify((c) => {
          c.totalDeuda = Math.max(0, (c.totalDeuda ?? 0) - venta.total)
          c.ultimoMovimiento = ahora
        })
    }
  })

  // Restaurar stock fuera de la transacción principal para evitar
  // conflictos con la tabla movimientosStock (tiene su propia transacción interna)
  const detalles = await db.detallesVenta
    .where('ventaId').equals(ventaId)
    .toArray()

  for (const d of detalles) {
    if (d.productoId !== undefined && !d.esProductoFantasma) {
      await registrarEntrada(
        d.productoId,
        d.cantidad,
        undefined,
        `Anulación venta #${ventaId}`
      )
    }
  }

  // Registro de auditoría — quién anuló, cuándo y por qué
  await db.auditoriaAnulaciones.add({
    ventaId,
    ventaTotal: venta.total,
    ventaTipoPago: venta.tipoPago,
    usuarioNombre,
    usuarioRol,
    motivo,
    creadoEn: ahora,
  })
}

// ─── Utilidades de período ────────────────────────────────────────────────────

export type PeriodoHistorial = 'hoy' | 'ayer' | 'semana' | 'mes'

export function rangoPeriodo(periodo: PeriodoHistorial): { inicio: Date; fin: Date } {
  const ahora = new Date()
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())

  if (periodo === 'hoy') {
    return {
      inicio: hoy,
      fin: new Date(hoy.getTime() + 24 * 60 * 60 * 1000),
    }
  }
  if (periodo === 'ayer') {
    const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000)
    return { inicio: ayer, fin: hoy }
  }
  if (periodo === 'semana') {
    const inicio = new Date(hoy)
    inicio.setDate(inicio.getDate() - 6)
    return { inicio, fin: new Date(ahora.getTime() + 1) }
  }
  // mes
  return {
    inicio: new Date(ahora.getFullYear(), ahora.getMonth(), 1),
    fin: new Date(ahora.getTime() + 1),
  }
}
