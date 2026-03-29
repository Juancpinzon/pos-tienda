import { useState } from 'react'
import { ShoppingCart, X } from 'lucide-react'
import { BuscadorProducto } from '../components/pos/BuscadorProducto'
import { GridProductosRapidos } from '../components/pos/GridProductosRapidos'
import { LineaVenta } from '../components/pos/LineaVenta'
import { ResumenVenta } from '../components/pos/ResumenVenta'
import { ModalCobro } from '../components/pos/ModalCobro'
import { useVentaStore, selectTotal, selectConteo } from '../stores/ventaStore'
import { formatCOP } from '../utils/moneda'

export default function POSPage() {
  const [mostrarModal, setMostrarModal] = useState(false)
  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const items = useVentaStore((s) => s.items)
  const total = useVentaStore(selectTotal)
  const conteo = useVentaStore(selectConteo)

  // JSX compartido entre columna desktop y drawer móvil
  const listaItems = (
    <>
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
    </>
  )

  return (
    <div className="h-full flex flex-col bg-fondo overflow-hidden">

      {/* ── Header: buscador ──────────────────────────────────────────── */}
      <div data-tour="buscador" className="bg-white border-b border-borde px-3 py-2 shrink-0">
        <BuscadorProducto />
      </div>

      {/* ── Cuerpo principal ──────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Grid de productos rápidos */}
        <div data-tour="grid-productos" className="flex-1 overflow-y-auto p-3 md:border-r md:border-borde">
          <p className="text-xs font-semibold text-suave uppercase tracking-wide mb-2">
            Más vendidos
          </p>
          <GridProductosRapidos />
        </div>

        {/* ── Carrito — columna derecha solo en tablet/desktop ─────────── */}
        <div data-tour="carrito" className="hidden md:flex w-[300px] flex-col bg-white shrink-0">

          {/* Encabezado */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-borde shrink-0">
            <ShoppingCart size={16} className="text-primario" />
            <span className="text-xs font-semibold text-suave uppercase tracking-wide">
              Venta actual
            </span>
          </div>

          {/* Lista de ítems */}
          <div className="flex-1 overflow-y-auto px-2 py-1">
            {listaItems}
          </div>

          {/* Resumen + botón cobrar */}
          <div data-tour="btn-cobrar">
            <ResumenVenta onCobrar={() => setMostrarModal(true)} />
          </div>
        </div>
      </div>

      {/* ── Botón flotante — solo móvil ───────────────────────────────── */}
      <button
        type="button"
        onClick={() => setDrawerAbierto(true)}
        className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-30
                   flex items-center gap-2 px-5 h-14
                   bg-primario text-white rounded-full
                   shadow-lg shadow-primario/40
                   font-display font-bold text-base
                   active:scale-95 transition-all"
      >
        <ShoppingCart size={20} />
        {conteo > 0
          ? `${Math.round(conteo)} item${Math.round(conteo) !== 1 ? 's' : ''} · ${formatCOP(total)}`
          : 'Ver carrito'}
      </button>

      {/* ── Drawer de carrito — solo móvil ───────────────────────────── */}
      {drawerAbierto && (
        <>
          {/* Backdrop: cierra al tocar fuera */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setDrawerAbierto(false)}
          />

          {/* Panel deslizante desde abajo */}
          <div className="md:hidden fixed inset-x-0 bottom-0 z-50
                          flex flex-col bg-white rounded-t-2xl
                          max-h-[82vh] shadow-2xl">

            {/* Handle visual + header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-borde shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-primario" />
                <span className="font-semibold text-texto">Venta actual</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerAbierto(false)}
                className="p-2 rounded-full hover:bg-fondo text-suave active:scale-95 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Lista de ítems */}
            <div className="flex-1 overflow-y-auto px-2 py-1 min-h-0">
              {listaItems}
            </div>

            {/* Resumen + COBRAR */}
            <ResumenVenta
              onCobrar={() => {
                setDrawerAbierto(false)
                setMostrarModal(true)
              }}
            />
          </div>
        </>
      )}

      {/* ── Modal de cobro ────────────────────────────────────────────── */}
      {mostrarModal && (
        <ModalCobro onClose={() => setMostrarModal(false)} />
      )}
    </div>
  )
}
