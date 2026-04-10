import { useState, useCallback } from 'react'
import { X, Package, DollarSign, AlertTriangle, AlertCircle } from 'lucide-react'
import type { Producto } from '../../db/schema'
import { TecladoNumerico } from '../shared/TecladoNumerico'
import { formatCOP, parsearEntero } from '../../utils/moneda'
import { useVentaStore } from '../../stores/ventaStore'

// ── Tipos ────────────────────────────────────────────────────────────────────

type Modo = 'cantidad' | 'valor'

interface Props {
  producto: Producto
  onClose: () => void
}

// ── Etiquetas por unidad ──────────────────────────────────────────────────────

function etiquetaUnidad(unidad: Producto['unidad']): string {
  switch (unidad) {
    case 'gramo':     return 'g'
    case 'mililitro': return 'ml'
    case 'porcion':   return 'porción'
    default:          return 'u'
  }
}

// ── Precio por unidad (precio del producto está dado en su unidad base) ───────
// El producto tiene: precio = precio por la cantidad base del producto
// Necesitamos: precio por 1 gramo/ml/porción
// Asumimos que producto.precio es el precio POR 1 unidad (1g / 1ml / 1 porción)
// según como están definidos en el seed del proyecto.
function precioPorUnidad(producto: Producto): number {
  // precio ya es por unidad base (ej: $40 por gramo, $20 por ml, etc.)
  return producto.precio
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ModalCantidadProducto({ producto, onClose }: Props) {
  const agregarItem = useVentaStore((s) => s.agregarItem)

  const [modo, setModo] = useState<Modo>('cantidad')
  // Modo cantidad: gramos/ml/porciones directos
  const [valorCantidad, setValorCantidad] = useState('')
  // Modo valor: pesos que quiere pagar el cliente
  const [valorPesos, setValorPesos] = useState('')

  const etiqueta = etiquetaUnidad(producto.unidad)
  const pxU = precioPorUnidad(producto)   // precio por 1g / 1ml / 1 porción

  // ── Cálculos en tiempo real ──────────────────────────────────────────────────

  // Modo cantidad → cuántos gramos/ml va a recibir
  const cantidadNumero = parsearEntero(valorCantidad)
  const subtotalCantidad = cantidadNumero * pxU

  // Modo valor → cuántos gramos/ml resultan del monto ingresado
  const pesosNumero = parsearEntero(valorPesos)
  // pxU podría ser 0 si el producto no tiene precio configurado
  const gramosCalculados = pxU > 0 ? pesosNumero / pxU : 0
  // Redondear a 2 decimales para display, pero guardar el exacto
  const gramosDisplay = gramosCalculados < 1 && gramosCalculados > 0
    ? gramosCalculados.toFixed(3)
    : gramosCalculados.toFixed(2)

  // ── Validaciones ─────────────────────────────────────────────────────────────

  const errorMenorA1 = modo === 'valor' && pesosNumero > 0 && gramosCalculados < 1
  const stockInsuficiente =
    producto.stockActual !== undefined &&
    producto.stockActual !== null && (
      modo === 'cantidad'
        ? cantidadNumero > producto.stockActual
        : gramosCalculados > producto.stockActual
    )

  // ── Confirmar y agregar al carrito ───────────────────────────────────────────

  const confirmar = useCallback(() => {
    if (modo === 'cantidad') {
      if (cantidadNumero < 1) return
      agregarItem({
        productoId:        producto.id,
        nombreProducto:    producto.nombre,
        cantidad:          cantidadNumero,
        precioUnitario:    pxU,
        descuento:         0,
        esProductoFantasma: false,
      })
    } else {
      // Modo valor
      if (pesosNumero <= 0 || gramosCalculados < 1) return
      // subtotal = valor exacto ingresado por el cliente
      // cantidad = gramos calculados (puede ser decimal)
      // precioUnitario = precio por gramo
      agregarItem({
        productoId:        producto.id,
        nombreProducto:    producto.nombre,
        cantidad:          Math.round(gramosCalculados * 100) / 100, // 2 decimales
        precioUnitario:    pxU,
        descuento:         0,
        esProductoFantasma: false,
      })
    }
    onClose()
  }, [modo, cantidadNumero, pesosNumero, gramosCalculados, pxU, producto, agregarItem, onClose])

  // ── UI ────────────────────────────────────────────────────────────────────────

  const puedeConfirmar =
    modo === 'cantidad'
      ? cantidadNumero >= 1
      : pesosNumero > 0 && !errorMenorA1

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={`Agregar ${producto.nombre} al carrito`}
    >
      <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-lg font-bold text-texto leading-tight">{producto.nombre}</h2>
            <p className="text-sm text-suave mt-0.5">
              {formatCOP(pxU)}/{etiqueta}
              {producto.stockActual !== undefined && producto.stockActual !== null && (
                <span className="ml-2 text-xs">
                  · Stock: <strong>{producto.stockActual}{etiqueta}</strong>
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full
                       text-suave hover:text-texto hover:bg-gray-100 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toggle modo */}
        <div className="px-5 pb-4">
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              id="btn-modo-cantidad"
              type="button"
              onClick={() => { setModo('cantidad'); setValorPesos('') }}
              className={[
                'flex-1 flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-semibold transition-all',
                modo === 'cantidad'
                  ? 'bg-white text-primario shadow-sm'
                  : 'text-suave hover:text-texto',
              ].join(' ')}
            >
              <Package size={15} />
              Por cantidad
            </button>
            <button
              id="btn-modo-valor"
              type="button"
              onClick={() => { setModo('valor'); setValorCantidad('') }}
              className={[
                'flex-1 flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-semibold transition-all',
                modo === 'valor'
                  ? 'bg-white text-acento shadow-sm'
                  : 'text-suave hover:text-texto',
              ].join(' ')}
            >
              <DollarSign size={15} />
              Por valor
            </button>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-4">

          {/* ── MODO CANTIDAD ── */}
          {modo === 'cantidad' && (
            <>
              <div className="text-center">
                <p className="text-sm text-suave mb-1">¿Cuántos {etiqueta} desea?</p>
                <div
                  className={[
                    'inline-block min-w-[140px] px-6 py-3 rounded-2xl text-4xl font-display font-bold moneda',
                    cantidadNumero > 0 ? 'bg-primario/10 text-primario' : 'bg-gray-100 text-suave',
                  ].join(' ')}
                >
                  {cantidadNumero > 0 ? cantidadNumero : '0'}{' '}
                  <span className="text-xl">{etiqueta}</span>
                </div>
                {cantidadNumero > 0 && (
                  <p className="text-sm text-suave mt-2">
                    Subtotal: <strong className="text-texto moneda">{formatCOP(subtotalCantidad)}</strong>
                  </p>
                )}
              </div>
              <TecladoNumerico valor={valorCantidad} onChange={setValorCantidad} />
            </>
          )}

          {/* ── MODO VALOR ── */}
          {modo === 'valor' && (
            <>
              <div className="text-center">
                <p className="text-sm text-suave mb-1">¿Cuánto dinero quiere el cliente?</p>
                <div
                  className={[
                    'inline-block min-w-[160px] px-6 py-3 rounded-2xl text-4xl font-display font-bold moneda',
                    pesosNumero > 0 ? 'bg-acento/10 text-acento' : 'bg-gray-100 text-suave',
                  ].join(' ')}
                >
                  {pesosNumero > 0 ? formatCOP(pesosNumero) : '$0'}
                </div>
              </div>

              <TecladoNumerico valor={valorPesos} onChange={setValorPesos} />

              {/* Resultado del cálculo inverso */}
              {pesosNumero > 0 && !errorMenorA1 && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <span className="text-2xl">→</span>
                  <div>
                    <p className="text-2xl font-display font-bold text-exito moneda">
                      {gramosDisplay} {etiqueta}
                    </p>
                    <p className="text-xs text-suave">
                      de {producto.nombre}
                    </p>
                  </div>
                </div>
              )}

              {/* Error: menos de 1 unidad */}
              {errorMenorA1 && (
                <div className="flex items-center gap-2 bg-red-50 border border-peligro/30 rounded-xl px-4 py-3">
                  <AlertCircle size={18} className="text-peligro shrink-0" />
                  <p className="text-sm text-peligro font-medium">
                    El valor ingresado equivale a menos de 1{etiqueta}.<br />
                    Ingrese un monto mayor.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Advertencia de stock (no bloquea) */}
          {stockInsuficiente && !errorMenorA1 && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-advertencia/40 rounded-xl px-4 py-3">
              <AlertTriangle size={17} className="text-advertencia shrink-0" />
              <p className="text-sm text-advertencia font-medium">
                Stock insuficiente (disponible:{' '}
                <strong>{producto.stockActual}{etiqueta}</strong>).
                El tendero decide si continuar.
              </p>
            </div>
          )}

          {/* Botón confirmar */}
          <button
            id="btn-agregar-carrito-peso"
            type="button"
            onClick={confirmar}
            disabled={!puedeConfirmar}
            className={[
              'w-full h-[60px] rounded-2xl text-white text-lg font-bold font-display',
              'transition-all active:scale-[0.97]',
              puedeConfirmar
                ? 'bg-primario hover:bg-primario-hover shadow-md'
                : 'bg-gray-300 cursor-not-allowed',
            ].join(' ')}
          >
            Agregar al carrito
          </button>
        </div>
      </div>
    </div>
  )
}
