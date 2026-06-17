// Hook y funciones CRUD para configuración de la tienda (singleton id=1)

import { useState, useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../db/database'
import { supabase, supabaseConfigurado } from '../lib/supabase'
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
  nombreResponsable: 'Juan Carlos Pinzón Zamudio',
  emailResponsable: 'juancpinzonz@gmail.com',
}

export interface ResultadoActivacion {
  ok: boolean
  error?: string
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

interface _RespuestaValidacion {
  valido: boolean
  plan: 'basico' | 'pro' | 'upgrade' | null
  sinConexion?: boolean
}

/**
 * Valida un código contra la Edge Function validar-codigo.
 * NUNCA cae a lógica local: los patrones y códigos válidos solo viven en el servidor.
 * Si no hay sesión o no hay internet, retorna sinConexion=true.
 */
async function validarCodigoConServidor(codigo: string): Promise<_RespuestaValidacion> {
  if (!supabaseConfigurado || !navigator.onLine) {
    return { valido: false, plan: null, sinConexion: true }
  }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { valido: false, plan: null, sinConexion: true }
    }
    const { data, error } = await supabase.functions.invoke('validar-codigo', {
      body: { codigo },
    })
    if (error || data == null) {
      return { valido: false, plan: null, sinConexion: true }
    }
    return { valido: data.valido ?? false, plan: data.plan ?? null }
  } catch {
    return { valido: false, plan: null, sinConexion: true }
  }
}

/**
 * Activa el Plan Pro si el código es válido.
 * Requiere conexión a internet — los códigos solo se validan en el servidor.
 */
export async function activarPlanPro(codigo: string): Promise<ResultadoActivacion> {
  const resultado = await validarCodigoConServidor(codigo)
  if (resultado.sinConexion) {
    return { ok: false, error: 'Necesitas conexión a internet para activar el plan' }
  }
  if (!resultado.valido || (resultado.plan !== 'pro' && resultado.plan !== 'upgrade')) {
    return { ok: false, error: 'Código inválido. Verifica e intenta de nuevo' }
  }
  await guardarConfig({
    planActivo: 'pro',
    planActivadoEn: new Date(),
    codigoActivacion: codigo.trim().toUpperCase(),
    modoDemo: false,
  })
  return { ok: true }
}

/**
 * Activa el Plan Básico si el código es válido.
 * Requiere conexión a internet — los códigos solo se validan en el servidor.
 */
export async function activarPlanBasico(codigo: string): Promise<ResultadoActivacion> {
  const resultado = await validarCodigoConServidor(codigo)
  if (resultado.sinConexion) {
    return { ok: false, error: 'Necesitas conexión a internet para activar el plan' }
  }
  if (!resultado.valido || resultado.plan !== 'basico') {
    return { ok: false, error: 'Código inválido. Verifica e intenta de nuevo' }
  }
  await guardarConfig({
    modoDemo: false,
    codigoBasico: codigo.trim().toUpperCase(),
    planBasicoActivadoEn: new Date(),
  })
  return { ok: true }
}

/**
 * Verifica al arrancar (con conexión + sesión activa) que el código de activación
 * almacenado en Dexie sigue siendo válido en el servidor.
 * Si alguien manipuló IndexedDB para activarse gratis, esto lo detecta y resetea.
 */
export async function verificarPlanEnServidor(): Promise<void> {
  if (!supabaseConfigurado || !navigator.onLine) return
  const config = await obtenerConfig()
  if (config.modoDemo) return

  const codigoGuardado = config.planActivo === 'pro'
    ? config.codigoActivacion
    : config.codigoBasico

  if (!codigoGuardado) {
    // Plan activado sin código de activación → manipulación detectada
    await guardarConfig({ planActivo: 'basico', planActivadoEn: undefined, codigoActivacion: undefined, modoDemo: true, ventasDemo: 0 })
    return
  }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data, error } = await supabase.functions.invoke('validar-codigo', {
      body: { codigo: codigoGuardado },
    })
    if (!error && data != null && !data.valido) {
      // Código ya no es válido (revocado o inválido) → resetear
      await guardarConfig({
        planActivo: 'basico',
        planActivadoEn: undefined,
        codigoActivacion: undefined,
        codigoBasico: undefined,
        modoDemo: true,
        ventasDemo: 0,
      })
    }
  } catch {
    // Error de red → no resetear (beneficio de la duda para usuarios offline)
  }
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
