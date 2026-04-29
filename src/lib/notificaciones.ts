// Gestión de notificaciones push y recordatorios de negocio
// Fase 22 — notificaciones in-app (cuando la PWA está abierta o en segundo plano)
//
// ARQUITECTURA:
//   • Notification API nativa del navegador (no requiere servidor)
//   • showNotification vía ServiceWorkerRegistration para compatibilidad con
//     PWA instalada en Android aunque el tab esté en segundo plano
//   • Rate limiting con localStorage para no spamear al dueño
//   • push_subscriptions en Supabase guardado para push desde servidor (fase futura)

import { db } from '../db/database'
import { obtenerConfig } from '../hooks/useConfig'
import { supabase, supabaseConfigurado } from './supabase'
import { useAuthStore } from '../stores/authStore'
import { Capacitor } from '@capacitor/core'

// ─── Rate limiting ────────────────────────────────────────────────────────────

const PFX = 'pos_notif_last_'

const INTERVALO: Record<string, number> = {
  fiado: 4  * 60 * 60 * 1000,   // máximo una vez cada 4h
  stock: 24 * 60 * 60 * 1000,   // máximo una vez al día
  caja:  24 * 60 * 60 * 1000,   // máximo una vez al día
  nomina: 24 * 60 * 60 * 1000,  // máximo una vez al día
  caducidad: 24 * 60 * 60 * 1000, // máximo una vez al día
}

function puedeEnviar(tipo: string): boolean {
  const raw = localStorage.getItem(PFX + tipo)
  if (!raw) return true
  return Date.now() - parseInt(raw, 10) > (INTERVALO[tipo] ?? 3_600_000)
}

function marcarEnviado(tipo: string): void {
  localStorage.setItem(PFX + tipo, Date.now().toString())
}

// ─── Motor de notificación ────────────────────────────────────────────────────

function formatCOPLocal(monto: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(monto)
}

/**
 * Muestra una notificación nativa. Usa el Service Worker si está disponible
 * (permite notificaciones cuando el tab está en segundo plano en PWA instalada).
 * En caso contrario, usa new Notification() directo.
 */
async function mostrarNotificacion(
  titulo: string,
  cuerpo: string,
  rutaDestino?: string,
): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const opciones: NotificationOptions = {
    body: cuerpo,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: titulo,            // evita notificaciones duplicadas con el mismo título
    requireInteraction: false,
    data: { url: rutaDestino ?? '/' },
  }

  // NOTA: NO usamos navigator.serviceWorker.ready porque esa promesa puede
  // quedar pendiente indefinidamente si el SW no está activo (dev, web sin SW).
  // new Notification() directo funciona siempre que el permiso esté granted
  // y la pestaña esté activa, que es exactamente nuestro caso de uso.
  const n = new Notification(titulo, opciones)
  if (rutaDestino) {
    n.onclick = () => {
      window.focus()
      window.location.pathname = rutaDestino
    }
  }
}

// ─── Checks de negocio ────────────────────────────────────────────────────────

async function checkMoraFiado(): Promise<void> {
  if (!puedeEnviar('fiado')) return
  const config = await obtenerConfig()
  if (!config.notifFiado) return

  const ahora = Date.now()
  const DIAS_MORA = 7

  const clientes = await db.clientes
    .filter((c) => c.activo && c.totalDeuda > 0 && !!c.ultimoMovimiento)
    .toArray()

  const enMora = clientes.filter((c) => {
    if (!c.ultimoMovimiento) return false
    return (ahora - c.ultimoMovimiento.getTime()) / 86_400_000 >= DIAS_MORA
  })

  if (enMora.length === 0) return

  // Ordenar por mayor deuda
  enMora.sort((a, b) => b.totalDeuda - a.totalDeuda)
  const principal = enMora[0]
  const dias = Math.floor((ahora - principal.ultimoMovimiento!.getTime()) / 86_400_000)

  // Umbral 7, 15, 30 días — mostrar mensaje apropiado
  const etiquetaDias = dias >= 30 ? '¡30+ días!' : dias >= 15 ? '15 días' : `${dias} días`

  const titulo =
    enMora.length === 1 ? '💜 Fiado pendiente' : `💜 ${enMora.length} clientes con fiado`

  const cuerpo =
    enMora.length === 1
      ? `${principal.nombre} lleva ${etiquetaDias} sin abonar — debe ${formatCOPLocal(principal.totalDeuda)}`
      : `${principal.nombre} (+${enMora.length - 1} más) llevan +${DIAS_MORA} días sin abonar`

  await mostrarNotificacion(titulo, cuerpo, '/fiados')
  marcarEnviado('fiado')
}

async function checkProductosAgotados(): Promise<void> {
  if (!puedeEnviar('stock')) return
  const config = await obtenerConfig()
  if (!config.notifStock) return

  const agotados = await db.productos
    .filter(
      (p) =>
        p.activo &&
        p.stockActual !== undefined &&
        p.stockActual !== null &&
        p.stockActual <= 0,
    )
    .toArray()

  if (agotados.length === 0) return

  const nombres = agotados
    .slice(0, 2)
    .map((p) => p.nombre)
    .join(', ')

  const titulo = `📦 ${agotados.length} producto${agotados.length > 1 ? 's' : ''} agotado${agotados.length > 1 ? 's' : ''}`
  const cuerpo = `Revise la lista de pedido: ${nombres}${agotados.length > 2 ? '…' : ''}`

  await mostrarNotificacion(titulo, cuerpo, '/pedido')
  marcarEnviado('stock')
}

async function checkProductosPorVencer(): Promise<void> {
  if (!puedeEnviar('caducidad')) return
  const config = await obtenerConfig()
  if (!config.notificacionesActivas) return

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fechaCorte = new Date(hoy)
  fechaCorte.setDate(fechaCorte.getDate() + 5) // Alerta 5 días antes

  const criticos = await db.productos
    .filter((p) => 
      p.activo && 
      !!p.fechaVencimiento && 
      (p.stockActual ?? 0) > 0 &&
      p.fechaVencimiento <= fechaCorte
    )
    .toArray()

  if (criticos.length === 0) return

  const vencidos = criticos.filter(p => p.fechaVencimiento! < hoy)
  const porVencer = criticos.filter(p => p.fechaVencimiento! >= hoy)

  let titulo = '⏳ Alerta de vencimiento'
  let cuerpo = ''

  if (vencidos.length > 0) {
    titulo = '⚠️ Productos vencidos'
    cuerpo = `${vencidos[0].nombre}${vencidos.length > 1 ? ` (+${vencidos.length - 1} más)` : ''} ya vencieron.`
  } else if (porVencer.length > 0) {
    cuerpo = `${porVencer[0].nombre}${porVencer.length > 1 ? ` (+${porVencer.length - 1} más)` : ''} vencen pronto (en ≤ 5 días).`
  }

  await mostrarNotificacion(titulo, cuerpo, '/inventario')
  marcarEnviado('caducidad')
}

async function checkAperturaCaja(): Promise<void> {
  if (!puedeEnviar('caja')) return
  const config = await obtenerConfig()
  if (!config.notifCaja) return

  const sesionAbierta = await db.sesionCaja.where('estado').equals('abierta').first()
  if (sesionAbierta) return

  await mostrarNotificacion(
    '💰 Recuerde abrir la caja',
    'Todavía no hay caja abierta para comenzar el día',
    '/caja',
  )
  marcarEnviado('caja')
}

export async function checkAlertasNomina(): Promise<{ id: string, titulo: string, mensaje: string, tipo: 'warning' | 'info' }[]> {
  const numEmpleados = await db.empleados.filter((e) => e.activo).count()
  if (numEmpleados === 0) return []

  const alertas: { id: string, titulo: string, mensaje: string, tipo: 'warning' | 'info' }[] = []
  
  const hoy = new Date()
  const mes = hoy.getMonth() // 0 = Ene, 5 = Jun, 11 = Dic
  const dia = hoy.getDate()

  // Prima S1: 30 Junio. Alerta 15 días antes (15 de Junio)
  if (mes === 5 && dia >= 15 && dia <= 30) {
    alertas.push({
      id: 'prima-s1',
      titulo: 'Prima Primer Semestre',
      mensaje: 'Recuerda liquidar la prima de servicios antes del 30 de Junio.',
      tipo: 'warning'
    })
  }

  // Prima S2: 20 Diciembre. Alerta 15 días antes (5 de Diciembre)
  if (mes === 11 && dia >= 5 && dia <= 20) {
    alertas.push({
      id: 'prima-s2',
      titulo: 'Prima Segundo Semestre',
      mensaje: 'Recuerda liquidar la prima de servicios antes del 20 de Diciembre.',
      tipo: 'warning'
    })
  }

  // Intereses de Cesantías: Enero
  if (mes === 0) {
    alertas.push({
      id: 'int-cesantias',
      titulo: 'Intereses sobre Cesantías',
      mensaje: 'Recuerda pagar los intereses sobre las cesantías antes del 31 de Enero.',
      tipo: 'info'
    })
  }

  return alertas
}

async function notificarMenuNomina(): Promise<void> {
  if (!puedeEnviar('nomina')) return
  const config = await obtenerConfig()
  if (!config.notificacionesActivas) return

  const alertas = await checkAlertasNomina()
  if (alertas.length === 0) return

  const alerta = alertas[0]
  await mostrarNotificacion(`🔔 ${alerta.titulo}`, alerta.mensaje, '/nomina')
  marcarEnviado('nomina')
}

// ─── Scheduler principal ──────────────────────────────────────────────────────

let cajaTimerId: ReturnType<typeof setTimeout> | null = null

function programarRecuerdoCaja(horaCaja: string): void {
  if (cajaTimerId !== null) clearTimeout(cajaTimerId)

  const [h, m] = horaCaja.split(':').map(Number)
  const objetivo = new Date()
  objetivo.setHours(h, m, 0, 0)
  // Si la hora ya pasó hoy, programar para mañana
  if (objetivo.getTime() <= Date.now()) {
    objetivo.setDate(objetivo.getDate() + 1)
  }

  cajaTimerId = setTimeout(async () => {
    await checkAperturaCaja()
    // Re-programar para mañana a la misma hora
    programarRecuerdoCaja(horaCaja)
  }, objetivo.getTime() - Date.now())
}

let intervalId: ReturnType<typeof setInterval> | null = null
let startupTimerId: ReturnType<typeof setTimeout> | null = null

/**
 * Inicia el scheduler de recordatorios. Llama esto al montar la app.
 * Retorna una función de limpieza para el useEffect.
 */
export function iniciarScheduler(): () => void {
  // Limpiar instancias previas
  if (intervalId !== null) clearInterval(intervalId)
  if (startupTimerId !== null) clearTimeout(startupTimerId)
  if (cajaTimerId !== null) clearTimeout(cajaTimerId)

  // Chequeo inicial con delay de 30 s para no interrumpir el arranque
  startupTimerId = setTimeout(async () => {
    const config = await obtenerConfig()
    if (!config.notificacionesActivas || Notification.permission !== 'granted') return
    await checkMoraFiado()
    await checkProductosAgotados()
    await checkProductosPorVencer()
    await notificarMenuNomina()
  }, 30_000)

  // Chequeo periódico cada 4 horas mientras la app está abierta
  intervalId = setInterval(async () => {
    const config = await obtenerConfig()
    if (!config.notificacionesActivas || Notification.permission !== 'granted') return
    await checkMoraFiado()
    await checkProductosAgotados()
    await checkProductosPorVencer()
    await notificarMenuNomina()
  }, 4 * 60 * 60 * 1000)

  // Recordatorio de apertura de caja a la hora configurada
  obtenerConfig().then((config) => {
    if (config.notificacionesActivas && config.notifCaja && config.horaCaja) {
      programarRecuerdoCaja(config.horaCaja)
    }
  })

  return () => {
    if (intervalId !== null) clearInterval(intervalId)
    if (startupTimerId !== null) clearTimeout(startupTimerId)
    if (cajaTimerId !== null) clearTimeout(cajaTimerId)
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Solicita permiso de notificaciones al entorno (Nativo o Web).
 * Si se concede y Supabase está configurado, guarda la suscripción
 * en push_subscriptions para uso futuro con push desde servidor.
 */
export async function solicitarPermiso(): Promise<NotificationPermission> {
  let permiso: NotificationPermission = 'denied'

  // Si estamos en entorno Nativo (Android/iOS) con Capacitor
  if (Capacitor.isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const result = await PushNotifications.requestPermissions()
      permiso = result.receive as NotificationPermission

      if (permiso === 'granted') {
        // Registrar en FCM/APNs para obtener Token
        await PushNotifications.register()
      }
    } catch {
      permiso = 'denied'
    }
  } else {
    // Entorno Web (pwa o tab)
    if (!('Notification' in window)) return 'denied'
    permiso = await Notification.requestPermission()
  }

  if (permiso === 'granted' && supabaseConfigurado) {
    const usuario = useAuthStore.getState().usuario
    if (usuario) {
      try {
        await supabase.from('push_subscriptions').upsert(
          {
            usuario_id: usuario.id,
            tienda_id: usuario.tiendaId,
            // endpoint 'local:...' marca que aún no hay push real (solo in-app)
            endpoint: `local:${navigator.userAgent.slice(0, 100)}`,
            keys: {},
            activo: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'usuario_id' },
        )
      } catch {
        // Supabase puede no estar disponible — no bloquear la UI
      }
    }
  }

  return permiso
}

/**
 * Envía una notificación de prueba inmediatamente.
 * Lanza Error si no hay permiso.
 */
export async function enviarNotificacionPrueba(): Promise<void> {
  if (!('Notification' in window)) {
    throw new Error('Tu navegador no soporta notificaciones')
  }
  if (Notification.permission !== 'granted') {
    throw new Error('Concede el permiso de notificaciones primero')
  }
  await mostrarNotificacion(
    '🏪 POS Tienda — Prueba',
    'Las notificaciones están funcionando correctamente ✓',
    '/',
  )
}

// ─── Reposición de stock al cerrar caja ──────────────────────────────────────

import type { ResumenReposicion } from './agenteReposicion'

/**
 * Muestra una notificación push al cerrar caja cuando hay productos por reponer.
 * Al tocar la notificación, lleva directamente a /pedido (lista de pedido).
 *
 * No tiene rate-limit: se dispara una única vez por cierre de caja, no en bucle.
 * Si el permiso de notificaciones no está concedido, mostrarNotificacion lo ignora.
 */
export async function notificarReposicion(resumen: ResumenReposicion): Promise<void> {
  console.log('[Agente2] notificarReposicion llamada', resumen)

  const { totalProductos, productos } = resumen

  // Pluralizar correctamente en español
  const titulo = `📦 ${totalProductos} producto${totalProductos === 1 ? '' : 's'} por pedir`

  // Mostrar los primeros 3 nombres; si hay más, añadir "y N más"
  const primeros = productos.slice(0, 3).map((p) => p.nombre)
  const resto = totalProductos - primeros.length
  const cuerpo =
    resto > 0
      ? `${primeros.join(', ')} y ${resto} más`
      : primeros.join(', ')

  console.log('[Agente2] disparando notificación', { titulo, cuerpo, permiso: Notification.permission })

  // Deep-link a /pedido al tocar la notificación
  await mostrarNotificacion(titulo, cuerpo, '/pedido')
}

// ─── Cobro de fiados (Agente 4) ───────────────────────────────────────────────

import type { ResultadoCobroFiados } from './agenteCobroFiados'

/**
 * Muestra una notificación push cuando hay clientes con mora >= 7 días.
 * Al tocar la notificación, lleva directamente a /fiados (módulo de cartera).
 *
 * Se llama desde ejecutarAgenteFiados(), que ya aplica el guard diario,
 * por lo tanto esta función no aplica rate-limit propio.
 * Si el permiso de notificaciones no está concedido, mostrarNotificacion lo ignora.
 */
export async function notificarCobroFiados(resultado: ResultadoCobroFiados): Promise<void> {
  const { totalClientes, clientes } = resultado

  // Pluralizar correctamente en español
  const titulo = `💜 ${totalClientes} cliente${totalClientes === 1 ? '' : 's'} con fiado pendiente`

  // Mostrar los primeros 2 clientes con su antigüedad; si hay más, añadir "y N más"
  const primeros = clientes.slice(0, 2).map((c) => `${c.nombre} (${c.diasSinPago} días)`)
  const resto = totalClientes - primeros.length
  const cuerpo =
    resto > 0
      ? `${primeros.join(', ')} y ${resto} más`
      : primeros.join(', ')

  // Deep-link a /fiados al tocar la notificación
  await mostrarNotificacion(titulo, cuerpo, '/fiados')
}
