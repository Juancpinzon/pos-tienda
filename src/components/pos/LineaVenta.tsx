import { useState, useRef, useEffect } from 'react'
import { Minus, Plus, Trash2, Pencil, Check } from 'lucide-react'
import { useVentaStore } from '../../stores/ventaStore'
import { formatCOP } from '../../utils/moneda'
import type { ItemCarrito } from '../../types'

interface LineaVentaProps {
  item: ItemCarrito
  index: number
}

export function LineaVenta({ item, index }: LineaVentaProps) {
  const { quitarItem, cambiarCantidad, cambiarPrecio } = useVentaStore()
  const [editandoPrecio, setEditandoPrecio] = useState(false)
  const [precioTemp, setPrecioTemp] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus automático al abrir editor de precio
  useEffect(() => {
    if (editandoPrecio) {
      setPrecioTemp(String(item.precioUnitario))
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }, [editandoPrecio, item.precioUnitario])

  const confirmarPrecio = () => {
    const nuevo = parseInt(precioTemp, 10)
    if (!isNaN(nuevo) && nuevo >= 0) {
      cambiarPrecio(index, nuevo)
    }
    setEditandoPrecio(false)
  }

  const handlePrecioKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') confirmarPrecio()
    if (e.key === 'Escape') setEditandoPrecio(false)
  }

  const decrementar = () => {
    if (item.cantidad <= 1) {
      quitarItem(index)
    } else {
      cambiarCantidad(index, item.cantidad - 1)
    }
  }

  return (
    <div className={[
      'flex flex-col sm:flex-row sm:items-center gap-2 py-2 px-2 rounded-xl',
      item.esProductoFantasma ? 'bg-orange-50 border border-orange-200' : 'bg-white',
    ].join(' ')}>

      {/* Nombre */}
      <div className="flex-1 w-full sm:w-auto min-w-0">
        <p className="text-sm font-medium text-texto whitespace-normal break-words leading-tight text-balance" title={item.nombreProducto}>
          {item.esProductoFantasma && (
            <span className="text-acento text-xs mr-1">👻</span>
          )}
          {item.nombreProducto}
        </p>

        {/* Precio unitario — tocable para editar */}
        {editandoPrecio ? (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-suave">$</span>
            <input
              ref={inputRef}
              type="number"
              value={precioTemp}
              onChange={(e) => setPrecioTemp(e.target.value)}
              onKeyDown={handlePrecioKeyDown}
              onBlur={confirmarPrecio}
              min={0}
              className="w-20 h-6 text-xs border border-primario rounded px-1 moneda
                         focus:outline-none focus:ring-1 focus:ring-primario"
            />
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); confirmarPrecio() }}
              className="text-primario"
            >
              <Check size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditandoPrecio(true)}
            className="flex items-center gap-1 mt-0.5 group"
            title="Toca para cambiar precio"
          >
            <span className="moneda text-xs text-suave group-hover:text-primario transition-colors">
              {formatCOP(item.precioUnitario)} c/u
            </span>
            <Pencil size={10} className="text-suave/50 group-hover:text-primario transition-colors" />
          </button>
        )}
      </div>

      {/* Fila de controles en móvil */}
      <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-2">
      {/* Controles cantidad */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={decrementar}
          className="w-8 h-8 flex items-center justify-center rounded-lg
                     bg-gray-100 hover:bg-gray-200 active:scale-90 transition-all text-texto"
        >
          <Minus size={14} />
        </button>
        <span className="w-8 text-center text-sm font-bold text-texto moneda">
          {item.cantidad % 1 === 0 ? item.cantidad : item.cantidad.toFixed(2)}
        </span>
        <button
          type="button"
          onClick={() => cambiarCantidad(index, item.cantidad + 1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg
                     bg-primario/10 hover:bg-primario/20 active:scale-90 transition-all text-primario"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Subtotal */}
      <div className="w-20 text-right shrink-0">
        <span className="moneda text-sm font-bold text-texto">{formatCOP(item.subtotal)}</span>
      </div>

      <button
        type="button"
        onClick={() => quitarItem(index)}
        className="w-8 h-8 flex items-center justify-center rounded-lg
                   text-suave hover:text-peligro hover:bg-red-50 active:scale-90 transition-all shrink-0"
      >
        <Trash2 size={15} />
      </button>
      </div>
    </div>
  )
}
