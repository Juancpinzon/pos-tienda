import { useState, useEffect, useRef, useCallback } from 'react'
import { ShoppingCart, X, ClipboardList } from 'lucide-react'
import { BuscadorProducto, type BuscadorProductoRef } from '../components/pos/BuscadorProducto'
import { GridProductosRapidos } from '../components/pos/GridProductosRapidos'
import { LineaVenta } from '../components/pos/LineaVenta'
import { ResumenVenta } from '../components/pos/ResumenVenta'
import { ModalCobro } from '../components/pos/ModalCobro'
import { CuentasPanel } from '../components/pos/CuentasPanel'
import { useVentaStore, selectTotal, selectConteo } from '../stores/ventaStore'
import { useCantidadCuentasAbiertas, sincronizarItemsCuenta, marcarCuentaCobrada } from '../hooks/useCuentasAbiertas'
import { useSesionActual } from '../hooks/useCaja'
import { useAuthStore } from '../stores/authStore'
import { formatCOP } from '../utils/moneda'
import type { CuentaAbierta, ItemCuenta } from '../db/schema'

export default function POSPage() {
  const [mostrarModal,   setMostrarModal]   = useState(false)
  const [drawerAbierto,  setDrawerAbierto]  = useState(false)
  const [mostrarCuentas, setMostrarCuentas] = useState(false)

  // Ref al buscador para re-enfocar tras cerrar modales
  const buscadorRef = useRef<BuscadorProductoRef>(null)

  // Re-enfocar el buscador cuando se cierra el modal de cobro
  const prevMostrarModal = useRef(false)
  useEffect(() => {
    if (prevMostrarModal.current && !mostrarModal) {
      setTimeout(() => buscadorRef.current?.focus(), 80)
    }
    prevMostrarModal.current = mostrarModal
  }, [mostrarModal])

  // Re-enfocar el buscador cuando se cierra el panel de cuentas
  const prevMostrarCuentas = useRef(false)
  useEffect(() => {
    if (prevMostrarCuentas.current && !mostrarCuentas) {
      setTimeout(() => buscadorRef.current?.focus(), 80)
    }
    prevMostrarCuentas.current = mostrarCuentas
  }, [mostrarCuentas])

  // Cuenta activa — persiste en memoria durante la sesión
  const [cuentaActiva, setCuentaActiva] = useState<CuentaAbierta | null>(null)

  const items         = useVentaStore((s) => s.items)
  const limpiarCarrito = useVentaStore((s) => s.limpiarCarrito)
  const total         = useVentaStore(selectTotal)
  const conteo        = useVentaStore(selectConteo)

  const cantidadCuentas = useCantidadCuentasAbiertas()
  const sesion          = useSesionActual()
  const usuario         = useAuthStore((s) => s.usuario)

  // Solo dueño y encargado pueden usar cuentas abiertas
  const puedeCuentas = !usuario || usuario.rol === 'dueno' || usuario.rol === 'encargado'

  // Sincronizar ventaStore → cuenta activa en Dexie cada vez que cambien los ítems
  useEffect(() => {
    if (!cuentaActiva?.id) return
    void sincronizarItemsCuenta(cuentaActiva.id, items as ItemCuenta[])
  }, [items, cuentaActiva?.id])

  // Seleccionar una cuenta: cargar sus ítems en ventaStore
  const handleSeleccionarCuenta = useCallback((cuenta: CuentaAbierta) => {
    limpiarCarrito()
    setCuentaActiva(cuenta)
    // Cargar los ítems de la cuenta en el carrito
    const { agregarItem } = useVentaStore.getState()
    cuenta.items.forEach((item) => {
      agregarItem({
        productoId:         item.productoId,
        nombreProducto:     item.nombreProducto,
        cantidad:           item.cantidad,
        precioUnitario:     item.precioUnitario,
        precioCompraSnapshot: item.precioCompraSnapshot,
        descuento:          item.descuento,
        esProductoFantasma: item.esProductoFantasma,
      })
    })
  }, [limpiarCarrito])

  // Salir del modo cuenta — volver a venta rápida
  const handleSalirCuenta = useCallback(() => {
    limpiarCarrito()
    setCuentaActiva(null)
  }, [limpiarCarrito])

  // Cuando el cobro es exitoso: marcar cuenta como cobrada y salir del modo cuenta
  const handleVentaExitosa = useCallback(() => {
    if (cuentaActiva?.id) {
      void marcarCuentaCobrada(cuentaActiva.id)
      setCuentaActiva(null)
    }
  }, [cuentaActiva])

  // Etiqueta del carrito según modo
  const labelCarrito = cuentaActiva ? cuentaActiva.nombre : 'Venta actual'
  const emojiCarrito = cuentaActiva ? '📋' : null

  // JSX compartido entre columna desktop y drawer móvil
  const listaItems = (
    <>
      {items.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center gap-2 text-suave/50">
          <ShoppingCart size={36} strokeWidth={1} />
          <p className="text-sm text-center">
            {cuentaActiva
              ? `Agrega productos a ${cuentaActiva.nombre}`
              : 'Agrega productos \n desde el buscador o el grid'}
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

      {/* ── Header: buscador + botón cuentas ─────────────────────────── */}
      <div data-tour="buscador" className="bg-white border-b border-borde px-3 py-2 shrink-0 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <BuscadorProducto ref={buscadorRef} />
        </div>

        {/* Botón cuentas abiertas — solo dueño/encargado */}
        {puedeCuentas && (
          <button
            type="button"
            onClick={() => setMostrarCuentas(true)}
            className={[
              'relative h-11 px-3 rounded-xl border text-sm font-semibold shrink-0',
              'flex items-center gap-1.5 transition-all active:scale-95',
              cuentaActiva
                ? 'bg-primario text-white border-primario'
                : 'bg-white text-texto border-borde hover:border-primario/40',
            ].join(' ')}
            title="Cuentas abiertas"
          >
            <ClipboardList size={17} />
            <span className="hidden sm:inline">
              {cuentaActiva ? cuentaActiva.nombre : 'Cuentas'}
            </span>
            {/* Badge con cantidad de cuentas abiertas */}
            {!cuentaActiva && cantidadCuentas > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-acento text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {cantidadCuentas}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Banner de cuenta activa */}
      {cuentaActiva && (
        <div className="bg-primario/8 border-b border-primario/20 px-3 py-1.5 flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-primario flex-1">
            📋 Cuenta activa: <span className="font-bold">{cuentaActiva.nombre}</span>
            {items.length > 0 && (
              <span className="ml-2 text-primario/70">
                · {formatCOP(total)}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={handleSalirCuenta}
            className="text-xs text-suave hover:text-peligro font-medium transition-colors"
          >
            Salir
          </button>
        </div>
      )}

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
            {emojiCarrito
              ? <span className="text-base leading-none">{emojiCarrito}</span>
              : <ShoppingCart size={16} className="text-primario" />}
            <span className="text-xs font-semibold text-suave uppercase tracking-wide flex-1 whitespace-normal break-words leading-tight">
              {labelCarrito}
            </span>
            {cuentaActiva && (
              <button
                type="button"
                onClick={handleSalirCuenta}
                className="text-[10px] text-suave hover:text-peligro font-semibold transition-colors"
              >
                ✕ Salir
              </button>
            )}
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
        className={[
          'md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-30',
          'flex items-center gap-2 px-5 h-14 rounded-full',
          'shadow-lg font-display font-bold text-base active:scale-95 transition-all',
          cuentaActiva
            ? 'bg-primario text-white shadow-primario/40'
            : 'bg-primario text-white shadow-primario/40',
        ].join(' ')}
      >
        {cuentaActiva ? <ClipboardList size={20} /> : <ShoppingCart size={20} />}
        {conteo > 0
          ? `${Math.round(conteo)} item${Math.round(conteo) !== 1 ? 's' : ''} · ${formatCOP(total)}`
          : cuentaActiva ? cuentaActiva.nombre : 'Ver carrito'}
      </button>

      {/* ── Drawer de carrito — solo móvil ───────────────────────────── */}
      {drawerAbierto && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setDrawerAbierto(false)}
          />

          <div className="md:hidden fixed inset-x-0 bottom-0 z-50
                          flex flex-col bg-white rounded-t-2xl
                          max-h-[82vh] shadow-2xl">

            <div className="flex items-center justify-between px-4 py-3 border-b border-borde shrink-0">
              <div className="flex items-center gap-2">
                {emojiCarrito
                  ? <span className="text-lg leading-none">{emojiCarrito}</span>
                  : <ShoppingCart size={18} className="text-primario" />}
                <span className="font-semibold text-texto whitespace-normal break-words leading-tight max-w-[180px]">
                  {labelCarrito}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {cuentaActiva && (
                  <button
                    type="button"
                    onClick={() => { setDrawerAbierto(false); handleSalirCuenta() }}
                    className="text-xs text-suave hover:text-peligro font-semibold"
                  >
                    Salir de cuenta
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrawerAbierto(false)}
                  className="p-2 rounded-full hover:bg-fondo text-suave active:scale-95 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-1 min-h-0">
              {listaItems}
            </div>

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
        <ModalCobro
          onClose={() => setMostrarModal(false)}
          onVentaExitosa={handleVentaExitosa}
        />
      )}

      {/* ── Panel de cuentas abiertas ─────────────────────────────────── */}
      {mostrarCuentas && (
        <CuentasPanel
          cuentaActivaId={cuentaActiva?.id ?? null}
          sesionCajaId={sesion?.id}
          onSeleccionarCuenta={handleSeleccionarCuenta}
          onClose={() => setMostrarCuentas(false)}
        />
      )}
    </div>
  )
}
