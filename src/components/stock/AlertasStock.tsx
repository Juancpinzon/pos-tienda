import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { useProductosBajoStock, registrarEntrada } from '../../hooks/useStock'
import { formatCOP } from '../../utils/moneda'
import type { Producto } from '../../db/schema'

// ─── Componente principal ─────────────────────────────────────────────────────

export function AlertasStock() {
  const [abierto, setAbierto] = useState(true)
  const [productoEntrada, setProductoEntrada] = useState<Producto | null>(null)

  const bajoStock = useProductosBajoStock()

  if (!bajoStock || bajoStock.length === 0) return null

  return (
    <>
      <div className="mx-4 mt-4 border border-peligro/40 rounded-xl overflow-hidden">
        {/* Header colapsable */}
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3
                     bg-red-50 hover:bg-red-100 transition-colors"
        >
          <AlertTriangle size={16} className="text-peligro" />
          <span className="text-sm font-semibold text-peligro flex-1 text-left">
            {bajoStock.length} producto{bajoStock.length !== 1 ? 's' : ''} bajo mínimo
          </span>
          {abierto ? (
            <ChevronDown size={16} className="text-peligro" />
          ) : (
            <ChevronRight size={16} className="text-peligro" />
          )}
        </button>

        {/* Lista de alertas */}
        {abierto && (
          <div className="divide-y divide-borde/50 bg-white">
            {bajoStock.map((p) => (
              <FilaAlerta
                key={p.id}
                producto={p}
                onEntrada={() => setProductoEntrada(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal entrada rápida */}
      {productoEntrada && (
        <ModalEntradaRapida
          producto={productoEntrada}
          onClose={() => setProductoEntrada(null)}
        />
      )}
    </>
  )
}

// ─── FilaAlerta ───────────────────────────────────────────────────────────────

function FilaAlerta({
  producto,
  onEntrada,
}: {
  producto: Producto
  onEntrada: () => void
}) {
  const stockActual = producto.stockActual ?? 0
  const stockMinimo = producto.stockMinimo ?? 0
  const deficit = stockMinimo - stockActual

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-texto truncate">{producto.nombre}</p>
        <p className="text-xs text-peligro font-medium">
          Stock: {stockActual} · Mínimo: {stockMinimo}
          {deficit > 0 && ` · Faltan ${deficit}`}
        </p>
        {producto.precioCompra && (
          <p className="text-xs text-suave">Costo: {formatCOP(producto.precioCompra)}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onEntrada}
        className="shrink-0 h-8 px-3 bg-primario/10 text-primario border border-primario/30
                   rounded-lg text-xs font-semibold hover:bg-primario/20 transition-colors
                   flex items-center gap-1"
      >
        <Plus size={12} />
        Entrada
      </button>
    </div>
  )
}

// ─── ModalEntradaRapida ───────────────────────────────────────────────────────

function ModalEntradaRapida({
  producto,
  onClose,
}: {
  producto: Producto
  onClose: () => void
}) {
  const [cantidad, setCantidad] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cantidadNum = parseFloat(cantidad || '0')

  const handleGuardar = async () => {
    if (cantidadNum <= 0 || guardando) return
    setGuardando(true)
    try {
      await registrarEntrada(
        producto.id!,
        cantidadNum,
        producto.precioCompra,
        nota.trim() || 'Entrada manual',
      )
      onClose()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-borde">
          <div className="flex-1">
            <p className="font-display font-bold text-texto text-sm">Registrar entrada</p>
            <p className="text-xs text-suave truncate">{producto.nombre}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-suave hover:text-texto hover:bg-fondo transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Formulario */}
        <div className="p-5 flex flex-col gap-3">
          {/* Stock actual */}
          <div className="flex items-center justify-between p-3 bg-fondo rounded-xl">
            <span className="text-sm text-suave">Stock actual</span>
            <span className="moneda font-bold text-texto">
              {producto.stockActual ?? 0}
              {producto.stockMinimo !== undefined && (
                <span className="text-xs text-suave font-normal ml-1">
                  (mín: {producto.stockMinimo})
                </span>
              )}
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-suave mb-1 block">
              Cantidad a ingresar *
            </label>
            <input
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGuardar() }}
              placeholder="0"
              min={0.01}
              step={0.01}
              autoFocus
              className="w-full h-11 px-3 border border-borde rounded-xl text-sm moneda text-texto
                         focus:outline-none focus:ring-2 focus:ring-primario/30"
            />
            {cantidadNum > 0 && (
              <p className="text-xs text-exito mt-1 ml-1">
                Stock resultante: {(producto.stockActual ?? 0) + cantidadNum}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-suave mb-1 block">
              Nota (opcional)
            </label>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: Pedido del lunes, factura #123"
              className="w-full h-11 px-3 border border-borde rounded-xl text-sm text-texto
                         focus:outline-none focus:ring-2 focus:ring-primario/30"
            />
          </div>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={cantidadNum <= 0 || guardando}
            className="h-12 bg-primario text-white rounded-xl font-display font-bold
                       hover:bg-primario-hover active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {guardando ? 'Guardando…' : 'Registrar entrada'}
          </button>
        </div>
      </div>
    </div>
  )
}
