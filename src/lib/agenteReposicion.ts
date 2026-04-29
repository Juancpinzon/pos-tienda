// Agente de Reposición Automática — Fase 23
// Se ejecuta como side-effect al cerrar caja. No bloquea ni revierte el cierre.

import { db } from '../db/database'

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface ItemReposicion {
  nombre: string
  stockActual: number
  stockMinimo: number
}

export interface ResumenReposicion {
  totalProductos: number
  productos: ItemReposicion[]
}

// ─── Lógica de negocio ────────────────────────────────────────────────────────

/**
 * Consulta la base de datos local y retorna los productos activos (no fantasma)
 * cuyo stock actual es igual o inferior al stock mínimo configurado.
 *
 * Retorna null cuando no hay ningún producto por reponer, de modo que el
 * llamador pueda omitir la notificación sin lógica adicional.
 */
export async function verificarStockAlCerrarCaja(): Promise<ResumenReposicion | null> {
  const bajoMinimo = await db.productos
    .filter((p) =>
      // Solo productos activos y reales (no fantasmas)
      p.activo &&
      !p.esFantasma &&
      // Excluir productos sin control de stock (campos nulos o indefinidos)
      p.stockActual != null &&
      p.stockMinimo != null &&
      // La alerta se activa cuando el stock llega al mínimo, no solo cuando se agota
      p.stockActual <= p.stockMinimo,
    )
    .toArray()

  if (bajoMinimo.length === 0) return null

  return {
    totalProductos: bajoMinimo.length,
    productos: bajoMinimo.map((p) => ({
      nombre: p.nombre,
      // Los campos ya fueron validados como no nulos en el filtro anterior
      stockActual: p.stockActual as number,
      stockMinimo: p.stockMinimo as number,
    })),
  }
}
