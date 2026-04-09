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
  notificacionesActivas: false,
  notifFiado: true,
  notifStock: true,
  notifCaja: false,
  horaCaja: '07:00',
  planActivo: 'basico',
}

// Códigos válidos para activar el Plan Pro (hardcodeados)
const CODIGOS_PRO = ['PROTIENDA2025', 'DOMICILIOS2025', 'UPGRADE2025']

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
 * Hook reactivo que expone esPro y esBasico para uso en componentes.
 */
export function usePlan() {
  const config = useConfig()
  const esPro    = (config?.planActivo ?? 'basico') === 'pro'
  const esBasico = !esPro
  return { esPro, esBasico, planActivadoEn: config?.planActivadoEn }
}

/**
 * Activa el Plan Pro si el código es válido.
 * Retorna true si activó, false si el código es inválido.
 */
export async function activarPlanPro(codigo: string): Promise<boolean> {
  if (!CODIGOS_PRO.includes(codigo.trim().toUpperCase())) return false
  await guardarConfig({
    planActivo: 'pro',
    planActivadoEn: new Date(),
    codigoActivacion: codigo.trim().toUpperCase(),
  })
  return true
}

/**
 * Vuelve al Plan Básico (solo para testing/admin).
 */
export async function volverABasico(): Promise<void> {
  await guardarConfig({ planActivo: 'basico', planActivadoEn: undefined, codigoActivacion: undefined })
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
