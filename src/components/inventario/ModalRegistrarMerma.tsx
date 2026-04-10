// src/components/inventario/ModalRegistrarMerma.tsx
// Modal rápido para registrar mermas (pérdidas) desde InventarioPage.
// Máximo 3 toques para completar: producto → tipo → cantidad → registrar.

import { useState, useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { db } from '../../db/database'
import type { Producto } from '../../db/schema'
import { useMermas } from '../../hooks/useMermas'
import { formatCOP } from '../../utils/moneda'
import toast from 'react-hot-toast'

// ── Tipos de merma con etiquetas ──────────────────────────────────────────────

const TIPOS_MERMA = [
  { valor: 'vencido',          emoji: '📅', label: 'Vencido'         },
  { valor: 'dañado',           emoji: '💔', label: 'Dañado'          },
  { valor: 'consumo_interno',  emoji: '🏪', label: 'Consumo interno' },
  { valor: 'otro',             emoji: '📝', label: 'Otro'            },
] as const

type TipoMerma = typeof TIPOS_MERMA[number]['valor']

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Producto preseleccionado (desde la tarjeta de inventario). Si null, el usuario elige. */
  productoInicial?: Producto | null
  onClose: () => void
}

// ─── Componente ────────────────────────────────────────────────────────────────

export function ModalRegistrarMerma({ productoInicial = null, onClose }: Props) {
  const { registrarMerma } = useMermas()

  // ── Estado del formulario ──────────────────────────────────────────────────
  const [query, setQuery]           = useState(productoInicial?.nombre ?? '')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [dropdownAbierto, setDropdownAbierto] = useState(false)
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(productoInicial)

  const [tipo, setTipo]         = useState<TipoMerma>('vencido')
  const [cantidad, setCantidad] = useState('')
  const [costoUnitario, setCostoUnitario] = useState(
    productoInicial?.precioCompra ? String(productoInicial.precioCompra) : '',
  )
  const [notas, setNotas]       = useState('')
  const [guardando, setGuardando] = useState(false)

  // ── Búsqueda de productos (con debounce simple) ────────────────────────────
  useEffect(() => {
    if (productoSeleccionado) {
      setResultados([])
      setDropdownAbierto(false)
      return
    }
    if (query.length < 2) {
      setResultados([])
      setDropdownAbierto(false)
      return
    }
    const timer = setTimeout(async () => {
      const lower = query.toLowerCase()
      const found = await db.productos
        .filter((p) => p.activo && !p.esFantasma && p.nombre.toLowerCase().includes(lower))
        .limit(6)
        .toArray()
      setResultados(found)
      setDropdownAbierto(true)
    }, 250)
    return () => clearTimeout(timer)
  }, [query, productoSeleccionado])

  // Au-rellenar costo unitario cuando se selecciona un producto
  const seleccionarProducto = (p: Producto) => {
    setProductoSeleccionado(p)
    setQuery(p.nombre)
    setDropdownAbierto(false)
    if (p.precioCompra) {
      setCostoUnitario(String(p.precioCompra))
    }
  }

  const limpiarProducto = () => {
    setProductoSeleccionado(null)
    setQuery('')
    setCostoUnitario('')
    setResultados([])
  }

  // ── Cálculos en tiempo real ────────────────────────────────────────────────
  const cantidadNum     = parseFloat(cantidad)  || 0
  const costoUnitNum    = parseFloat(costoUnitario) || 0
  const costoTotalCalc  = cantidadNum * costoUnitNum

  // ── Formulario válido ──────────────────────────────────────────────────────
  // Requiere: nombre del producto (puede ser texto libre), tipo, cantidad > 0, costo > 0
  const nombreFinal = productoSeleccionado?.nombre ?? query.trim()
  const puedeGuardar = nombreFinal.length > 0 && cantidadNum > 0 && costoUnitNum >= 0

  // ── Registrar ──────────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!puedeGuardar || guardando) return
    setGuardando(true)
    try {
      const unidad = productoSeleccionado?.unidad ?? 'unidad'

      await registrarMerma({
        productoId:     productoSeleccionado?.id,
        nombreProducto: nombreFinal,
        cantidad:       cantidadNum,
        unidad,
        precioCompra:   costoUnitNum,
        costoTotal:     costoTotalCalc,
        tipo,
        notas:          notas.trim() || undefined,
      })

      toast.success(`📦 Merma registrada — Pérdida: ${formatCOP(costoTotalCalc)}`)
      onClose()
    } catch (err) {
      console.error('[ModalRegistrarMerma]', err)
      toast.error('Error al registrar la merma')
    } finally {
      setGuardando(false)
    }
  }

  // ─── UI ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Registrar merma"
    >
      <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden
                      max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-texto">📦 Registrar Merma</h2>
            <p className="text-xs text-suave mt-0.5">Productos vencidos, dañados o consumo interno</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full
                       text-suave hover:text-texto hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 flex flex-col gap-4">

          {/* ── Producto ── */}
          <div className="relative">
            <label className="text-xs font-semibold text-suave mb-1 block">
              Producto *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (productoSeleccionado) limpiarProducto()
                }}
                placeholder="Buscar o escribir nombre del producto..."
                className="flex-1 h-11 px-3 border border-borde rounded-xl text-sm text-texto
                           focus:outline-none focus:ring-2 focus:ring-primario/30"
                autoFocus={!productoInicial}
              />
              {productoSeleccionado && (
                <button
                  type="button"
                  onClick={limpiarProducto}
                  className="w-11 h-11 flex items-center justify-center border border-borde
                             rounded-xl text-suave hover:text-peligro hover:border-peligro/40
                             transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Badge producto seleccionado */}
            {productoSeleccionado && (
              <div className="mt-1.5 flex items-center gap-2 px-3 py-1.5 bg-primario/8
                              border border-primario/20 rounded-lg">
                <span className="text-xs font-semibold text-primario truncate">
                  ✓ {productoSeleccionado.nombre}
                </span>
                {productoSeleccionado.stockActual !== undefined && (
                  <span className="text-[10px] text-suave ml-auto shrink-0">
                    Stock: {productoSeleccionado.stockActual}
                  </span>
                )}
              </div>
            )}

            {/* Dropdown resultados */}
            {dropdownAbierto && resultados.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white
                              border border-borde rounded-xl shadow-lg overflow-hidden">
                {resultados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => seleccionarProducto(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5
                               hover:bg-fondo text-left border-b border-borde/40 last:border-0
                               transition-colors"
                  >
                    <span className="text-sm text-texto truncate pr-3">{p.nombre}</span>
                    {p.precioCompra && (
                      <span className="text-xs text-suave moneda shrink-0">
                        Costo: {formatCOP(p.precioCompra)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Tipo de merma ── */}
          <div>
            <label className="text-xs font-semibold text-suave mb-2 block">
              Tipo de merma *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_MERMA.map(({ valor, emoji, label }) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setTipo(valor)}
                  className={[
                    'h-11 rounded-xl text-sm font-semibold border transition-all',
                    'flex items-center justify-center gap-2',
                    tipo === valor
                      ? 'bg-peligro/10 text-peligro border-peligro/40'
                      : 'bg-white text-suave border-borde hover:border-suave hover:text-texto',
                  ].join(' ')}
                >
                  <span>{emoji}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Cantidad y costo ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-suave mb-1 block">
                Cantidad perdida *
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="0"
                  min={0.01}
                  step={0.01}
                  className="w-full h-11 px-3 border border-borde rounded-xl text-sm
                             moneda text-texto focus:outline-none focus:ring-2 focus:ring-peligro/30"
                />
                {productoSeleccionado && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-suave">
                    {productoSeleccionado.unidad === 'gramo' ? 'g' :
                     productoSeleccionado.unidad === 'mililitro' ? 'ml' :
                     productoSeleccionado.unidad === 'porcion' ? 'por.' : 'u'}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-suave mb-1 block">
                Costo unitario ($)
              </label>
              <input
                type="number"
                value={costoUnitario}
                onChange={(e) => setCostoUnitario(e.target.value)}
                placeholder="0"
                min={0}
                step={1}
                className="w-full h-11 px-3 border border-borde rounded-xl text-sm
                           moneda text-texto focus:outline-none focus:ring-2 focus:ring-peligro/30"
              />
            </div>
          </div>

          {/* Pérdida total en tiempo real */}
          {costoTotalCalc > 0 && (
            <div className="flex items-center gap-3 bg-peligro/8 border border-peligro/25
                            rounded-xl px-4 py-3">
              <AlertTriangle size={18} className="text-peligro shrink-0" />
              <div>
                <p className="text-xs text-suave">Pérdida total estimada</p>
                <p className="moneda text-xl font-bold text-peligro">
                  {formatCOP(costoTotalCalc)}
                </p>
                {cantidadNum > 0 && costoUnitNum > 0 && (
                  <p className="text-[11px] text-suave mt-0.5">
                    {cantidadNum} ×{' '}
                    {formatCOP(costoUnitNum)} c/u
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Notas opcionales */}
          <div>
            <label className="text-xs font-semibold text-suave mb-1 block">
              Notas (opcional)
            </label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: Lote vencido, golpe en bodega..."
              className="w-full h-11 px-3 border border-borde rounded-xl text-sm text-texto
                         focus:outline-none focus:ring-2 focus:ring-primario/30"
            />
          </div>

          {/* Botón registrar */}
          <button
            id="btn-registrar-merma"
            type="button"
            onClick={handleGuardar}
            disabled={!puedeGuardar || guardando}
            style={{ minHeight: '60px' }}
            className="w-full rounded-2xl text-white text-base font-bold
                       bg-peligro hover:bg-red-700 active:scale-[0.97] transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {guardando ? 'Registrando…' : `Registrar pérdida${costoTotalCalc > 0 ? ' — ' + formatCOP(costoTotalCalc) : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
