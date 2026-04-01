import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Store, Phone, MapPin, FileText, Receipt, BookOpen, Users, Send, CheckCircle, UserX, Loader2, Sun, Moon, Monitor, Printer, Bluetooth, BluetoothOff, CheckCircle2, Plus, Pencil, Bell, BellOff, ShieldCheck } from 'lucide-react'
import { useConfig, guardarConfig } from '../../hooks/useConfig'
import { supabase, supabaseConfigurado } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useThemeStore, type Tema } from '../../stores/themeStore'
import {
  bluetoothDisponible,
  obtenerNombreImpresora,
  impresoraConectada,
  conectarImpresora,
  desconectarImpresora,
  imprimirPrueba,
} from '../../lib/impresora'
import {
  crearTiendaNueva,
  renombrarTienda,
  cambiarTiendaActiva,
} from '../../hooks/useTiendasDueno'
import {
  solicitarPermiso,
  enviarNotificacionPrueba,
} from '../../lib/notificaciones'
import { db } from '../../db/database'

// ─── Schema ───────────────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  nombreTienda: z.string().min(1, 'Ingresa el nombre').max(60),
  direccion: z.string().max(100).optional().transform((v) => v?.trim() || undefined),
  telefono: z.string().max(20).optional().transform((v) => v?.trim() || undefined),
  nit: z.string().max(20).optional().transform((v) => v?.trim() || undefined),
  mensajeRecibo: z.string().max(120).optional().transform((v) => v?.trim() || undefined),
  permitirStockNegativo: z.boolean(),
  limiteFiadoPorDefecto: z.coerce.number().min(0),
  tieneDatafono: z.boolean(),
  // Notificaciones (Fase 22)
  notificacionesActivas: z.boolean(),
  notifFiado: z.boolean(),
  notifStock: z.boolean(),
  notifCaja: z.boolean(),
  horaCaja: z.string().optional(),
})

type FormData = z.infer<typeof ConfigSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full h-11 px-3 border border-borde rounded-xl text-sm text-texto ' +
  'focus:outline-none focus:ring-2 focus:ring-primario/40 focus:border-primario ' +
  'placeholder:text-suave'

function Campo({
  label,
  error,
  icon,
  children,
}: {
  label: string
  error?: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-texto flex items-center gap-1.5">
        {icon && <span className="text-suave">{icon}</span>}
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-peligro">{error}</p>}
    </div>
  )
}

// ─── Componente ───────────────────────────────────────────────────────────────

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface EmpleadoRow { id: string; nombre: string; email: string }

// ─── Sección de equipo (solo dueño + Supabase) ────────────────────────────────

function SeccionEquipo() {
  const usuario = useAuthStore((s) => s.usuario)

  // Formulario de nuevo empleado
  const [emailEmpleado,  setEmailEmpleado]  = useState('')
  const [nombreEmpleado, setNombreEmpleado] = useState('')
  const [cargando,       setCargando]       = useState(false)
  const [resultado,      setResultado]      = useState<{ ok: boolean; msg: string } | null>(null)

  // Lista de empleados activos
  const [empleados,        setEmpleados]        = useState<EmpleadoRow[]>([])
  const [cargandoLista,    setCargandoLista]    = useState(false)
  const [desactivandoId,   setDesactivandoId]   = useState<string | null>(null)
  const [confirmarRevocar, setConfirmarRevocar] = useState<EmpleadoRow | null>(null)

  if (!supabaseConfigurado || usuario?.rol !== 'dueno') return null

  // Cargar lista de empleados
  const cargarEmpleados = async () => {
    if (!usuario?.tiendaId) return
    setCargandoLista(true)
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, email')
      .eq('tienda_id', usuario.tiendaId)
      .eq('rol', 'empleado')
      .order('nombre')
    setEmpleados((data as EmpleadoRow[]) ?? [])
    setCargandoLista(false)
  }

  useEffect(() => { void cargarEmpleados() }, [usuario?.tiendaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDesactivar = async (emp: EmpleadoRow) => {
    setConfirmarRevocar(emp)
  }

  const confirmarRevocacion = async () => {
    if (!confirmarRevocar) return
    setDesactivandoId(confirmarRevocar.id)
    setConfirmarRevocar(null)
    // Eliminar la fila de usuarios — sin perfil, no puede autenticarse
    await supabase.from('usuarios').delete().eq('id', confirmarRevocar.id)
    setEmpleados((prev) => prev.filter((e) => e.id !== confirmarRevocar.id))
    setDesactivandoId(null)
  }

  const handleInvitar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario?.tiendaId) return
    setCargando(true)
    setResultado(null)

    try {
      const contrasenaTemporal = crypto.randomUUID().slice(0, 12)
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: emailEmpleado.trim().toLowerCase(),
        password: contrasenaTemporal,
        options: { data: { nombre: nombreEmpleado.trim() } },
      })

      if (signupError && !signupError.message.includes('already registered')) {
        setResultado({ ok: false, msg: signupError.message })
        return
      }

      const userId = signupData?.user?.id
      if (!userId) {
        setResultado({ ok: false, msg: 'No se pudo crear la cuenta. Intenta de nuevo.' })
        return
      }

      const { error: usuarioError } = await supabase.from('usuarios').upsert({
        id:        userId,
        tienda_id: usuario.tiendaId,
        email:     emailEmpleado.trim().toLowerCase(),
        nombre:    nombreEmpleado.trim(),
        rol:       'empleado',
      })

      if (usuarioError) {
        setResultado({ ok: false, msg: 'Error al vincular el empleado a la tienda.' })
        return
      }

      setResultado({
        ok: true,
        msg: `¡Listo! ${nombreEmpleado} entra con correo y contraseña temporal: ${contrasenaTemporal}`,
      })
      setEmailEmpleado('')
      setNombreEmpleado('')
      void cargarEmpleados()
    } catch {
      setResultado({ ok: false, msg: 'Error de conexión. Verifica tu internet.' })
    } finally {
      setCargando(false)
    }
  }

  return (
    <section data-tour="seccion-equipo">
      <p className="text-xs font-semibold text-suave uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Users size={13} />
        Equipo
      </p>

      {/* Lista de empleados activos */}
      {cargandoLista ? (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin text-suave" />
        </div>
      ) : empleados.length > 0 && (
        <div className="mb-3 bg-fondo rounded-xl border border-borde overflow-hidden">
          <div className="px-3 py-2 border-b border-borde/50">
            <p className="text-xs font-semibold text-suave">Empleados con acceso ({empleados.length})</p>
          </div>
          {empleados.map((emp) => (
            <div key={emp.id} className="flex items-center gap-3 px-3 py-2.5 border-b last:border-0 border-borde/30">
              <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-sky-600">{emp.nombre.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-texto truncate">{emp.nombre}</p>
                <p className="text-xs text-suave truncate">{emp.email}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDesactivar(emp)}
                disabled={desactivandoId === emp.id}
                className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold
                           text-peligro border border-peligro/30 hover:bg-peligro/8 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
                title="Revocar acceso"
              >
                {desactivandoId === emp.id
                  ? <Loader2 size={12} className="animate-spin" />
                  : <UserX size={12} />}
                Revocar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario agregar empleado */}
      <div className="bg-fondo rounded-xl border border-borde p-4 flex flex-col gap-3">
        <div>
          <p className="text-sm text-texto font-medium">Agregar empleado</p>
          <p className="text-xs text-suave mt-0.5">
            Solo puede usar POS y Fiados. Sin acceso a Caja, Reportes ni Configuración.
          </p>
        </div>
        <form onSubmit={handleInvitar} className="flex flex-col gap-2.5">
          <input
            type="text"
            value={nombreEmpleado}
            onChange={(e) => setNombreEmpleado(e.target.value)}
            placeholder="Nombre del empleado"
            required
            maxLength={60}
            className={INPUT_CLS}
          />
          <input
            type="email"
            value={emailEmpleado}
            onChange={(e) => setEmailEmpleado(e.target.value)}
            placeholder="Correo del empleado"
            required
            className={INPUT_CLS}
          />
          <button
            type="submit"
            disabled={cargando || !emailEmpleado || !nombreEmpleado}
            className="h-10 bg-primario text-white rounded-xl text-sm font-semibold
                       flex items-center justify-center gap-2
                       hover:bg-primario-hover active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            {cargando ? 'Creando acceso…' : 'Crear acceso'}
          </button>
        </form>

        {resultado && (
          <div className={[
            'rounded-xl px-3 py-3 flex gap-2',
            resultado.ok ? 'bg-exito/8 border border-exito/20' : 'bg-peligro/8 border border-peligro/20',
          ].join(' ')}>
            {resultado.ok && <CheckCircle size={16} className="text-exito shrink-0 mt-0.5" />}
            <p className={`text-xs ${resultado.ok ? 'text-exito' : 'text-peligro'} leading-relaxed`}>
              {resultado.msg}
            </p>
          </div>
        )}
      </div>

      {/* Confirmación de revocar acceso */}
      {confirmarRevocar && (
        <ConfirmDialog
          titulo="Revocar acceso"
          mensaje={`¿Seguro que quieres revocar el acceso de ${confirmarRevocar.nombre}? No podrá ingresar al sistema.`}
          labelConfirmar="Sí, revocar"
          labelCancelar="Cancelar"
          peligroso
          onConfirmar={confirmarRevocacion}
          onCancelar={() => setConfirmarRevocar(null)}
        />
      )}
    </section>
  )
}

// ─── Sección mis tiendas (solo dueño + Supabase + 1+ tiendas) ────────────────

function SeccionMisTiendas({ onClose }: { onClose: () => void }) {
  const usuario            = useAuthStore((s) => s.usuario)
  const todasLasTiendas    = useAuthStore((s) => s.todasLasTiendas)
  const setTodasLasTiendas = useAuthStore((s) => s.setTodasLasTiendas)

  const [editandoId,    setEditandoId]    = useState<string | null>(null)
  const [editNombre,    setEditNombre]    = useState('')
  const [guardando,     setGuardando]     = useState(false)
  const [creando,       setCreando]       = useState(false)
  const [nuevaNombre,   setNuevaNombre]   = useState('')
  const [mostrarNueva,  setMostrarNueva]  = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  if (!supabaseConfigurado || usuario?.rol !== 'dueno') return null

  // Renombrar tienda
  const handleRenombrar = async (tiendaId: string) => {
    if (!editNombre.trim()) return
    setGuardando(true)
    setError(null)
    try {
      await renombrarTienda(tiendaId, editNombre)
      setTodasLasTiendas(
        todasLasTiendas.map((t) =>
          t.id === tiendaId ? { ...t, nombre: editNombre.trim() } : t
        )
      )
      setEditandoId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al renombrar')
    } finally {
      setGuardando(false)
    }
  }

  // Crear tienda nueva
  const handleCrearTienda = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevaNombre.trim() || !usuario) return
    setCreando(true)
    setError(null)
    try {
      const nueva = await crearTiendaNueva(nuevaNombre, usuario.id)
      setTodasLasTiendas([...todasLasTiendas, nueva])
      setNuevaNombre('')
      setMostrarNueva(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear tienda')
    } finally {
      setCreando(false)
    }
  }

  return (
    <section>
      <p className="text-xs font-semibold text-suave uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Store size={13} />
        Mis tiendas
      </p>

      <div className="bg-fondo rounded-xl border border-borde overflow-hidden">
        {/* Lista de tiendas */}
        {todasLasTiendas.map((tienda) => {
          const esActiva  = tienda.id === usuario?.tiendaId
          const editando  = editandoId === tienda.id

          return (
            <div key={tienda.id} className="flex items-center gap-2 px-3 py-2.5 border-b last:border-0 border-borde/40">
              <div className={[
                'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                esActiva ? 'bg-primario text-white' : 'bg-gray-100 text-suave',
              ].join(' ')}>
                <Store size={13} />
              </div>

              {editando ? (
                <input
                  autoFocus
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleRenombrar(tienda.id)
                    if (e.key === 'Escape') setEditandoId(null)
                  }}
                  className="flex-1 h-8 px-2 border border-primario/40 rounded-lg text-sm text-texto
                             focus:outline-none focus:ring-1 focus:ring-primario/40"
                />
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-texto truncate">{tienda.nombre}</p>
                  {esActiva && (
                    <p className="text-[10px] font-bold text-primario">Activa</p>
                  )}
                </div>
              )}

              {editando ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => void handleRenombrar(tienda.id)}
                    disabled={guardando || !editNombre.trim()}
                    className="h-7 px-2 bg-primario text-white rounded-lg text-xs font-semibold
                               hover:bg-primario-hover disabled:opacity-40 transition-colors"
                  >
                    {guardando ? '…' : 'OK'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoId(null)}
                    className="h-7 px-2 border border-borde text-suave rounded-lg text-xs hover:bg-gray-50"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => { setEditandoId(tienda.id); setEditNombre(tienda.nombre) }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-suave
                               hover:bg-white hover:text-texto transition-colors"
                    title="Renombrar"
                  >
                    <Pencil size={12} />
                  </button>
                  {!esActiva && (
                    <button
                      type="button"
                      onClick={async () => { await cambiarTiendaActiva(tienda); onClose() }}
                      className="h-7 px-2 bg-primario/10 text-primario rounded-lg text-[10px] font-bold
                                 hover:bg-primario/15 transition-colors"
                    >
                      Ir
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Agregar tienda nueva */}
        {mostrarNueva ? (
          <form onSubmit={handleCrearTienda} className="flex items-center gap-2 px-3 py-2.5">
            <input
              autoFocus
              type="text"
              value={nuevaNombre}
              onChange={(e) => setNuevaNombre(e.target.value)}
              placeholder="Nombre de la nueva tienda…"
              maxLength={60}
              required
              className="flex-1 h-8 px-2 border border-primario/40 rounded-lg text-sm text-texto
                         focus:outline-none focus:ring-1 focus:ring-primario/40"
            />
            <button
              type="submit"
              disabled={creando || !nuevaNombre.trim()}
              className="h-8 px-3 bg-primario text-white rounded-lg text-xs font-semibold
                         hover:bg-primario-hover disabled:opacity-40 transition-colors"
            >
              {creando ? '…' : 'Crear'}
            </button>
            <button
              type="button"
              onClick={() => { setMostrarNueva(false); setNuevaNombre('') }}
              className="h-8 px-2 border border-borde text-suave rounded-lg text-xs hover:bg-gray-50"
            >
              ✕
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarNueva(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primario
                       hover:bg-primario/5 transition-colors font-medium"
          >
            <Plus size={14} />
            Agregar tienda nueva
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-peligro">{error}</p>
      )}
    </section>
  )
}

// ─── Sección impresora Bluetooth (solo dueño) ─────────────────────────────────

function SeccionImpresora() {
  const usuario = useAuthStore((s) => s.usuario)

  const [nombreGuardado,  setNombreGuardado]  = useState<string | null>(() => obtenerNombreImpresora())
  const [conectado,       setConectado]       = useState<boolean>(() => impresoraConectada())
  const [accion,          setAccion]          = useState<'idle' | 'conectando' | 'probando' | 'ok' | 'error'>('idle')
  const [mensajeAccion,   setMensajeAccion]   = useState<string | null>(null)

  // Solo visible para dueño
  if (usuario?.rol !== 'dueno') return null

  const btDisponible = bluetoothDisponible()

  const handleConectar = async () => {
    setAccion('conectando')
    setMensajeAccion(null)
    try {
      const { nombre } = await conectarImpresora()
      setNombreGuardado(nombre)
      setConectado(true)
      setAccion('ok')
      setMensajeAccion(`Conectado a: ${nombre}`)
    } catch (err) {
      setAccion('error')
      setMensajeAccion(err instanceof Error ? err.message : 'Error al conectar')
    }
  }

  const handlePrueba = async () => {
    setAccion('probando')
    setMensajeAccion(null)
    try {
      await imprimirPrueba()
      setAccion('ok')
      setMensajeAccion('Recibo de prueba enviado.')
    } catch (err) {
      setAccion('error')
      setMensajeAccion(err instanceof Error ? err.message : 'Error al imprimir')
    }
  }

  const handleDesconectar = () => {
    desconectarImpresora()
    setNombreGuardado(null)
    setConectado(false)
    setAccion('idle')
    setMensajeAccion(null)
  }

  const ocupado = accion === 'conectando' || accion === 'probando'

  return (
    <section>
      <p className="text-xs font-semibold text-suave uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Printer size={13} />
        Impresora Bluetooth
      </p>

      {!btDisponible ? (
        /* Navegador incompatible */
        <div className="bg-fondo rounded-xl border border-borde p-4 flex items-start gap-3">
          <BluetoothOff size={18} className="text-suave shrink-0 mt-0.5" />
          <p className="text-sm text-suave leading-relaxed">
            La impresión Bluetooth funciona en{' '}
            <span className="font-semibold text-texto">Chrome para Android</span>.
            En iPhone use el botón de WhatsApp para compartir el recibo.
          </p>
        </div>
      ) : (
        <div className="bg-fondo rounded-xl border border-borde overflow-hidden">

          {/* Estado actual */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-borde/50">
            <div className={[
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
              conectado ? 'bg-exito/15 text-exito' : 'bg-gray-100 text-suave',
            ].join(' ')}>
              <Bluetooth size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-texto">
                {conectado && nombreGuardado ? nombreGuardado : 'Sin impresora'}
              </p>
              <p className="text-xs text-suave">
                {conectado ? 'Conectada en esta sesión' : nombreGuardado ? `Última: ${nombreGuardado}` : 'No configurada'}
              </p>
            </div>
            {conectado && (
              <span className="text-[10px] font-bold text-exito bg-exito/10 px-2 py-0.5 rounded-full shrink-0">
                ONLINE
              </span>
            )}
          </div>

          {/* Botones de acción */}
          <div className="p-3 flex flex-col gap-2">
            {/* Buscar / Reconectar */}
            <button
              type="button"
              onClick={handleConectar}
              disabled={ocupado}
              className="w-full h-10 bg-gray-900 text-white rounded-xl text-sm font-semibold
                         flex items-center justify-center gap-2
                         hover:bg-gray-800 active:scale-95 transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {accion === 'conectando' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Bluetooth size={15} />
              )}
              {accion === 'conectando'
                ? 'Buscando…'
                : conectado
                  ? 'Cambiar impresora'
                  : 'Buscar impresora Bluetooth'}
            </button>

            {/* Recibo de prueba — solo si está conectada */}
            {conectado && (
              <button
                type="button"
                onClick={handlePrueba}
                disabled={ocupado}
                className="w-full h-10 bg-primario/10 text-primario border border-primario/25
                           rounded-xl text-sm font-semibold flex items-center justify-center gap-2
                           hover:bg-primario/15 active:scale-95 transition-all
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {accion === 'probando' ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Printer size={15} />
                )}
                {accion === 'probando' ? 'Imprimiendo…' : 'Imprimir recibo de prueba'}
              </button>
            )}

            {/* Desconectar — solo si hay algo guardado */}
            {(nombreGuardado || conectado) && (
              <button
                type="button"
                onClick={handleDesconectar}
                disabled={ocupado}
                className="w-full h-10 text-peligro border border-peligro/25 rounded-xl text-sm
                           font-semibold flex items-center justify-center gap-2
                           hover:bg-peligro/5 active:scale-95 transition-all
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <BluetoothOff size={15} />
                Desconectar
              </button>
            )}
          </div>

          {/* Resultado de la última acción */}
          {mensajeAccion && (
            <div className={[
              'mx-3 mb-3 px-3 py-2 rounded-lg text-xs flex items-start gap-2',
              accion === 'error'
                ? 'bg-peligro/8 text-peligro border border-peligro/20'
                : 'bg-exito/8 text-exito border border-exito/20',
            ].join(' ')}>
              {accion === 'error'
                ? <BluetoothOff size={13} className="shrink-0 mt-0.5" />
                : <CheckCircle2 size={13} className="shrink-0 mt-0.5" />}
              <span className="leading-snug">{mensajeAccion}</span>
            </div>
          )}

          {/* Nota de compatibilidad */}
          <p className="px-4 pb-3 text-[11px] text-suave/70 leading-snug">
            Compatible con impresoras termicas de 58mm (Xprinter, POS-5805DD, Rongta y similares).
            Requiere Chrome para Android.
          </p>
        </div>
      )}
    </section>
  )
}

// ─── Sección de notificaciones (solo dueño) ───────────────────────────────────

interface SeccionNotificacionesProps {
  notificacionesActivas: boolean
  notifFiado: boolean
  notifStock: boolean
  notifCaja: boolean
  horaCaja: string | undefined
  setValue: (field: string, value: unknown, opts?: { shouldDirty: boolean }) => void
  register: (name: string) => object
}

function SeccionNotificaciones({
  notificacionesActivas,
  notifFiado,
  notifStock,
  notifCaja,
  horaCaja,
  setValue,
}: SeccionNotificacionesProps) {
  const usuario = useAuthStore((s) => s.usuario)
  const [permiso, setPermiso] = useState<NotificationPermission>(() =>
    'Notification' in window ? Notification.permission : 'denied',
  )
  const [estadoPrueba, setEstadoPrueba] = useState<'idle' | 'ok' | 'error'>('idle')
  const [msgPrueba, setMsgPrueba] = useState<string | null>(null)
  const [activando, setActivando] = useState(false)

  // Solo visible para dueño
  if (usuario?.rol !== 'dueno') return null

  const soportado = 'Notification' in window

  const handleToggleMaster = async () => {
    if (!notificacionesActivas) {
      // Activar: pedir permiso si no se ha dado
      if (permiso !== 'granted') {
        setActivando(true)
        const p = await solicitarPermiso()
        setPermiso(p)
        setActivando(false)
        if (p !== 'granted') return
      }
      setValue('notificacionesActivas', true, { shouldDirty: true })
    } else {
      setValue('notificacionesActivas', false, { shouldDirty: true })
    }
  }

  const handlePrueba = async () => {
    try {
      await enviarNotificacionPrueba()
      setEstadoPrueba('ok')
      setMsgPrueba('Notificación enviada ✓')
    } catch (err) {
      setEstadoPrueba('error')
      setMsgPrueba(err instanceof Error ? err.message : 'Error')
    }
    setTimeout(() => { setEstadoPrueba('idle'); setMsgPrueba(null) }, 4000)
  }

  const toggleRow = (
    label: string,
    desc: string,
    field: string,
    value: boolean,
    disabled = false,
  ) => (
    <div
      className={[
        'flex items-center justify-between p-3 bg-fondo rounded-xl border border-borde',
        disabled ? 'opacity-40' : '',
      ].join(' ')}
    >
      <div>
        <p className="text-sm font-medium text-texto">{label}</p>
        <p className="text-xs text-suave">{desc}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setValue(field, !value, { shouldDirty: true })}
        className={[
          'relative w-11 h-6 rounded-full transition-colors shrink-0',
          value ? 'bg-primario' : 'bg-gray-200',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
            value ? 'translate-x-5' : 'translate-x-0.5',
          ].join(' ')}
        />
      </button>
    </div>
  )

  return (
    <section>
      <p className="text-xs font-semibold text-suave uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Bell size={13} />
        Notificaciones
      </p>

      {!soportado ? (
        <div className="bg-fondo rounded-xl border border-borde p-4 flex items-start gap-3">
          <BellOff size={18} className="text-suave shrink-0 mt-0.5" />
          <p className="text-sm text-suave leading-relaxed">
            Tu navegador no soporta notificaciones. Usa{' '}
            <span className="font-semibold text-texto">Chrome o Edge</span> con la app instalada.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">

          {/* Toggle maestro */}
          <div className="flex items-center justify-between p-3 bg-fondo rounded-xl border border-borde">
            <div>
              <p className="text-sm font-medium text-texto">Activar notificaciones</p>
              <p className="text-xs text-suave">
                {permiso === 'denied'
                  ? 'Bloqueadas en el navegador — actívalas en Ajustes del sitio'
                  : permiso === 'granted'
                  ? 'Permiso concedido'
                  : 'Se pedirá permiso al activar'}
              </p>
            </div>
            <button
              type="button"
              disabled={activando || permiso === 'denied'}
              onClick={handleToggleMaster}
              className={[
                'relative w-11 h-6 rounded-full transition-colors shrink-0',
                notificacionesActivas && permiso === 'granted' ? 'bg-primario' : 'bg-gray-200',
                permiso === 'denied' ? 'cursor-not-allowed opacity-40' : '',
              ].join(' ')}
            >
              {activando ? (
                <Loader2 size={12} className="absolute inset-0 m-auto animate-spin text-suave" />
              ) : (
                <span
                  className={[
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                    notificacionesActivas && permiso === 'granted'
                      ? 'translate-x-5'
                      : 'translate-x-0.5',
                  ].join(' ')}
                />
              )}
            </button>
          </div>

          {/* Toggles por tipo (solo si activas + permiso) */}
          {notificacionesActivas && permiso === 'granted' && (
            <>
              {toggleRow(
                '💜 Recordatorios de fiado',
                'Avisa cuando un cliente lleva +7 días sin abonar',
                'notifFiado',
                notifFiado,
              )}
              {toggleRow(
                '📦 Alertas de stock',
                'Avisa una vez al día si hay productos agotados',
                'notifStock',
                notifStock,
              )}
              {toggleRow(
                '💰 Recordatorio apertura de caja',
                'Avisa si no has abierto la caja a la hora configurada',
                'notifCaja',
                notifCaja,
              )}

              {/* Hora de apertura (solo si notifCaja activo) */}
              {notifCaja && (
                <div className="flex items-center justify-between px-3 py-2.5 bg-fondo rounded-xl border border-borde">
                  <p className="text-sm font-medium text-texto">Hora de apertura habitual</p>
                  <input
                    type="time"
                    defaultValue="07:00"
                    onChange={(e) => setValue('horaCaja', e.target.value, { shouldDirty: true })}
                    className="h-9 px-2 border border-borde rounded-lg text-sm text-texto
                               focus:outline-none focus:ring-2 focus:ring-primario/40"
                  />
                </div>
              )}

              {/* Botón prueba */}
              <button
                type="button"
                onClick={handlePrueba}
                className="w-full h-10 bg-primario/10 text-primario border border-primario/25
                           rounded-xl text-sm font-semibold flex items-center justify-center gap-2
                           hover:bg-primario/15 active:scale-95 transition-all"
              >
                <Bell size={15} />
                Enviar notificación de prueba
              </button>

              {/* Resultado prueba */}
              {msgPrueba && (
                <div
                  className={[
                    'px-3 py-2 rounded-lg text-xs flex items-center gap-2',
                    estadoPrueba === 'error'
                      ? 'bg-peligro/8 text-peligro border border-peligro/20'
                      : 'bg-exito/8 text-exito border border-exito/20',
                  ].join(' ')}
                >
                  {estadoPrueba === 'error' ? <BellOff size={13} /> : <CheckCircle2 size={13} />}
                  {msgPrueba}
                </div>
              )}

              {/* Nota iOS */}
              <p className="text-[11px] text-suave/70 leading-snug px-1">
                En iPhone requiere iOS 16.4+ con la app instalada como PWA. En Android funciona con
                Chrome.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Selector de tema ─────────────────────────────────────────────────────────

const OPCIONES_TEMA: { id: Tema; label: string; icon: typeof Sun; desc: string }[] = [
  { id: 'claro',   label: 'Claro',   icon: Sun,     desc: 'Siempre fondo blanco'     },
  { id: 'oscuro',  label: 'Oscuro',  icon: Moon,    desc: 'Siempre fondo oscuro'     },
  { id: 'sistema', label: 'Sistema', icon: Monitor, desc: 'Sigue el celular'         },
]

function SeccionTema() {
  const tema    = useThemeStore((s) => s.tema)
  const setTema = useThemeStore((s) => s.setTema)

  return (
    <section>
      <p className="text-xs font-semibold text-suave uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Moon size={13} />
        Apariencia
      </p>
      <div className="grid grid-cols-3 gap-2">
        {OPCIONES_TEMA.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTema(id)}
            className={[
              'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center',
              tema === id
                ? 'border-primario bg-primario/8 text-primario'
                : 'border-borde text-suave hover:border-gray-300 hover:text-texto',
            ].join(' ')}
          >
            <Icon size={20} />
            <span className="text-xs font-semibold leading-none">{label}</span>
            <span className="text-[10px] leading-tight opacity-70">{desc}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

// ─── Sección de Facturación — Régimen Simple ─────────────────────────────────

function SeccionFacturacion() {
  const [prefijo,      setPrefijo]      = useState('NV')
  const [consecutivo, setConsecutivo]  = useState<number>(0)
  const [guardando,   setGuardando]    = useState(false)
  const [ok,          setOk]           = useState(false)
  const [error,       setError]        = useState<string | null>(null)

  // Cargar configuración fiscal al montar
  useEffect(() => {
    db.configFiscal.get(1).then((cfg) => {
      if (cfg) {
        setPrefijo(cfg.prefijo)
        setConsecutivo(cfg.ultimoConsecutivo)
      }
    }).catch(() => { /* tabla nueva, sin datos */ })
  }, [])

  const guardarFiscal = async () => {
    setGuardando(true)
    setError(null)
    try {
      const existente = await db.configFiscal.get(1)
      if (existente) {
        await db.configFiscal.update(1, { prefijo: prefijo.trim().toUpperCase() || 'NV' })
      } else {
        await db.configFiscal.put({
          id: 1,
          ultimoConsecutivo: 0,
          prefijo: prefijo.trim().toUpperCase() || 'NV',
        })
      }
      setOk(true)
      setTimeout(() => setOk(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section>
      <p className="text-xs font-semibold text-suave uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <ShieldCheck size={13} />
        Facturación
      </p>

      {/* Aviso régimen simple */}
      <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
        <span className="text-lg leading-none">🟡</span>
        <div>
          <p className="text-xs font-semibold text-amber-800">Régimen Simple — Exento de facturación electrónica</p>
          <p className="text-[11px] text-amber-700 mt-0.5 leading-snug">
            Las notas de venta son documentos equivalentes válidos para soportar transacciones mientras no estés obligado a factura electrónica DIAN.
          </p>
        </div>
      </div>

      <div className="bg-fondo rounded-xl border border-borde p-4 flex flex-col gap-3">

        {/* Prefijo del consecutivo */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium text-texto flex items-center gap-1.5">
              <FileText size={14} className="text-suave" />
              Prefijo de nota
            </label>
            <p className="text-xs text-suave mt-0.5">Ej: NV, FV, RV</p>
          </div>
          <input
            type="text"
            value={prefijo}
            onChange={(e) => setPrefijo(e.target.value.toUpperCase().slice(0, 4))}
            maxLength={4}
            placeholder="NV"
            className="w-20 h-10 px-3 border border-borde rounded-xl text-sm font-mono
                       font-bold text-texto text-center
                       focus:outline-none focus:ring-2 focus:ring-primario/40 focus:border-primario"
          />
        </div>

        {/* Último consecutivo */}
        <div className="flex items-center justify-between p-3 bg-white border border-borde/60 rounded-xl">
          <div>
            <p className="text-sm font-medium text-texto">Próxima nota</p>
            <p className="text-xs text-suave">Se asigna al generar nueva nota de venta</p>
          </div>
          <span className="font-mono font-bold text-primario text-base">
            {prefijo}-{String(consecutivo + 1).padStart(4, '0')}
          </span>
        </div>

        {/* Último usado */}
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-xs text-suave">Consecutivo más alto emitido:</p>
          <span className="text-xs font-mono font-semibold text-texto">
            {consecutivo === 0 ? 'Ninguno aún' : `${prefijo}-${String(consecutivo).padStart(4, '0')}`}
          </span>
        </div>

        {/* Botón guardar */}
        <button
          type="button"
          onClick={guardarFiscal}
          disabled={guardando}
          className="h-10 bg-primario text-white rounded-xl text-sm font-semibold
                     flex items-center justify-center gap-2
                     hover:bg-primario-hover active:scale-95 transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {guardando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {guardando ? 'Guardando…' : 'Guardar configuración fiscal'}
        </button>

        {ok && (
          <p className="text-xs text-exito flex items-center gap-1.5 justify-center">
            <CheckCircle2 size={13} /> Configuración guardada
          </p>
        )}
        {error && (
          <p className="text-xs text-peligro text-center">{error}</p>
        )}
      </div>
    </section>
  )
}

// ─── Props del modal ──────────────────────────────────────────────────────────

interface ConfigModalProps {
  onClose: () => void
  onReiniciarTour?: () => Promise<void>
}

export function ConfigModal({ onClose, onReiniciarTour }: ConfigModalProps) {
  const config = useConfig()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(ConfigSchema),
    defaultValues: {
      nombreTienda: 'Mi Tienda',
      permitirStockNegativo: true,
      limiteFiadoPorDefecto: 0,
      tieneDatafono: false,
      notificacionesActivas: false,
      notifFiado: true,
      notifStock: true,
      notifCaja: false,
      horaCaja: '07:00',
    },
  })

  const permitirStockNegativo = watch('permitirStockNegativo')
  const tieneDatafono = watch('tieneDatafono')
  const notificacionesActivas = watch('notificacionesActivas')
  const notifFiado = watch('notifFiado')
  const notifStock = watch('notifStock')
  const notifCaja = watch('notifCaja')

  // Poblar el formulario cuando se carga la config
  useEffect(() => {
    if (config) {
      reset({
        nombreTienda: config.nombreTienda,
        direccion: config.direccion ?? '',
        telefono: config.telefono ?? '',
        nit: config.nit ?? '',
        mensajeRecibo: config.mensajeRecibo ?? '',
        permitirStockNegativo: config.permitirStockNegativo,
        limiteFiadoPorDefecto: config.limiteFiadoPorDefecto,
        tieneDatafono: config.tieneDatafono ?? false,
        notificacionesActivas: config.notificacionesActivas ?? false,
        notifFiado: config.notifFiado ?? true,
        notifStock: config.notifStock ?? true,
        notifCaja: config.notifCaja ?? false,
        horaCaja: config.horaCaja ?? '07:00',
      })
    }
  }, [config, reset])

  const onSubmit = async (data: FormData) => {
    await guardarConfig(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-borde shrink-0">
          <div className="flex items-center gap-3">
            <Store size={20} className="text-primario" />
            <h2 className="font-display font-bold text-lg text-texto">Configuración de la tienda</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl
                       text-suave hover:text-texto hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 flex flex-col gap-5">

            {/* Info de la tienda */}
            <section>
              <p className="text-xs font-semibold text-suave uppercase tracking-wider mb-3">
                Información de la tienda
              </p>
              <div className="flex flex-col gap-3">
                <Campo label="Nombre de la tienda" error={errors.nombreTienda?.message} icon={<Store size={14} />}>
                  <input
                    {...register('nombreTienda')}
                    type="text"
                    placeholder="Ej: Tienda Doña Rosa"
                    className={INPUT_CLS}
                  />
                </Campo>

                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Teléfono" error={errors.telefono?.message} icon={<Phone size={14} />}>
                    <input
                      {...register('telefono')}
                      type="tel"
                      placeholder="Opcional"
                      className={INPUT_CLS}
                    />
                  </Campo>
                  <Campo label="NIT" error={errors.nit?.message} icon={<FileText size={14} />}>
                    <input
                      {...register('nit')}
                      type="text"
                      placeholder="Opcional"
                      className={INPUT_CLS}
                    />
                  </Campo>
                </div>

                <Campo label="Dirección" error={errors.direccion?.message} icon={<MapPin size={14} />}>
                  <input
                    {...register('direccion')}
                    type="text"
                    placeholder="Calle, barrio, ciudad…"
                    className={INPUT_CLS}
                  />
                </Campo>

                <Campo label="Mensaje en el recibo" error={errors.mensajeRecibo?.message} icon={<Receipt size={14} />}>
                  <input
                    {...register('mensajeRecibo')}
                    type="text"
                    placeholder="Ej: ¡Vuelva pronto! WhatsApp: 310…"
                    className={INPUT_CLS}
                  />
                </Campo>
              </div>
            </section>

            {/* Equipo (solo dueño + Supabase configurado) */}
            <SeccionEquipo />

            {/* Mis tiendas (solo dueño + Supabase configurado) */}
            <SeccionMisTiendas onClose={onClose} />

            {/* Impresora Bluetooth (solo dueño) */}
            <SeccionImpresora />

            {/* Notificaciones push (solo dueño) */}
            <SeccionNotificaciones
              notificacionesActivas={notificacionesActivas ?? false}
              notifFiado={notifFiado ?? true}
              notifStock={notifStock ?? true}
              notifCaja={notifCaja ?? false}
              horaCaja={watch('horaCaja')}
              setValue={setValue as (field: string, value: unknown, opts?: { shouldDirty: boolean }) => void}
              register={register as (name: string) => object}
            />

            {/* Facturación — Régimen Simple */}
            <SeccionFacturacion />

            {/* Apariencia — selector de tema */}
            <SeccionTema />

            {/* Tour de onboarding */}
            {onReiniciarTour && (
              <section>
                <p className="text-xs font-semibold text-suave uppercase tracking-wider mb-3">
                  Ayuda
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await onReiniciarTour()
                    onClose()
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-fondo rounded-xl border border-borde
                             hover:bg-primario/5 hover:border-primario/30 transition-colors text-left"
                >
                  <div className="w-9 h-9 bg-primario/10 rounded-xl flex items-center justify-center shrink-0">
                    <BookOpen size={18} className="text-primario" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-texto">Repetir tour de la app</p>
                    <p className="text-xs text-suave">Vuelve a ver el recorrido de las funciones principales</p>
                  </div>
                </button>
              </section>
            )}

            {/* Ajustes operativos */}
            <section>
              <p className="text-xs font-semibold text-suave uppercase tracking-wider mb-3">
                Ajustes operativos
              </p>
              <div className="flex flex-col gap-3">

                {/* Toggle stock negativo */}
                <div className="flex items-center justify-between p-3 bg-fondo rounded-xl border border-borde">
                  <div>
                    <p className="text-sm font-medium text-texto">Permitir stock negativo</p>
                    <p className="text-xs text-suave">Vender aunque el inventario quede en 0</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setValue('permitirStockNegativo', !permitirStockNegativo, { shouldDirty: true })}
                    className={[
                      'relative w-11 h-6 rounded-full transition-colors shrink-0',
                      permitirStockNegativo ? 'bg-primario' : 'bg-gray-200',
                    ].join(' ')}
                  >
                    <span className={[
                      'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                      permitirStockNegativo ? 'translate-x-5' : 'translate-x-0.5',
                    ].join(' ')} />
                  </button>
                </div>

                {/* Toggle datáfono */}
                <div className="flex items-center justify-between p-3 bg-fondo rounded-xl border border-borde">
                  <div>
                    <p className="text-sm font-medium text-texto">Tiene datáfono</p>
                    <p className="text-xs text-suave">Muestra la opción "Tarjeta" al cobrar</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setValue('tieneDatafono', !tieneDatafono, { shouldDirty: true })}
                    className={[
                      'relative w-11 h-6 rounded-full transition-colors shrink-0',
                      tieneDatafono ? 'bg-primario' : 'bg-gray-200',
                    ].join(' ')}
                  >
                    <span className={[
                      'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                      tieneDatafono ? 'translate-x-5' : 'translate-x-0.5',
                    ].join(' ')} />
                  </button>
                </div>

                {/* Límite de fiado */}
                <Campo label="Límite de fiado por defecto (0 = sin límite)" error={errors.limiteFiadoPorDefecto?.message}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suave text-sm font-medium">$</span>
                    <input
                      {...register('limiteFiadoPorDefecto')}
                      type="number"
                      min={0}
                      step={1000}
                      placeholder="0"
                      className={`${INPUT_CLS} pl-7 moneda`}
                    />
                  </div>
                </Campo>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 border border-borde text-texto rounded-xl
                         font-semibold hover:bg-gray-50 active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="flex-1 h-12 bg-primario text-white rounded-xl
                         font-display font-bold text-base
                         hover:bg-primario-hover active:scale-95 transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
