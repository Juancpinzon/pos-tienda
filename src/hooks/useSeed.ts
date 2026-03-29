// Hook que detecta primer uso y carga el seed automáticamente.
// Usar en App.tsx o en el componente raíz.

import { useState, useEffect } from 'react'
import { db } from '../db/database'
import { cargarSeed, TOTAL_PRODUCTOS_SEED } from '../db/seed'

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
