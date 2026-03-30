import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Store, Phone, MapPin, FileText, Receipt, BookOpen, Users, Send, CheckCircle, UserX, Loader2, Sun, Moon, Monitor } from 'lucide-react'
import { useConfig, guardarConfig } from '../../hooks/useConfig'
import { supabase, supabaseConfigurado } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useThemeStore, type Tema } from '../../stores/themeStore'

// ─── Schema ───────────────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  nombreTienda: z.string().min(1, 'Ingresa el nombre').max(60),
  direccion: z.string().max(100).optional().transform((v) => v?.trim() || undefined),
  telefono: z.string().max(20).optional().transform((v) => v?.trim() || undefined),
  nit: z.string().max(20).optional().transform((v) => v?.trim() || undefined),
  mensajeRecibo: z.string().max(120).optional().transform((v) => v?.trim() || undefined),
  permitirStockNegativo: z.boolean(),
  limiteFiadoPorDefecto: z.coerce.number().min(0),
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
    },
  })

  const permitirStockNegativo = watch('permitirStockNegativo')

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
