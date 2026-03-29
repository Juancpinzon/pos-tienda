// Hook y funciones CRUD para el módulo de productos
// REGLA: todo acceso a DB pasa por estos hooks

import { useState, useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../db/database'
import type { Producto, Categoria } from '../db/schema'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface FiltrosProductos {
  categoriaId?: number
  query?: string
  soloActivos?: boolean
  incluirFantasmas?: boolean
}

export interface FantasmaPendiente {
  nombreProducto: string
  conteo: number
  precioUltimo: number
}

// ─── Hooks reactivos ─────────────────────────────────────────────────────────

/**
 * Lista reactiva de productos con filtros opcionales.
 * Por defecto: solo activos, excluye fantasmas, sin filtro de categoría.
 */
export function useProductos(filtros: FiltrosProductos = {}) {
  const {
    categoriaId,
    query = '',
    soloActivos = true,
    incluirFantasmas = false,
  } = filtros

  const [productos, setProductos] = useState<Producto[] | undefined>(undefined)

  useEffect(() => {
    setProductos(undefined)

    const subscription = liveQuery(async () => {
      const base = categoriaId
        ? db.productos.where('categoriaId').equals(categoriaId)
        : db.productos.toCollection()

      const todos = await base.toArray()
      const lower = query.toLowerCase()

      return todos
        .filter((p) => {
          if (soloActivos && !p.activo) return false
          if (!incluirFantasmas && p.esFantasma) return false
          if (lower && !p.nombre.toLowerCase().includes(lower)) return false
          return true
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }).subscribe({
      next: setProductos,
      error: (err) => {
        console.error('[useProductos]', err)
        setProductos([])
      },
    })

    return () => subscription.unsubscribe()
  }, [categoriaId, query, soloActivos, incluirFantasmas])

  return productos
}

/**
 * Todas las categorías ordenadas por campo `orden`.
 */
export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[] | undefined>(undefined)

  useEffect(() => {
    const subscription = liveQuery(
      () => db.categorias.orderBy('orden').toArray()
    ).subscribe({
      next: setCategorias,
      error: (err) => {
        console.error('[useCategorias]', err)
        setCategorias([])
      },
    })
    return () => subscription.unsubscribe()
  }, [])

  return categorias
}

/**
 * Productos fantasma agrupados por nombre (vendidos sin registrar).
 * Ordenados por frecuencia descendente.
 */
export function useProductosFantasma() {
  const [fantasmas, setFantasmas] = useState<FantasmaPendiente[] | undefined>(undefined)

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const detalles = await db.detallesVenta
        .filter((d) => d.esProductoFantasma)
        .toArray()

      const grupos: Record<string, FantasmaPendiente> = {}
      for (const d of detalles) {
        const key = d.nombreProducto.toLowerCase().trim()
        if (!grupos[key]) {
          grupos[key] = {
            nombreProducto: d.nombreProducto,
            conteo: 0,
            precioUltimo: d.precioUnitario,
          }
        }
        grupos[key].conteo++
        // Guardar el precio más reciente (los detalles se insertan en orden)
        grupos[key].precioUltimo = d.precioUnitario
      }

      return Object.values(grupos).sort((a, b) => b.conteo - a.conteo)
    }).subscribe({
      next: setFantasmas,
      error: (err) => {
        console.error('[useProductosFantasma]', err)
        setFantasmas([])
      },
    })
    return () => subscription.unsubscribe()
  }, [])

  return fantasmas
}

// ─── Funciones de mutación ────────────────────────────────────────────────────

type ProductoInput = Omit<Producto, 'id' | 'creadoEn' | 'actualizadoEn'>

/**
 * Crea un producto nuevo. Retorna el ID asignado.
 */
export async function crearProducto(data: ProductoInput): Promise<number> {
  const ahora = new Date()
  const id = await db.productos.add({ ...data, creadoEn: ahora, actualizadoEn: ahora })
  return id as number
}

/**
 * Actualiza los campos de un producto existente.
 */
export async function editarProducto(
  id: number,
  data: Partial<ProductoInput>
): Promise<void> {
  await db.productos.update(id, { ...data, actualizadoEn: new Date() })
}

/**
 * Alterna el estado activo/inactivo de un producto.
 */
export async function toggleActivo(id: number): Promise<void> {
  const p = await db.productos.get(id)
  if (p) await db.productos.update(id, { activo: !p.activo, actualizadoEn: new Date() })
}

// ─── Funciones de consulta puntual (no reactivas) ────────────────────────────

export async function obtenerCategorias(): Promise<Categoria[]> {
  return db.categorias.orderBy('orden').toArray()
}

export async function obtenerProductos(filtros: FiltrosProductos = {}): Promise<Producto[]> {
  const { categoriaId, query = '', soloActivos = true } = filtros
  const base = categoriaId
    ? db.productos.where('categoriaId').equals(categoriaId)
    : db.productos.toCollection()
  const todos = await base.toArray()
  const lower = query.toLowerCase()
  return todos.filter((p) => {
    if (soloActivos && !p.activo) return false
    if (lower && !p.nombre.toLowerCase().includes(lower)) return false
    return true
  })
}
