import { useState, useMemo } from 'react'
import {
  X, Search, ChevronDown, CheckCircle2, XCircle, Ban,
  ShoppingBag, Banknote, Smartphone, BookOpen, CreditCard, Clock, FileText,
} from 'lucide-react'
import { formatCOP, parsearEntero } from '../utils/moneda'
import { useAuthStore } from '../stores/authStore'
import {
  useVentasPeriodo,
  anularVenta,
  marcarTransferenciaVerificada,
  rangoPeriodo,
  type VentaConDetalles,
  type PeriodoHistorial,
} from '../hooks/useVentas'
import type { Venta } from '../db/schema'
import { ModalNotaVenta } from '../components/pos/ModalNotaVenta'
import { obtenerConsecutivoParaVenta } from '../components/pos/ModalNotaVenta'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function etiquetaTipoPago(venta: Venta): string {
  if (venta.tipoPago === 'transferencia') return venta.notas ?? 'Transferencia'
  if (venta.tipoPago === 'tarjeta') {
    return venta.subtipoTarjeta === 'debito' ? 'T. Débito' : 'T. Crédito'
  }
  const labels: Record<string, string> = {
    efectivo: 'Efectivo',
    fiado: 'Fiado',
    mixto: 'Mixto',
  }
  return labels[venta.tipoPago] ?? venta.tipoPago
}

function iconoPago(tipoPago: string) {
  if (tipoPago === 'efectivo') return <Banknote size={13} className="text-exito" />
  if (tipoPago === 'fiado') return <BookOpen size={13} className="text-fiado" />
  if (tipoPago === 'transferencia') return <Smartphone size={13} className="text-primario" />
  if (tipoPago === 'tarjeta') return <CreditCard size={13} className="text-texto" />
  return <Banknote size={13} className="text-suave" />
}

const PERIODOS: { id: PeriodoHistorial; label: string }[] = [
  { id: 'hoy',    label: 'Hoy'         },
  { id: 'ayer',   label: 'Ayer'        },
  { id: 'semana', label: '7 días'      },
  { id: 'mes',    label: 'Este mes'    },
]

// ─── Modal de confirmación de anulación ───────────────────────────────────────

function ModalConfirmarAnulacion({
  venta,
  onConfirmar,
  onCancelar,
  anulando,
}: {
  venta: Venta & { id: number }
  onConfirmar: (motivo: string) => void
  onCancelar: () => void
  anulando: boolean
}) {
  const [motivo, setMotivo] = useState('')
  const motivoValido = motivo.trim().length >= 10

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 bg-peligro/10 rounded-full flex items-center justify-center">
            <Ban size={28} className="text-peligro" />
          </div>
          <p className="font-display font-bold text-lg text-texto">¿Anular esta venta?</p>
          <p className="text-suave text-sm leading-snug">
            Venta de{' '}
            <span className="moneda font-bold text-texto">{formatCOP(venta.total)}</span>
            {' '}— esta acción no se puede deshacer.
            {venta.tipoPago === 'fiado' && (
              <span className="block mt-1 text-fiado font-medium">
                Se revertirá el cargo en la cuenta del cliente.
              </span>
            )}
          </p>
        </div>

        {/* Motivo de anulación — obligatorio */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-texto">
            Motivo de anulación <span className="text-peligro">*</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Cliente canceló el pedido, error en el precio cobrado…"
            rows={3}
            className={[
              'w-full px-3 py-2.5 border rounded-xl text-sm text-texto placeholder:text-suave',
              'focus:outline-none focus:ring-2 resize-none',
              motivo.length > 0 && !motivoValido
                ? 'border-peligro/50 focus:ring-peligro/30'
                : 'border-borde focus:ring-primario/30 focus:border-primario/50',
            ].join(' ')}
          />
          {motivo.length > 0 && !motivoValido && (
            <p className="text-xs text-peligro">
              Mínimo 10 caracteres ({motivo.trim().length}/10)
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={anulando}
            className="flex-1 h-11 border border-borde text-texto rounded-xl font-semibold text-sm
                       hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => motivoValido && onConfirmar(motivo.trim())}
            disabled={anulando || !motivoValido}
            className="flex-1 h-11 bg-peligro text-white rounded-xl font-semibold text-sm
                       hover:bg-peligro/90 active:scale-95 transition-all disabled:opacity-50
                       flex items-center justify-center gap-2"
          >
            {anulando ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Ban size={15} />
                Anular venta
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de detalle de venta ────────────────────────────────────────────────

function ModalDetalleVenta({
  item,
  esDueno,
  onClose,
  onAnulada,
}: {
  item: VentaConDetalles
  esDueno: boolean
  onClose: () => void
  onAnulada: () => void
}) {
  const usuario = useAuthStore((s) => s.usuario)
  const { venta, detalles, nombreCliente } = item
  const [confirmarAnular, setConfirmarAnular] = useState(false)
  const [anulando, setAnulando] = useState(false)
  const [errorAnular, setErrorAnular] = useState<string | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [mostrarNota, setMostrarNota] = useState(false)
  const [consecutivoNota, setConsecutivoNota] = useState<string | undefined>(undefined)

  const handleAnular = async (motivo: string) => {
    setAnulando(true)
    try {
      await anularVenta(
        venta.id,
        motivo,
        usuario?.nombre ?? 'Sin sesión',
        usuario?.rol ?? 'desconocido',
      )
      onAnulada()
      onClose()
    } catch (err) {
      setErrorAnular(err instanceof Error ? err.message : 'Error al anular')
      setAnulando(false)
      setConfirmarAnular(false)
    }
  }

  const handleMarcarVerificado = async () => {
    setVerificando(true)
    try {
      await marcarTransferenciaVerificada(venta.id)
      onClose()
    } finally {
      setVerificando(false)
    }
  }

  const handleVerNota = async () => {
    if (!venta.id) return
    // Genera el consecutivo estable basado en el id (no incrementa el contador)
    const cod = await obtenerConsecutivoParaVenta(venta.id)
    setConsecutivoNota(cod)
    setMostrarNota(true)
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
        <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-borde shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display font-bold text-base text-texto">
                  Venta #{venta.id}
                </p>
                {venta.estado === 'anulada' ? (
                  <span className="px-2 py-0.5 bg-peligro/10 text-peligro text-[10px] font-bold rounded-full uppercase tracking-wide">
                    Anulada
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-exito/10 text-exito text-[10px] font-bold rounded-full uppercase tracking-wide">
                    Completada
                  </span>
                )}
              </div>
              <p className="text-xs text-suave mt-0.5">
                {venta.creadaEn.toLocaleDateString('es-CO', {
                  weekday: 'short', day: 'numeric', month: 'short',
                })}
                {' · '}
                {venta.creadaEn.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </p>
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

          {/* Contenido scrollable */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

            {/* Tipo de pago + cliente */}
            <div className="flex items-center gap-3 p-3 bg-fondo rounded-xl border border-borde">
              {iconoPago(venta.tipoPago)}
              <span className="text-sm font-medium text-texto">{etiquetaTipoPago(venta)}</span>
              {nombreCliente && (
                <>
                  <span className="text-suave/50">·</span>
                  <BookOpen size={12} className="text-fiado" />
                  <span className="text-sm text-fiado font-medium">{nombreCliente}</span>
                </>
              )}
              {venta.tipoPago === 'efectivo' && venta.cambio !== undefined && venta.cambio > 0 && (
                <span className="ml-auto text-xs text-suave">
                  Cambio: <span className="moneda font-medium">{formatCOP(venta.cambio)}</span>
                </span>
              )}
            </div>

            {/* Lista de productos */}
            <div className="bg-white border border-borde rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-borde/50">
                <p className="text-xs font-semibold text-suave uppercase tracking-wide">Productos</p>
              </div>
              {detalles.length === 0 ? (
                <p className="px-3 py-4 text-sm text-suave text-center">Sin detalles</p>
              ) : (
                <div className="divide-y divide-borde/30">
                  {detalles.map((d, i) => (
                    <div key={d.id ?? i} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-texto truncate">
                          {d.esProductoFantasma && <span className="text-xs text-advertencia mr-1">👻</span>}
                          {d.nombreProducto}
                        </p>
                        <p className="text-xs text-suave">
                          {d.cantidad} × {formatCOP(d.precioUnitario)}
                        </p>
                      </div>
                      <span className="moneda text-sm font-medium text-texto shrink-0">
                        {formatCOP(d.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between px-4 py-3 bg-primario/5 border border-primario/20 rounded-xl">
              <span className="text-sm font-semibold text-texto">Total</span>
              <span className="moneda font-bold text-xl text-primario">{formatCOP(venta.total)}</span>
            </div>

            {/* Error de anulación */}
            {errorAnular && (
              <div className="px-3 py-2 bg-peligro/10 border border-peligro/30 rounded-xl">
                <p className="text-xs text-peligro font-medium">{errorAnular}</p>
              </div>
            )}
          </div>

          {/* Footer — botones de acción */}
          <div className="p-4 border-t border-borde shrink-0 flex flex-col gap-2">

            {/* Botón verificar transferencia — solo si está pendiente */}
            {venta.tipoPago === 'transferencia' && venta.estadoPago === 'pendiente_verificacion' && venta.estado === 'completada' && (
              <button
                type="button"
                onClick={handleMarcarVerificado}
                disabled={verificando}
                className="w-full h-11 bg-exito/10 text-exito border border-exito/30
                           rounded-xl font-semibold text-sm flex items-center justify-center gap-2
                           hover:bg-exito/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {verificando
                  ? <div className="w-4 h-4 border-2 border-exito border-t-transparent rounded-full animate-spin" />
                  : '✅ Marcar como recibido'
                }
              </button>
            )}

            {/* Botón nota de venta — siempre visible */}
            <button
              type="button"
              onClick={handleVerNota}
              className="w-full h-11 bg-primario/8 text-primario border border-primario/25
                         rounded-xl font-semibold text-sm flex items-center justify-center gap-2
                         hover:bg-primario/12 active:scale-95 transition-all"
            >
              <FileText size={15} />
              📄 Nota de venta
            </button>

            {/* Botón anular — cualquier rol en ventas completadas; queda registrado en auditoría */}
            {venta.estado === 'completada' && (
              <button
                type="button"
                onClick={() => setConfirmarAnular(true)}
                className="w-full h-11 border-2 border-peligro/40 text-peligro rounded-xl
                           font-semibold text-sm flex items-center justify-center gap-2
                           hover:bg-peligro/5 active:scale-95 transition-all"
              >
                <Ban size={16} />
                Anular venta
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmarAnular && (
        <ModalConfirmarAnulacion
          venta={venta}
          onConfirmar={handleAnular}
          onCancelar={() => setConfirmarAnular(false)}
          anulando={anulando}
        />
      )}

      {mostrarNota && (
        <ModalNotaVenta
          venta={venta}
          detalles={detalles}
          nombreCliente={nombreCliente}
          consecutivoExistente={consecutivoNota}
          onClose={() => setMostrarNota(false)}
        />
      )}
    </>
  )
}

// ─── Fila de venta ────────────────────────────────────────────────────────────

function FilaVenta({ item, onClick }: { item: VentaConDetalles; onClick: () => void }) {
  const { venta, detalles, nombreCliente } = item
  const anulada = venta.estado === 'anulada'

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-fondo active:bg-fondo',
        anulada ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Icono método de pago */}
      <div className={[
        'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
        anulada ? 'bg-peligro/10' : 'bg-primario/10',
      ].join(' ')}>
        {anulada
          ? <XCircle size={16} className="text-peligro" />
          : iconoPago(venta.tipoPago)
        }
      </div>

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-texto truncate">
            {detalles.length > 0
              ? detalles.map((d) => d.nombreProducto).join(', ')
              : `${venta.tipoPago}`
            }
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-suave flex items-center gap-1">
            <Clock size={10} />
            {venta.creadaEn.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-xs text-suave">·</span>
          <span className="text-xs text-suave flex items-center gap-1">
            {iconoPago(venta.tipoPago)}
            {etiquetaTipoPago(venta)}
          </span>
          {nombreCliente && (
            <>
              <span className="text-xs text-suave">·</span>
              <span className="text-xs text-fiado font-medium">{nombreCliente}</span>
            </>
          )}
          {anulada && (
            <span className="text-[10px] font-bold text-peligro bg-peligro/10 px-1.5 py-0.5 rounded-full uppercase">
              Anulada
            </span>
          )}
          {!anulada && venta.tipoPago === 'transferencia' && venta.estadoPago === 'pendiente_verificacion' && (
            <span className="text-[10px] font-bold text-advertencia bg-advertencia/10 px-1.5 py-0.5 rounded-full">
              ⏳ Por verificar
            </span>
          )}
        </div>
      </div>

      {/* Total + flecha */}
      <div className="text-right shrink-0">
        <p className={`moneda font-bold text-sm ${anulada ? 'line-through text-suave' : 'text-texto'}`}>
          {formatCOP(venta.total)}
        </p>
        <p className="text-[10px] text-suave mt-0.5">
          {detalles.length} prod.
        </p>
      </div>
      <ChevronDown size={14} className="text-suave -rotate-90 shrink-0" />
    </button>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function HistorialVentasPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const esDueno = !usuario || usuario.rol === 'dueno'

  const [periodo, setPeriodo] = useState<PeriodoHistorial>('hoy')
  const [query, setQuery] = useState('')
  const [ventaDetalle, setVentaDetalle] = useState<VentaConDetalles | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)  // forzar re-render tras anulación

  const { inicio, fin } = useMemo(() => rangoPeriodo(periodo), [periodo, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const ventas = useVentasPeriodo(inicio, fin)

  // Filtrar por búsqueda: nombre cliente o monto
  const ventasFiltradas = useMemo(() => {
    if (!ventas) return undefined
    if (!query.trim()) return ventas

    const lower = query.toLowerCase().trim()
    const montoQuery = parsearEntero(query.replace(/\D/g, ''))

    return ventas.filter((item) => {
      // Por cliente
      if (item.nombreCliente?.toLowerCase().includes(lower)) return true
      // Por monto exacto o parcial
      if (montoQuery > 0 && String(item.venta.total).includes(String(montoQuery))) return true
      // Por nombre de producto
      if (item.detalles.some((d) => d.nombreProducto.toLowerCase().includes(lower))) return true
      return false
    })
  }, [ventas, query])

  // Métricas del período
  const metricas = useMemo(() => {
    if (!ventas) return null
    const completadas = ventas.filter((v) => v.venta.estado === 'completada')
    const anuladas = ventas.filter((v) => v.venta.estado === 'anulada')
    return {
      totalCompletadas: completadas.reduce((s, v) => s + v.venta.total, 0),
      cantidadCompletadas: completadas.length,
      totalAnuladas: anuladas.reduce((s, v) => s + v.venta.total, 0),
      cantidadAnuladas: anuladas.length,
    }
  }, [ventas])

  return (
    <div className="h-full flex flex-col bg-fondo overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">

          {/* Filtros de período */}
          <div className="flex gap-1.5 bg-white rounded-xl border border-borde p-1.5">
            {PERIODOS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPeriodo(id)}
                className={[
                  'flex-1 h-9 rounded-lg text-sm font-semibold transition-all',
                  periodo === id
                    ? 'bg-primario text-white shadow-sm'
                    : 'text-suave hover:text-texto',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Buscador */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por cliente, producto o monto…"
              className="w-full h-11 pl-9 pr-4 bg-white border border-borde rounded-xl text-sm text-texto
                         placeholder:text-suave focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario/50"
            />
          </div>

          {/* Métricas resumen */}
          {metricas && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-borde p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={14} className="text-exito" />
                  <span className="text-xs text-suave font-medium">Completadas</span>
                </div>
                <p className="moneda font-bold text-lg text-texto">{formatCOP(metricas.totalCompletadas)}</p>
                <p className="text-xs text-suave">{metricas.cantidadCompletadas} venta{metricas.cantidadCompletadas !== 1 ? 's' : ''}</p>
              </div>
              <div className={[
                'rounded-xl border p-3',
                metricas.cantidadAnuladas > 0 ? 'bg-peligro/5 border-peligro/20' : 'bg-white border-borde',
              ].join(' ')}>
                <div className="flex items-center gap-2 mb-1">
                  <XCircle size={14} className={metricas.cantidadAnuladas > 0 ? 'text-peligro' : 'text-suave'} />
                  <span className="text-xs text-suave font-medium">Anuladas</span>
                </div>
                <p className={`moneda font-bold text-lg ${metricas.cantidadAnuladas > 0 ? 'text-peligro' : 'text-suave'}`}>
                  {metricas.cantidadAnuladas > 0 ? `-${formatCOP(metricas.totalAnuladas)}` : '$0'}
                </p>
                <p className="text-xs text-suave">{metricas.cantidadAnuladas} venta{metricas.cantidadAnuladas !== 1 ? 's' : ''}</p>
              </div>
            </div>
          )}

          {/* Lista de ventas */}
          <div className="bg-white rounded-xl border border-borde overflow-hidden">
            <div className="px-4 py-3 border-b border-borde/50 flex items-center gap-2">
              <ShoppingBag size={16} className="text-primario" />
              <span className="text-sm font-semibold text-texto">
                {ventasFiltradas ? `${ventasFiltradas.length} venta${ventasFiltradas.length !== 1 ? 's' : ''}` : 'Ventas'}
              </span>
              {query && (
                <span className="text-xs text-suave ml-auto">
                  Filtrado por "{query}"
                </span>
              )}
            </div>

            {!ventasFiltradas ? (
              <div className="flex justify-center p-8">
                <div className="w-6 h-6 border-2 border-primario/30 border-t-primario rounded-full animate-spin" />
              </div>
            ) : ventasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <ShoppingBag size={32} className="text-suave/40" />
                <p className="text-sm text-suave">
                  {query ? 'No se encontraron ventas con ese criterio' : 'No hay ventas en este período'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-borde/30">
                {ventasFiltradas.map((item) => (
                  <FilaVenta
                    key={item.venta.id}
                    item={item}
                    onClick={() => setVentaDetalle(item)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="h-4" />
        </div>
      </div>

      {ventaDetalle && (
        <ModalDetalleVenta
          item={ventaDetalle}
          esDueno={esDueno}
          onClose={() => setVentaDetalle(null)}
          onAnulada={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  )
}
