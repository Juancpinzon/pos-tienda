import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Package, ChevronDown } from 'lucide-react'
import { useCategorias, crearProducto, editarProducto } from '../../hooks/useProductos'
import type { Producto } from '../../db/schema'

// ─── Schema de validación ─────────────────────────────────────────────────────

// Los campos opcionales de número se declaran como string en el form y se coercen en onSubmit
const ProductoSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  categoriaId: z.coerce.number().min(1, 'Selecciona una categoría'),
  precio: z.coerce.number({ invalid_type_error: 'Precio requerido' }).min(1, 'Debe ser mayor a $0'),
  precioCompra: z.string().optional(),
  codigoBarras: z.string().optional(),
  unidad: z.enum(['unidad', 'gramo', 'mililitro', 'porcion'] as const),
  controlaStock: z.boolean(),
  stockActual: z.string().optional(),
  stockMinimo: z.string().optional(),
})

type FormData = z.infer<typeof ProductoSchema>

// Convierte string vacío o undefined → undefined, si no parseFloat
function toNum(v: string | undefined): number | undefined {
  if (!v || v.trim() === '') return undefined
  const n = parseFloat(v)
  return isNaN(n) ? undefined : n
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FormProductoProps {
  /** Producto a editar. Si es null, se crea uno nuevo. */
  producto?: Producto | null
  /** Nombre precompletado (cuando viene de un producto fantasma) */
  nombrePreset?: string
  onClose: () => void
  onGuardado?: (id: number) => void
}

// ─── Helper: campo de texto reutilizable ─────────────────────────────────────

function Campo({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-texto">
        {label}
        {required && <span className="text-peligro ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-peligro">{error}</p>}
    </div>
  )
}

const INPUT_CLS =
  'w-full h-11 px-3 border border-borde rounded-xl text-base text-texto ' +
  'focus:outline-none focus:ring-2 focus:ring-primario/40 focus:border-primario ' +
  'placeholder:text-suave disabled:bg-gray-50'

const SELECT_CLS =
  'w-full h-11 pl-3 pr-8 border border-borde rounded-xl text-base text-texto ' +
  'focus:outline-none focus:ring-2 focus:ring-primario/40 focus:border-primario ' +
  'appearance-none bg-white'

// ─── Componente principal ─────────────────────────────────────────────────────

export function FormProducto({ producto, nombrePreset, onClose, onGuardado }: FormProductoProps) {
  const categorias = useCategorias()
  const esEdicion = producto !== null && producto !== undefined

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(ProductoSchema),
    defaultValues: {
      nombre: '',
      categoriaId: 0,
      precio: 0,
      unidad: 'unidad',
      controlaStock: false,
    },
  })

  const controlaStock  = watch('controlaStock')
  const precioCompraW  = watch('precioCompra')
  const precioActualW  = watch('precio')

  // ─── Calculadora de precio sugerido ──────────────────────────────────────
  const [utilidad, setUtilidad] = useState(30)  // % de utilidad deseada

  // PV = PC / (1 - %utilidad/100)  — fórmula margen sobre precio de venta
  const pc = parseFloat(precioCompraW ?? '') || 0
  const pvSugerido = pc > 0 && utilidad < 100
    ? Math.round(pc / (1 - utilidad / 100))
    : 0

  // Poblar el formulario cuando estamos editando o hay un preset de nombre
  useEffect(() => {
    if (producto) {
      reset({
        nombre: producto.nombre,
        categoriaId: producto.categoriaId,
        precio: producto.precio,
        precioCompra: producto.precioCompra !== undefined ? String(producto.precioCompra) : '',
        codigoBarras: producto.codigoBarras ?? '',
        unidad: producto.unidad,
        controlaStock: producto.stockActual !== undefined,
        stockActual: producto.stockActual !== undefined ? String(producto.stockActual) : '',
        stockMinimo: producto.stockMinimo !== undefined ? String(producto.stockMinimo) : '',
      })
    } else if (nombrePreset) {
      setValue('nombre', nombrePreset)
    }
  }, [producto, nombrePreset, reset, setValue])

  const onSubmit = async (data: FormData) => {
    const productoData = {
      nombre: data.nombre,
      categoriaId: data.categoriaId,
      precio: data.precio,
      precioCompra: toNum(data.precioCompra),
      codigoBarras: data.codigoBarras?.trim() || undefined,
      unidad: data.unidad,
      esFantasma: false,
      activo: true,
      // Stock: solo guardar si controla stock
      stockActual: data.controlaStock ? (toNum(data.stockActual) ?? 0) : undefined,
      stockMinimo: data.controlaStock ? toNum(data.stockMinimo) : undefined,
    }

    if (esEdicion && producto.id !== undefined) {
      await editarProducto(producto.id, productoData)
      onGuardado?.(producto.id)
    } else {
      const id = await crearProducto(productoData)
      onGuardado?.(id)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-borde shrink-0">
          <div className="flex items-center gap-3">
            <Package size={20} className="text-primario" />
            <h2 className="font-display font-bold text-lg text-texto">
              {esEdicion ? 'Editar producto' : 'Nuevo producto'}
            </h2>
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
          <div className="px-5 py-4 flex flex-col gap-4">

            {/* Nombre */}
            <Campo label="Nombre del producto" error={errors.nombre?.message} required>
              <input
                {...register('nombre')}
                type="text"
                placeholder="Ej: Leche Entera 1L, Mogolla, Aguacate…"
                autoFocus={!esEdicion}
                className={INPUT_CLS}
              />
            </Campo>

            {/* Categoría + Precio (row) */}
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Categoría" error={errors.categoriaId?.message} required>
                <div className="relative">
                  <select {...register('categoriaId', { valueAsNumber: true })} className={SELECT_CLS}>
                    <option value={0}>Seleccionar…</option>
                    {categorias?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.nombre}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-suave pointer-events-none" />
                </div>
              </Campo>

              <Campo label="Precio de venta" error={errors.precio?.message} required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suave text-sm font-medium">$</span>
                  <input
                    {...register('precio', { valueAsNumber: true })}
                    type="number"
                    min={0}
                    placeholder="0"
                    className={`${INPUT_CLS} pl-7 moneda`}
                  />
                </div>
              </Campo>
            </div>

            {/* Precio compra + Código de barras (row) */}
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Precio de compra" error={errors.precioCompra?.message}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suave text-sm font-medium">$</span>
                  <input
                    {...register('precioCompra')}
                    type="number"
                    min={0}
                    placeholder="Opcional"
                    className={`${INPUT_CLS} pl-7 moneda`}
                  />
                </div>
              </Campo>

              <Campo label="Código de barras" error={errors.codigoBarras?.message}>
                <input
                  {...register('codigoBarras')}
                  type="text"
                  placeholder="EAN opcional"
                  className={INPUT_CLS}
                />
              </Campo>
            </div>

            {/* ── Calculadora de precio sugerido ─────────────────────────── */}
            {pvSugerido > 0 && (
              <div data-tour="calculadora-precio" className="bg-primario/5 border border-primario/20 rounded-xl p-3 flex flex-col gap-3">

                {/* Fila 1: label + input utilidad */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-primario">Precio de venta sugerido</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-suave">Utilidad:</span>
                    <div className="relative w-[72px]">
                      <input
                        type="number"
                        value={utilidad}
                        onChange={(e) => {
                          const v = Math.min(99, Math.max(0, Number(e.target.value) || 0))
                          setUtilidad(v)
                        }}
                        min={0}
                        max={99}
                        className="w-full h-8 px-2 pr-5 border border-primario/30 rounded-lg text-sm moneda
                                   text-texto bg-white focus:outline-none focus:ring-1 focus:ring-primario/40"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-suave pointer-events-none">%</span>
                    </div>
                  </div>
                </div>

                {/* Fila 2: PV sugerido destacado */}
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-suave">PV sugerido:</span>
                  <span className="moneda font-bold text-lg text-primario leading-none">
                    ${pvSugerido.toLocaleString('es-CO')}
                  </span>
                  <span className="text-[10px] text-suave/70 ml-auto">
                    = ${pc.toLocaleString('es-CO')} ÷ (1 − {utilidad}%)
                  </span>
                </div>

                {/* Fila 3: botón + precio actual */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setValue('precio', pvSugerido, { shouldValidate: true })}
                    className={[
                      'h-10 px-4 rounded-xl text-sm font-bold transition-all shrink-0',
                      Number(precioActualW) === pvSugerido
                        ? 'bg-primario text-white cursor-default'
                        : 'bg-primario text-white hover:bg-primario-hover active:scale-95',
                    ].join(' ')}
                  >
                    {Number(precioActualW) === pvSugerido
                      ? `✓ Usando $${pvSugerido.toLocaleString('es-CO')}`
                      : `✓ Usar $${pvSugerido.toLocaleString('es-CO')}`}
                  </button>
                  {Number(precioActualW) > 0 && Number(precioActualW) !== pvSugerido && (
                    <p className="text-sm text-suave">
                      Actual:{' '}
                      <span className="moneda font-semibold text-texto">
                        ${Number(precioActualW).toLocaleString('es-CO')}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Unidad */}
            <Campo label="Unidad de venta" error={errors.unidad?.message} required>
              <div className="grid grid-cols-4 gap-2">
                {(['unidad', 'gramo', 'mililitro', 'porcion'] as const).map((u) => {
                  const labels = { unidad: 'Unidad', gramo: 'Gramo', mililitro: 'mL', porcion: 'Porción' }
                  const icons  = { unidad: '📦', gramo: '⚖️', mililitro: '🥛', porcion: '🍽️' }
                  const val = watch('unidad')
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setValue('unidad', u)}
                      className={[
                        'flex flex-col items-center gap-0.5 h-12 rounded-xl border text-xs font-medium transition-all',
                        val === u
                          ? 'bg-primario text-white border-primario'
                          : 'bg-white text-texto border-borde hover:border-primario/50',
                      ].join(' ')}
                    >
                      <span className="text-base">{icons[u]}</span>
                      <span>{labels[u]}</span>
                    </button>
                  )
                })}
              </div>
            </Campo>

            {/* Controla stock — toggle */}
            <div className="flex items-center justify-between p-3 bg-fondo rounded-xl border border-borde">
              <div>
                <p className="text-sm font-medium text-texto">Controlar inventario</p>
                <p className="text-xs text-suave">Rastrea cuántas unidades hay disponibles</p>
              </div>
              <button
                type="button"
                onClick={() => setValue('controlaStock', !controlaStock)}
                className={[
                  'relative w-11 h-6 rounded-full transition-colors',
                  controlaStock ? 'bg-primario' : 'bg-gray-200',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                    controlaStock ? 'translate-x-5' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </button>
            </div>

            {/* Campos de stock (condicionales) */}
            {controlaStock && (
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Stock actual" error={errors.stockActual?.message}>
                  <input
                    {...register('stockActual')}
                    type="number"
                    min={0}
                    placeholder="0"
                    className={`${INPUT_CLS} moneda`}
                  />
                </Campo>
                <Campo label="Stock mínimo (alerta)" error={errors.stockMinimo?.message}>
                  <input
                    {...register('stockMinimo')}
                    type="number"
                    min={0}
                    placeholder="0"
                    className={`${INPUT_CLS} moneda`}
                  />
                </Campo>
              </div>
            )}
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
              disabled={isSubmitting}
              className="flex-1 h-12 bg-primario text-white rounded-xl
                         font-display font-bold text-base
                         hover:bg-primario-hover active:scale-95 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
