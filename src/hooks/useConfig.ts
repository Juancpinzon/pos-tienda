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
  smmlv: 1_423_500,
  subsidioTransporte: 200_000,
  modoDemo: true,
  ventasDemo: 0,
  limiteVentasDemo: 50,
}

// Validar formato del código
export function validarFormatoCodigo(codigo: string): {
  valido: boolean;
  plan: "basico" | "pro" | "upgrade" | null;
} {
  const codigoUpper = codigo.trim().toUpperCase()
  
  // Patrón: PREFIJO-XXXX donde XXXX son 4 chars alfanuméricos
  const patronBasico = /^TIENDA-[A-Z0-9]{4}$/
  const patronPro = /^PRO-[A-Z0-9]{4}$/
  const patronUpgrade = /^UPG-[A-Z0-9]{4}$/
  
  // Códigos legacy (mantener compatibilidad con códigos anteriores)
  const codigosLegacyBasico = [
    "TIENDA2025", "BARRIO2025", "POSBASICO2025",
    "TENDERO2025", "TIENDA2026"
  ]
  const codigosLegacyPro = [
    "PROTIENDA2025", "DOMICILIOS2025", "UPGRADE2025"
  ]
  
  if (patronBasico.test(codigoUpper) || codigosLegacyBasico.includes(codigoUpper)) {
    return { valido: true, plan: "basico" }
  }
  if (patronPro.test(codigoUpper) || codigosLegacyPro.includes(codigoUpper)) {
    return { valido: true, plan: "pro" }
  }
  if (patronUpgrade.test(codigoUpper)) {
    return { valido: true, plan: "upgrade" }
  }
  
  return { valido: false, plan: null }
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
 * Hook reactivo que expone esPro y esBasico para uso en componentes.
 */
export function usePlan() {
  const config = useConfig()
  const esPro    = (config?.planActivo ?? 'basico') === 'pro'
  const esBasico = !esPro

  const modoDemo              = config?.modoDemo ?? false
  const ventasDemo            = config?.ventasDemo ?? 0
  const limiteVentasDemo      = config?.limiteVentasDemo ?? 50
  const ventasRestantesDemo   = Math.max(0, limiteVentasDemo - ventasDemo)
  const demoAgotado           = modoDemo && ventasRestantesDemo <= 0

  return { 
    esPro, 
    esBasico, 
    planActivadoEn: config?.planActivadoEn,
    modoDemo,
    ventasDemo,
    limiteVentasDemo,
    ventasRestantesDemo,
    demoAgotado
  }
}

/**
 * Activa el Plan Pro si el código es válido.
 * Retorna true si activó, false si el código es inválido.
 */
export async function activarPlanPro(codigo: string): Promise<boolean> {
  const resultado = validarFormatoCodigo(codigo)
  if (!resultado.valido || 
      (resultado.plan !== "pro" && resultado.plan !== "upgrade")) return false
  await guardarConfig({
    planActivo: 'pro',
    planActivadoEn: new Date(),
    codigoActivacion: codigo.trim().toUpperCase(),
    modoDemo: false,
  })
  return true
}

/**
 * Activa el Plan Básico si el código es válido.
 * Retorna true si activó, false si el código es inválido.
 */
export async function activarPlanBasico(codigo: string): Promise<boolean> {
  const resultado = validarFormatoCodigo(codigo)
  if (!resultado.valido || resultado.plan !== "basico") return false
  await guardarConfig({
    modoDemo: false,
    codigoBasico: codigo.trim().toUpperCase(),
    planBasicoActivadoEn: new Date(),
  })
  return true
}

/**
 * Incrementa contador de ventas demo.
 * Debe llamarse antes de registrar cada venta si es demo.
 */
export async function incrementarVentasDemo(): Promise<void> {
  const config = await obtenerConfig()
  if (!config.modoDemo) return
  await guardarConfig({ 
    ventasDemo: (config.ventasDemo ?? 0) + 1 
  })
}

/**
 * Vuelve al Plan Básico (solo para testing/admin).
 */
export async function volverABasico(): Promise<void> {
  await guardarConfig({ 
    planActivo: 'basico', 
    planActivadoEn: undefined, 
    codigoActivacion: undefined,
    modoDemo: true, // Opcional: volver a demo si se quita el pro
    ventasDemo: 0 
  })
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
