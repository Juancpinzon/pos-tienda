// useTiendasDueno.ts
// Lógica de negocio para el dashboard multi-tienda.
// Todo consulta Supabase directamente — no usa IndexedDB local.

import { supabase, supabaseConfigurado } from '../lib/supabase'
import { db } from '../db/database'
import { syncToSupabase, pullFromSupabase } from '../lib/sync'
import { useAuthStore, type TiendaResumen } from '../stores/authStore'

// ─── Tipos del dashboard ──────────────────────────────────────────────────────

export interface ResumenTienda {
  id:                string
  nombre:            string
  esActiva:          boolean
  ventasHoy:         number
  cantidadVentasHoy: number
  fiadoHoy:          number
  cajaAbierta:       boolean
  clientesMora:      number   // clientes con mora > 30 días
  cargando:          boolean
  error:             string | null
}

// ─── Cargar lista de tiendas del dueño ───────────────────────────────────────

/**
 * Devuelve todas las tiendas del dueño desde propietarios_tienda.
 * Retorna [] si Supabase no está configurado o el usuario no es dueño.
 */
export async function cargarTiendasDueno(usuarioId: string): Promise<TiendaResumen[]> {
  if (!supabaseConfigurado) return []

  const { data, error } = await supabase
    .from('propietarios_tienda')
    .select('tienda_id, tiendas(nombre)')
    .eq('usuario_id', usuarioId)

  if (error || !data) return []

  return data.map((row) => ({
    id:     row.tienda_id as string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nombre: (row.tiendas as any)?.nombre ?? 'Sin nombre',
  }))
}

/**
 * Asegura que el dueño tenga una fila en propietarios_tienda para su tienda activa.
 * Se llama al hacer login para mantener la tabla sincronizada.
 */
export async function registrarPropietarioTienda(
  usuarioId: string,
  tiendaId:  string
): Promise<void> {
  if (!supabaseConfigurado) return
  try {
    await supabase
      .from('propietarios_tienda')
      .upsert({ usuario_id: usuarioId, tienda_id: tiendaId }, { onConflict: 'usuario_id,tienda_id' })
      .throwOnError()
  } catch (error) {
    // Tabla no existe en Supabase — ignorar silenciosamente
    console.warn('propietarios_tienda no disponible:', error)
  }
}

// ─── Resumen de una tienda (consulta Supabase) ────────────────────────────────

/**
 * Obtiene el resumen del día de una tienda desde Supabase.
 * No usa IndexedDB — sirve para el dashboard cross-tienda.
 */
export async function cargarResumenTienda(tiendaId: string): Promise<Omit<ResumenTienda, 'id' | 'nombre' | 'esActiva' | 'cargando' | 'error'>> {
  const inicioHoy = new Date()
  inicioHoy.setHours(0, 0, 0, 0)

  const treintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [ventasRes, cajaRes, moraRes] = await Promise.all([
    // Ventas de hoy
    supabase
      .from('ventas')
      .select('total, tipo_pago')
      .eq('tienda_id', tiendaId)
      .eq('estado', 'completada')
      .gte('creada_en', inicioHoy.toISOString()),

    // Sesión de caja abierta
    supabase
      .from('sesiones_caja')
      .select('id')
      .eq('tienda_id', tiendaId)
      .eq('estado', 'abierta')
      .limit(1),

    // Clientes con mora > 30 días
    supabase
      .from('clientes')
      .select('id')
      .eq('tienda_id', tiendaId)
      .gt('total_deuda', 0)
      .lt('ultimo_movimiento', treintaDiasAtras.toISOString()),
  ])

  const ventas    = ventasRes.data ?? []
  const cajas     = cajaRes.data  ?? []
  const morosos   = moraRes.data  ?? []

  return {
    ventasHoy:         ventas.reduce((s, v) => s + (v.total as number), 0),
    cantidadVentasHoy: ventas.length,
    fiadoHoy:          ventas.filter((v) => v.tipo_pago === 'fiado').reduce((s, v) => s + (v.total as number), 0),
    cajaAbierta:       cajas.length > 0,
    clientesMora:      morosos.length,
  }
}

// ─── Crear tienda nueva ───────────────────────────────────────────────────────

/**
 * Crea una tienda nueva en Supabase y la vincula al dueño.
 * Retorna la TiendaResumen creada.
 */
export async function crearTiendaNueva(
  nombre:    string,
  usuarioId: string
): Promise<TiendaResumen> {
  if (!supabaseConfigurado) {
    throw new Error('Supabase no está configurado.')
  }

  // 1. Crear la tienda
  const { data: tiendaData, error: tiendaError } = await supabase
    .from('tiendas')
    .insert({ nombre: nombre.trim() })
    .select('id, nombre')
    .single()

  if (tiendaError || !tiendaData) {
    throw new Error(tiendaError?.message ?? 'Error al crear la tienda')
  }

  // 2. Vincular dueño a la tienda
  const { error: propError } = await supabase
    .from('propietarios_tienda')
    .insert({ usuario_id: usuarioId, tienda_id: tiendaData.id })

  if (propError) {
    throw new Error('Tienda creada pero no se pudo vincular: ' + propError.message)
  }

  return { id: tiendaData.id as string, nombre: tiendaData.nombre as string }
}

// ─── Renombrar tienda ─────────────────────────────────────────────────────────

export async function renombrarTienda(tiendaId: string, nuevoNombre: string): Promise<void> {
  if (!supabaseConfigurado) throw new Error('Supabase no configurado')
  const { error } = await supabase
    .from('tiendas')
    .update({ nombre: nuevoNombre.trim() })
    .eq('id', tiendaId)
  if (error) throw new Error(error.message)
}

// ─── Cambiar tienda activa ────────────────────────────────────────────────────
//
// Flujo:
//   1. Empujar datos locales pendientes al Supabase de la tienda actual
//   2. Actualizar usuarios.tienda_id en Supabase (cambia el contexto RLS)
//   3. Actualizar authStore (tiendaId + nombreTienda)
//   4. Limpiar toda la DB local (para evitar mezcla de tiendas)
//   5. Limpiar timestamp de último sync (fuerza pull completo)
//   6. Recargar la página → useSeed corre si DB vacía, pull trae datos nuevos

export async function cambiarTiendaActiva(nuevaTienda: TiendaResumen): Promise<void> {
  const { usuario, setUsuario } = useAuthStore.getState()
  if (!usuario || !supabaseConfigurado) return
  if (nuevaTienda.id === usuario.tiendaId) return   // ya activa, no hacer nada

  // 1. Push pendiente
  try { await syncToSupabase(usuario.tiendaId) } catch { /* no bloquear si falla */ }

  // 2. Actualizar tienda activa en Supabase
  const { error } = await supabase
    .from('usuarios')
    .update({ tienda_id: nuevaTienda.id })
    .eq('id', usuario.id)

  if (error) throw new Error('No se pudo cambiar la tienda: ' + error.message)

  // 3. Actualizar authStore
  setUsuario({ ...usuario, tiendaId: nuevaTienda.id, nombreTienda: nuevaTienda.nombre })

  // 4. Limpiar DB local (evita mezcla de datos de dos tiendas)
  try {
    await db.transaction('rw', db.tables, async () => {
      for (const tabla of db.tables) {
        await tabla.clear()
      }
    })
  } catch { /* en modo offline podría fallar — continuar igual */ }

  // 5. Limpiar timestamp de sync para forzar pull completo
  localStorage.removeItem('pos-last-sync-at')

  // 6. Recargar → useSeed + pullFromSupabase corren con la nueva tienda
  //    Usamos un timeout breve para que Zustand persista el estado primero
  setTimeout(() => window.location.reload(), 150)
}

// ─── Hook: pull inicial de tiendas al montar ─────────────────────────────────

/**
 * Llama a pullFromSupabase después de cambiar la tienda activa.
 * Expuesto para que App.tsx lo use después del login.
 */
export { pullFromSupabase }
