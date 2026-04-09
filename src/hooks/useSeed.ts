// Hook que detecta primer uso y carga el seed automáticamente.
// Usar en App.tsx o en el componente raíz.

import { useState, useEffect } from 'react'
import { db } from '../db/database'
import { cargarSeed, TOTAL_PRODUCTOS_SEED, CATEGORIAS, PRODUCTOS_SEED } from '../db/seed'
import type { Producto } from '../db/schema'

// ─── Importación incremental ──────────────────────────────────────────────────

/**
 * Importa solo los productos y categorías del seed que no existen aún en la DB.
 * Detecta duplicados por nombre (case-insensitive). No toca ventas, fiados ni config.
 */
export async function importarProductosNuevos(): Promise<{
  categoriasAgregadas: number
  productosAgregados: number
}> {
  // 1. Cargar categorías existentes en Dexie
  const catsExistentes = await db.categorias.toArray()
  const nombresCatsExistentes = new Set(catsExistentes.map((c) => c.nombre.toLowerCase()))

  // 2. Agregar categorías del seed que no existen
  let categoriasAgregadas = 0
  const mapaNombreAId = new Map<string, number>() // nombre.lower → id real en Dexie

  // Poblar el mapa con las existentes primero
  catsExistentes.forEach((c) => {
    if (c.id !== undefined) mapaNombreAId.set(c.nombre.toLowerCase(), c.id)
  })

  for (const cat of CATEGORIAS) {
    const key = cat.nombre.toLowerCase()
    if (!nombresCatsExistentes.has(key)) {
      const id = await db.categorias.add(cat)
      mapaNombreAId.set(key, id as number)
      categoriasAgregadas++
    }
  }

  // 3. Cargar todos los productos existentes en Dexie
  const prodsExistentes = await db.productos.toArray()
  const nombresProdsExistentes = new Set(prodsExistentes.map((p) => p.nombre.toLowerCase()))

  // 4. Agregar productos del seed que no existen
  let productosAgregados = 0
  const ahora = new Date()

  for (const prod of PRODUCTOS_SEED) {
    const key = prod.nombre.toLowerCase()
    if (nombresProdsExistentes.has(key)) continue

    // Resolver el categoriaId correcto: el seed usa IDs posicionales (1-based del array CATEGORIAS)
    // pero tras la importación las categorías nuevas pueden tener IDs distintos.
    // Usamos el nombre de la categoría del seed para obtener el ID real.
    const catSeed = CATEGORIAS[prod.categoriaId - 1]
    const catIdReal = catSeed
      ? (mapaNombreAId.get(catSeed.nombre.toLowerCase()) ?? prod.categoriaId)
      : prod.categoriaId

    const nuevo: Omit<Producto, 'id'> = {
      nombre: prod.nombre,
      categoriaId: catIdReal,
      precio: prod.precio,
      precioCompra: prod.precioCompra,
      unidad: prod.unidad,
      esFantasma: false,
      activo: true,
      creadoEn: ahora,
      actualizadoEn: ahora,
    }
    await db.productos.add(nuevo as Producto)
    productosAgregados++
  }

  return { categoriasAgregadas, productosAgregados }
}

type EstadoSeed = 'verificando' | 'cargando' | 'listo' | 'error'

interface UseSeedResult {
  estado: EstadoSeed
  error: string | null
  /** true si esta es la primera vez que se abre la app (config vacía) */
  primerUso: boolean
}

export function useSeed(): UseSeedResult {
  const [estado, setEstado] = useState<EstadoSeed>('verificando')
  const [error, setError] = useState<string | null>(null)
  const [primerUso, setPrimerUso] = useState(false)

  useEffect(() => {
    let cancelado = false

    async function inicializar() {
      try {
        // Verificar si la base de datos ya tiene datos
        const totalProductos = await db.productos.count()

        if (cancelado) return

        if (totalProductos === 0) {
          // Primer uso: cargar seed completo
          setEstado('cargando')
          await cargarSeed()

          if (!cancelado) {
            console.info(
              `[POS] Seed cargado: ${TOTAL_PRODUCTOS_SEED} productos en 13 categorías`
            )
            setPrimerUso(true)
            setEstado('listo')
          }
        } else {
          // Base de datos ya poblada
          setEstado('listo')
        }
      } catch (err) {
        if (!cancelado) {
          const mensaje = err instanceof Error ? err.message : 'Error desconocido'
          console.error('[POS] Error al inicializar base de datos:', mensaje)
          setError(mensaje)
          setEstado('error')
        }
      }
    }

    inicializar()

    return () => {
      cancelado = true
    }
  }, [])

  return { estado, error, primerUso }
}
