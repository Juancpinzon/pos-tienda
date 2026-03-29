import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { BuscadorProducto } from '../components/pos/BuscadorProducto'
import { GridProductosRapidos } from '../components/pos/GridProductosRapidos'
import { LineaVenta } from '../components/pos/LineaVenta'
import { ResumenVenta } from '../components/pos/ResumenVenta'
import { ModalCobro } from '../components/pos/ModalCobro'
import { useVentaStore } from '../stores/ventaStore'

export default function POSPage() {
  const [mostrarModal, setMostrarModal] = useState(false)
  const items = useVentaStore((s) => s.items)

  return (
    <div className="h-full flex flex-col bg-fondo overflow-hidden">

      {/* ── Header: buscador ──────────────────────────────────────────── */}
      <div data-tour="buscador" className="bg-white border-b border-borde px-3 py-2 shrink-0">
        <BuscadorProducto />
      </div>

      {/* ── Cuerpo: grid izq / carrito der ───────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Izquierda: grid de productos rápidos */}
        <div data-tour="grid-productos" className="flex-1 overflow-y-auto p-3 border-r border-borde">
          <p className="text-xs font-semibold text-suave uppercase tracking-wide mb-2">
            Más vendidos
          </p>
          <GridProductosRapidos />
        </div>

        {/* Derecha: carrito de venta (ancho fijo) */}
        <div data-tour="carrito" className="w-[300px] flex flex-col bg-white shrink-0">

          {/* Encabezado carrito */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-borde shrink-0">
            <ShoppingCart size={16} className="text-primario" />
            <span className="text-xs font-semibold text-suave uppercase tracking-wide">
              Venta actual
            </span>
          </div>

          {/* Lista de ítems */}
          <div className="flex-1 overflow-y-auto px-2 py-1">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-suave/50">
                <ShoppingCart size={36} strokeWidth={1} />
                <p className="text-sm text-center">
                  Agrega productos <br /> desde el buscador o el grid
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {items.map((item, index) => (
                  <LineaVenta key={`${item.productoId ?? 'f'}-${index}`} item={item} index={index} />
                ))}
              </div>
            )}
          </div>

          {/* Resumen + botón cobrar */}
          <div data-tour="btn-cobrar">
            <ResumenVenta onCobrar={() => setMostrarModal(true)} />
          </div>
        </div>
      </div>

      {/* ── Modal de cobro ────────────────────────────────────────────── */}
      {mostrarModal && (
        <ModalCobro onClose={() => setMostrarModal(false)} />
      )}
    </div>
  )
}
