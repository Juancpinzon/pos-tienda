// Hook y funciones CRUD para configuración de la tienda (singleton id=1)

import { useState, useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../db/database'
import type { ConfigTienda } from '../db/schema'

export const CONFIG_DEFAULTS: Omit<ConfigTienda, 'id'> = {
  nombreTienda: 'Mi Tienda',
  monedaSimbol: '$',
  impuestoIVA: 0,
  permitirStockNegativo: true,
  limiteFiadoPorDefecto: 0,
  tieneDatafono: false,
}

/**
 * Configuración reactiva de la tienda. Retorna defaults si aún no se ha guardado.
 * Retorna undefined mientras carga, ConfigTienda cuando resuelve.
 */
export function useConfig() {
  const [config, setConfig] = useState<ConfigTienda | undefined>(undefined)

  useEffect(() => {
    const subscription = liveQuery(async () => {
      const cfg = await db.configTienda.get(1)
      return cfg ?? { id: 1, ...CONFIG_DEFAULTS }
    }).subscribe({
      next: setConfig,
      error: (err) => {
        console.error('[useConfig]', err)
        setConfig({ id: 1, ...CONFIG_DEFAULTS })
      },
    })
    return () => subscription.unsubscribe()
  }, [])

  return config
}

/**
 * Guarda (upsert) la configuración de la tienda.
 */
export async function guardarConfig(data: Partial<Omit<ConfigTienda, 'id'>>): Promise<void> {
  const existente = await db.configTienda.get(1)
  if (existente) {
    await db.configTienda.update(1, data)
  } else {
    await db.configTienda.put({ id: 1, ...CONFIG_DEFAULTS, ...data })
  }
}

/**
 * Obtiene la configuración actual (no reactiva, para uso en funciones async).
 */
export async function obtenerConfig(): Promise<ConfigTienda> {
  const config = await db.configTienda.get(1)
  return config ?? { id: 1, ...CONFIG_DEFAULTS }
}
