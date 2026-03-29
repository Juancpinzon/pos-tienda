// Hook para el tour interactivo de onboarding del tendero
// Persiste el estado en ConfigTienda.tourCompletado (campo no indexado, sin migración Dexie)

import { useState, useEffect, useCallback } from 'react'
import { db } from '../db/database'

// ─── Definición de pasos ──────────────────────────────────────────────────────

export const TOTAL_PASOS = 7

export interface PasoTour {
  id: number
  target: string | null  // valor de data-tour; null = tarjeta centrada sin spotlight
  emoji: string
  titulo: string
  descripcion: string
  posTooltip?: 'arriba' | 'abajo' | 'izquierda' | 'derecha'
}

export const PASOS_TOUR: PasoTour[] = [
  {
    id: 1,
    target: 'buscador',
    emoji: '🔍',
    titulo: 'Busca cualquier producto',
    descripcion:
      'Escribe el nombre del producto que vas a vender. Si no está en el sistema, puedes venderlo igual sin necesidad de registrarlo.',
    posTooltip: 'abajo',
  },
  {
    id: 2,
    target: 'grid-productos',
    emoji: '🛒',
    titulo: 'Productos rápidos',
    descripcion:
      'Toca cualquier producto para agregarlo a la venta al tiro. Los que más vendes quedan aquí de una.',
    posTooltip: 'derecha',
  },
  {
    id: 3,
    target: 'carrito',
    emoji: '📋',
    titulo: 'Tu venta va aquí',
    descripcion:
      'Aquí van todos los productos que estás vendiendo. Puedes cambiar las cantidades o quitar lo que no va.',
    posTooltip: 'izquierda',
  },
  {
    id: 4,
    target: 'btn-cobrar',
    emoji: '💰',
    titulo: '¡Toca COBRAR!',
    descripcion:
      'Cuando termines de agregar todo, toca este botón para registrar el pago. Tienes efectivo, transferencia o fiado.',
    posTooltip: 'arriba',
  },
  {
    id: 5,
    target: null,
    emoji: '📒',
    titulo: '¿El cliente no tiene plata?',
    descripcion:
      'No hay problema. Al cobrar, elige "Fiado" y anota la deuda. No necesitas pedir cédula ni ningún documento — solo el nombre del cliente.',
  },
  {
    id: 6,
    target: 'nav-fiados',
    emoji: '👥',
    titulo: 'Módulo Fiados',
    descripcion:
      'Aquí ves cuánto te debe cada cliente y puedes registrar los pagos cuando te cancelen.',
    posTooltip: 'derecha',
  },
  {
    id: 7,
    target: 'nav-caja',
    emoji: '🏦',
    titulo: 'La Caja',
    descripcion:
      'Abre la caja al comenzar el día y ciérrala al terminar para ver cuánto hiciste. Te ayuda a cuadrar la plata sin enredos.',
    posTooltip: 'derecha',
  },
]

// ─── Tipo exportado ───────────────────────────────────────────────────────────

export interface TourState {
  tourCompletado: boolean | undefined   // undefined = cargando
  pasoActual: number
  totalPasos: number
  pasoInfo: PasoTour
  siguientePaso: () => void
  anteriorPaso: () => void
  saltarTour: () => Promise<void>
  completarTour: () => Promise<void>
  reiniciarTour: () => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOnboarding(): TourState {
  const [tourCompletado, setTourCompletado] = useState<boolean | undefined>(undefined)
  const [pasoActual, setPasoActual] = useState(0)

  // Carga inicial: leer estado guardado en DB
  useEffect(() => {
    db.configTienda.get(1)
      .then((config) => setTourCompletado(config?.tourCompletado ?? false))
      .catch(() => setTourCompletado(false))
  }, [])

  // Marca el tour como completado (optimista: actualiza estado local primero)
  const marcarCompletado = useCallback(async () => {
    setTourCompletado(true)
    try {
      await db.configTienda.where('id').equals(1).modify({ tourCompletado: true })
    } catch (err) {
      console.error('[useOnboarding] error al guardar tourCompletado', err)
    }
  }, [])

  // Reinicia el tour (desde Configuración)
  const reiniciarTour = useCallback(async () => {
    setPasoActual(0)
    setTourCompletado(false)   // muestra el overlay inmediatamente
    try {
      await db.configTienda.where('id').equals(1).modify({ tourCompletado: false })
    } catch (err) {
      console.error('[useOnboarding] error al reiniciar tour', err)
    }
  }, [])

  return {
    tourCompletado,
    pasoActual,
    totalPasos: TOTAL_PASOS,
    pasoInfo: PASOS_TOUR[pasoActual],
    siguientePaso: () => setPasoActual((p) => Math.min(p + 1, TOTAL_PASOS - 1)),
    anteriorPaso:  () => setPasoActual((p) => Math.max(0, p - 1)),
    saltarTour:    marcarCompletado,
    completarTour: marcarCompletado,
    reiniciarTour,
  }
}
