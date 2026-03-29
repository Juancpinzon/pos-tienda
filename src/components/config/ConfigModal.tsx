import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Store, Phone, MapPin, FileText, Receipt, BookOpen } from 'lucide-react'
import { useConfig, guardarConfig } from '../../hooks/useConfig'

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
