import { useState } from 'react'
import { ArrowLeft, Plus, Banknote, ChevronDown, Truck } from 'lucide-react'
import {
  useCuentaProveedor,
  registrarPagoProveedor,
  type CompraConDetalles,
} from '../../hooks/useProveedores'
import { useSesionActual } from '../../hooks/useCaja'
import { TecladoNumerico } from '../shared/TecladoNumerico'
import { formatCOP, parsearEntero } from '../../utils/moneda'
import type { PagoProveedor } from '../../db/schema'

// ─── Props ────────────────────────────────────────────────────────────────────

interface CuentaProveedorProps {
  proveedorId: number
  onBack: () => void
  onNuevaCompra: (pv: { id: number; nombre: string }) => void
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function CuentaProveedor({ proveedorId, onBack, onNuevaCompra }: CuentaProveedorProps) {
  const datos = useCuentaProveedor(proveedorId)
  const sesion = useSesionActual()

  const [pagoAbierto, setPagoAbierto] = useState(false)
  const [montoPago, setMontoPago] = useState('')
  const [compraIdPago, setCompraIdPago] = useState<number | undefined>()
  const [guardando, setGuardando] = useState(false)

  const handlePago = async () => {
    if (!datos || datos === null || guardando) return
    const monto = parsearEntero(montoPago)
    if (monto <= 0) return
    setGuardando(true)
    try {
      await registrarPagoProveedor(
        proveedorId,
        monto,
        compraIdPago,
        sesion?.id,
      )
      setMontoPago('')
      setCompraIdPago(undefined)
      setPagoAbierto(false)
    } finally {
      setGuardando(false)
    }
  }

  // ── Vista: cargando ────────────────────────────────────────────────────────

  if (datos === undefined) {
    return (
      <div className="h-full flex items-center justify-center bg-fondo">
        <div className="w-8 h-8 border-4 border-primario/30 border-t-primario rounded-full animate-spin" />
      </div>
    )
  }

  if (datos === null) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-fondo">
        <p className="text-suave">Proveedor no encontrado</p>
        <button type="button" onClick={onBack}
          className="h-10 px-4 bg-primario text-white rounded-xl text-sm font-semibold">
          Volver
        </button>
      </div>
    )
  }

  const { proveedor, compras, pagos } = datos

  // Timeline interleado: compras y pagos ordenados por fecha descendente
  type EventoTL =
    | { tipo: 'compra'; fecha: Date; data: CompraConDetalles }
    | { tipo: 'pago'; fecha: Date; data: PagoProveedor }

  const timeline: EventoTL[] = [
    ...compras.map((c) => ({ tipo: 'compra' as const, fecha: c.creadaEn, data: c })),
    ...pagos.map((p) => ({ tipo: 'pago' as const, fecha: p.creadoEn, data: p })),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime())

  const comprasPendientes = compras.filter((c) => c.saldo > 0)
  const montoPagoNum = parsearEntero(montoPago)

  return (
    <div className="h-full flex flex-col bg-fondo overflow-hidden">

      {/* Header */}
      <div className="bg-white border-b border-borde px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-suave
                     hover:text-texto hover:bg-fondo transition-colors shrink-0"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-texto truncate">{proveedor.nombre}</h2>
          <p className="text-xs text-suave">
            {[proveedor.contacto, proveedor.diasVisita].filter(Boolean).join(' · ') || 'Sin días de visita'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNuevaCompra({ id: proveedor.id!, nombre: proveedor.nombre })}
          className="h-9 px-3 bg-primario text-white rounded-lg text-xs font-semibold
                     flex items-center gap-1.5 hover:bg-primario-hover transition-colors shrink-0"
        >
          <Plus size={14} />
          Compra
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">

          {/* Saldo total */}
          <div className={[
            'rounded-xl border p-4 flex items-center justify-between',
            proveedor.saldoPendiente > 0
              ? 'bg-red-50 border-red-200'
              : 'bg-exito/5 border-exito/20',
          ].join(' ')}>
            <div>
              <p className="text-xs text-suave mb-0.5">Saldo pendiente</p>
              <p className={`moneda font-bold text-2xl ${proveedor.saldoPendiente > 0 ? 'text-peligro' : 'text-exito'}`}>
                {formatCOP(proveedor.saldoPendiente)}
              </p>
              {proveedor.telefono && (
                <p className="text-xs text-suave mt-1">📞 {proveedor.telefono}</p>
              )}
            </div>
            <span className="text-3xl">
              {proveedor.saldoPendiente > 0 ? '💸' : '✅'}
            </span>
          </div>

          {/* Registrar pago */}
          {proveedor.saldoPendiente > 0 && (
            <div className="bg-white rounded-xl border border-borde overflow-hidden">
              <button
                type="button"
                onClick={() => setPagoAbierto((v) => !v)}
                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-fondo transition-colors"
              >
                <Banknote size={16} className="text-exito" />
                <span className="text-sm font-semibold text-texto flex-1 text-left">
                  Registrar pago
                </span>
                <ChevronDown
                  size={16}
                  className={`text-suave transition-transform ${pagoAbierto ? 'rotate-180' : ''}`}
                />
              </button>

              {pagoAbierto && (
                <div className="border-t border-borde/50 p-4 flex flex-col gap-3">

                  {/* Seleccionar compra específica (solo si hay varias pendientes) */}
                  {comprasPendientes.length > 1 && (
                    <div>
                      <p className="text-xs text-suave mb-1.5">
                        Aplicar a compra específica (opcional)
                      </p>
                      <select
                        value={compraIdPago ?? ''}
                        onChange={(e) =>
                          setCompraIdPago(e.target.value ? Number(e.target.value) : undefined)
                        }
                        className="w-full h-10 px-3 border border-borde rounded-lg text-sm
                                   text-texto focus:outline-none focus:ring-2 focus:ring-primario/30"
                      >
                        <option value="">Abono general al saldo</option>
                        {comprasPendientes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.creadaEn.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                            {c.notas ? ` — ${c.notas}` : ''}
                            {' · Saldo '}
                            {formatCOP(c.saldo)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="text-center">
                    <p className="text-xs text-suave mb-1">Monto del pago</p>
                    <p className="moneda font-bold text-2xl text-texto">
                      {montoPago ? formatCOP(montoPagoNum) : '$0'}
                    </p>
                  </div>

                  <TecladoNumerico valor={montoPago} onChange={setMontoPago} />

                  <button
                    type="button"
                    onClick={handlePago}
                    disabled={!montoPago || montoPagoNum <= 0 || guardando}
                    className="h-12 bg-exito text-white rounded-xl font-display font-bold
                               hover:bg-exito/90 active:scale-95 transition-all
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {guardando
                      ? 'Guardando…'
                      : `Pagar ${montoPago ? formatCOP(montoPagoNum) : ''}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Historial de movimientos */}
          {timeline.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-suave/50">
              <span className="text-4xl">📋</span>
              <p className="text-sm">Sin movimientos registrados</p>
              <button
                type="button"
                onClick={() => onNuevaCompra({ id: proveedor.id!, nombre: proveedor.nombre })}
                className="text-primario text-sm font-semibold hover:underline"
              >
                Registrar primera compra
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-borde overflow-hidden">
              <div className="px-4 py-3 border-b border-borde/50 flex items-center gap-2">
                <Truck size={16} className="text-suave" />
                <span className="text-sm font-semibold text-texto">
                  Historial ({timeline.length})
                </span>
              </div>
              <div className="divide-y divide-borde/30">
                {timeline.map((evento) =>
                  evento.tipo === 'compra' ? (
                    <FilaCompra key={`c-${evento.data.id}`} compra={evento.data} />
                  ) : (
                    <FilaPago key={`p-${evento.data.id}`} pago={evento.data} />
                  )
                )}
              </div>
            </div>
          )}

          <div className="h-8" />
        </div>
      </div>
    </div>
  )
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function FilaCompra({ compra }: { compra: CompraConDetalles }) {
  const [expandida, setExpandida] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpandida((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-fondo/60 transition-colors text-left"
      >
        <div className={[
          'w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-base',
          compra.saldo > 0 ? 'bg-red-100' : 'bg-gray-100',
        ].join(' ')}>
          🛒
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-texto">
            Compra · {compra.detalles.length} ítem{compra.detalles.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-suave">
            {compra.creadaEn.toLocaleDateString('es-CO', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
            {compra.notas ? ` · ${compra.notas}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0 mr-1">
          <p className="moneda font-bold text-sm text-texto">{formatCOP(compra.total)}</p>
          {compra.saldo > 0 && (
            <p className="text-xs text-peligro font-medium">
              Debe {formatCOP(compra.saldo)}
            </p>
          )}
          {compra.saldo === 0 && (
            <p className="text-xs text-exito">Pagada</p>
          )}
        </div>
        <ChevronDown
          size={14}
          className={`text-suave transition-transform shrink-0 ${expandida ? 'rotate-180' : ''}`}
        />
      </button>

      {expandida && (
        <div className="px-4 pb-3 bg-fondo/50 border-t border-borde/20">
          <div className="flex flex-col gap-1.5 pt-2">
            {compra.detalles.map((d, i) => (
              <div key={i} className="flex items-center text-xs text-suave gap-2">
                <span className="flex-1 truncate">{d.nombreProducto}</span>
                <span className="shrink-0">
                  {d.cantidad % 1 === 0 ? d.cantidad : d.cantidad.toFixed(2)} ×{' '}
                  {formatCOP(d.precioUnitario)}
                </span>
                <span className="moneda font-medium text-texto shrink-0 w-20 text-right">
                  {formatCOP(d.subtotal)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1.5 mt-0.5 border-t border-borde/30">
              <span className="text-xs font-semibold text-suave">
                {compra.tipoPago === 'contado'
                  ? '✅ Contado'
                  : compra.tipoPago === 'credito'
                  ? '⏳ A crédito'
                  : '💰 Pago mixto'}
              </span>
              {compra.pagado > 0 && compra.saldo > 0 && (
                <span className="text-xs text-suave">
                  Pagado {formatCOP(compra.pagado)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilaPago({ pago }: { pago: PagoProveedor }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-9 h-9 rounded-full bg-exito/10 flex items-center justify-center shrink-0 text-base">
        💚
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-exito">Pago realizado</p>
        <p className="text-xs text-suave">
          {pago.creadoEn.toLocaleDateString('es-CO', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
          {pago.notas ? ` · ${pago.notas}` : ''}
        </p>
      </div>
      <span className="moneda font-bold text-sm text-exito shrink-0">
        -{formatCOP(pago.monto)}
      </span>
    </div>
  )
}
