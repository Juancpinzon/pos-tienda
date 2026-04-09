// Hook principal del módulo de domicilios y catálogo público
// Maneja CRUD de pedidos de domicilio y configuración del catálogo

import { useState, useEffect, useCallback } from 'react'
import { db } from '../db/database'
import type { PedidoDomicilio, CatalogoPublico, Categoria, Producto } from '../db/schema'

// ─── Pedidos de domicilio ─────────────────────────────────────────────────────

export function usePedidosDomicilio() {
  const [pedidos, setPedidos] = useState<PedidoDomicilio[]>([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const todos = await db.pedidosDomicilio
        .orderBy('creadoEn')
        .reverse()
        .toArray()
      setPedidos(todos)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const crearPedido = async (
    datos: Omit<PedidoDomicilio, 'id' | 'creadoEn' | 'actualizadoEn'>
  ): Promise<number> => {
    const ahora = new Date()
    const id = await db.pedidosDomicilio.add({
      ...datos,
      creadoEn: ahora,
      actualizadoEn: ahora,
    })
    await cargar()
    return id as number
  }

  const actualizarEstado = async (
    id: number,
    estado: PedidoDomicilio['estado']
  ) => {
    await db.pedidosDomicilio.update(id, {
      estado,
      actualizadoEn: new Date(),
    })
    await cargar()
  }

  const actualizarPedido = async (
    id: number,
    cambios: Partial<Omit<PedidoDomicilio, 'id' | 'creadoEn'>>
  ) => {
    await db.pedidosDomicilio.update(id, {
      ...cambios,
      actualizadoEn: new Date(),
    })
    await cargar()
  }

  // Pedidos activos (pendiente + en_camino)
  const pedidosActivos = pedidos.filter(
    (p) => p.estado === 'pendiente' || p.estado === 'en_camino'
  )

  return {
    pedidos,
    pedidosActivos,
    cargando,
    crearPedido,
    actualizarEstado,
    actualizarPedido,
    recargar: cargar,
  }
}

// ─── Catálogo público ─────────────────────────────────────────────────────────

export function useCatalogoConfig() {
  const [config, setConfig] = useState<CatalogoPublico | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const cfg = await db.catalogoPublico.get(1)
      setConfig(cfg ?? null)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const guardarConfig = async (datos: Omit<CatalogoPublico, 'id'>) => {
    await db.catalogoPublico.put({ id: 1, ...datos })
    await cargar()
  }

  return { config, cargando, guardarConfig }
}

// ─── Catálogo público — lectura pública (sin auth) ────────────────────────────

export async function obtenerCatalogoPorSlug(slug: string): Promise<{
  config: CatalogoPublico | null
  categorias: Categoria[]
  productos: Producto[]
}> {
  const config = await db.catalogoPublico.get(1)
  if (!config || !config.activo || config.slug !== slug) {
    return { config: null, categorias: [], productos: [] }
  }

  // Categorías filtradas
  const todasCategorias = await db.categorias.toArray()
  const categorias = todasCategorias.filter((c) =>
    c.id !== undefined && config.categoriasMostrar.includes(c.id)
  )

  // Productos activos de esas categorías
  const productos = await db.productos
    .where('activo').equals(1)
    .toArray()

  const productosFiltrados = productos.filter(
    (p) => config.categoriasMostrar.includes(p.categoriaId)
  )

  return { config, categorias, productos: productosFiltrados }
}
