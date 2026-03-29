import { ShoppingBag, Trash2 } from 'lucide-react'
import { useVentaStore, selectTotal, selectConteo } from '../../stores/ventaStore'
import { formatCOP } from '../../utils/moneda'

interface ResumenVentaProps {
  onCobrar: () => void
}

export function ResumenVenta({ onCobrar }: ResumenVentaProps) {
  const total = useVentaStore(selectTotal)
  const conteo = useVentaStore(selectConteo)
  const limpiarCarrito = useVentaStore((s) => s.limpiarCarrito)
  const items = useVentaStore((s) => s.items)

  return (
    <div className="border-t border-borde bg-white p-3 flex flex-col gap-3">
      {/* Total */}
      <div className="flex items-baseline justify-between">
        <span className="text-suave text-sm font-medium">
          {conteo > 0 ? `${Math.round(conteo)} producto${conteo !== 1 ? 's' : ''}` : 'Carrito vacío'}
        </span>
        <span className="moneda font-bold text-total text-texto leading-none">
          {formatCOP(total)}
        </span>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-2">
        {/* Limpiar carrito */}
        <button
          type="button"
          onClick={limpiarCarrito}
          disabled={items.length === 0}
          className="flex items-center justify-center gap-2 h-14 px-4
                     border border-borde text-suave rounded-xl
                     hover:border-peligro hover:text-peligro hover:bg-red-50
                     active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title="Limpiar carrito"
        >
          <Trash2 size={18} />
        </button>

        {/* COBRAR — botón principal, verde, prominente */}
        <button
          type="button"
          onClick={onCobrar}
          disabled={items.length === 0}
          className="flex-1 flex items-center justify-center gap-3
                     h-14 bg-primario text-white rounded-xl
                     font-display font-bold text-xl
                     hover:bg-primario-hover active:scale-95
                     transition-all disabled:opacity-40 disabled:cursor-not-allowed
                     shadow-md shadow-primario/30"
        >
          <ShoppingBag size={22} />
          COBRAR
        </button>
      </div>
    </div>
  )
}
