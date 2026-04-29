// Agente de Cobro de Fiados — Fase 23
// Se ejecuta una sola vez por día al montar la app.
// No interrumpe el flujo de carga bajo ninguna circunstancia.

import { db } from '../db/database'
import { notificarCobroFiados } from './notificaciones'

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface ClienteConMora {
  nombre: string
  totalDeuda: number
  diasSinPago: number  // días desde el último movimiento registrado
}

export interface ResultadoCobroFiados {
  totalClientes: number  // cantidad de clientes con mora >= 7 días
  totalDeuda: number     // suma total de deudas en COP
  clientes: ClienteConMora[]
}

// ─── Guardia de ejecución diaria ──────────────────────────────────────────────

const LS_KEY = 'agente_fiados_ultima_ejecucion'

/** Retorna la fecha de hoy como string YYYY-MM-DD (zona local). */
function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** True si el agente ya corrió hoy (según localStorage). */
function yaCorrioHoy(): boolean {
  return localStorage.getItem(LS_KEY) === hoyISO()
}

/** Marca en localStorage que el agente ya corrió hoy. */
function marcarEjecucion(): void {
  localStorage.setItem(LS_KEY, hoyISO())
}

// ─── Lógica de negocio ────────────────────────────────────────────────────────

/**
 * Consulta la base de datos local y devuelve los clientes activos con deuda
 * cuyo último movimiento tiene 7 o más días de antigüedad.
 *
 * Para cada cliente buscamos el movimiento más reciente en movimientosFiado
 * (cualquier tipo: cargo o pago) porque lo que interesa es la última actividad
 * en la cuenta, no solo el último cargo.
 *
 * Retorna null si no hay ningún cliente en mora.
 * El array viene ordenado por diasSinPago descendente (más antiguo primero),
 * para que la notificación mencione al cliente de mayor urgencia.
 */
export async function verificarFiadosVencidos(): Promise<ResultadoCobroFiados | null> {
  // 1. Traer todos los clientes activos con deuda pendiente
  const clientesConDeuda = await db.clientes
    .filter((c) => c.activo && c.totalDeuda > 0)
    .toArray()

  if (clientesConDeuda.length === 0) return null

  const ahora = Date.now()
  const MS_POR_DIA = 1000 * 60 * 60 * 24
  const UMBRAL_DIAS = 7

  // 2. Para cada cliente, buscar el movimiento más reciente
  const filas = await Promise.all(
    clientesConDeuda.map(async (cliente) => {
      // movimientosFiado tiene índice en clienteId y creadoEn
      const movimientos = await db.movimientosFiado
        .where('clienteId')
        .equals(cliente.id!)
        .toArray()

      // Seleccionar el más reciente por fecha de creación
      const ultimo = movimientos.reduce<Date | null>((max, m) => {
        const fecha = new Date(m.creadoEn)
        return max === null || fecha > max ? fecha : max
      }, null)

      // Si no hay ningún movimiento, usar ultimoMovimiento del cliente como fallback
      const referencia = ultimo ?? (cliente.ultimoMovimiento ? new Date(cliente.ultimoMovimiento) : null)

      // Sin referencia no podemos calcular mora — excluir
      if (!referencia) return null

      const diasSinPago = Math.floor((ahora - referencia.getTime()) / MS_POR_DIA)

      // Solo incluir si supera el umbral de mora
      if (diasSinPago < UMBRAL_DIAS) return null

      return {
        nombre: cliente.nombre,
        totalDeuda: cliente.totalDeuda,
        diasSinPago,
      } satisfies ClienteConMora
    }),
  )

  // 3. Filtrar nulos y ordenar por mayor antigüedad primero
  const enMora = (filas.filter(Boolean) as ClienteConMora[]).sort(
    (a, b) => b.diasSinPago - a.diasSinPago,
  )

  if (enMora.length === 0) return null

  return {
    totalClientes: enMora.length,
    totalDeuda: enMora.reduce((s, c) => s + c.totalDeuda, 0),
    clientes: enMora,
  }
}

/**
 * Punto de entrada del agente. Se llama una vez al montar la app.
 *
 * Guarda en localStorage la fecha de la última ejecución para no spamear
 * al tendero con la misma notificación más de una vez al día.
 * Los errores internos deben manejarse con .catch() en el llamador.
 */
export async function ejecutarAgenteFiados(): Promise<void> {
  // Guardia diaria: no correr más de una vez por día
  if (yaCorrioHoy()) return

  const resultado = await verificarFiadosVencidos()

  if (resultado) {
    await notificarCobroFiados(resultado)
  }

  // Marcar SIEMPRE al final, incluso si no hubo mora, para no repetir la consulta
  marcarEjecucion()
}
