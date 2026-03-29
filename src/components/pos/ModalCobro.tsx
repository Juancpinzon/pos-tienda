import { useState, useEffect } from 'react'
import { X, Banknote, BookOpen, Smartphone, CheckCircle2, AlertCircle, MessageCircle, ShoppingCart } from 'lucide-react'
import { db } from '../../db/database'
import { useVentaStore, selectTotal } from '../../stores/ventaStore'
import { TecladoNumerico } from '../shared/TecladoNumerico'
import { SelectorClienteFiado } from '../fiado/SelectorClienteFiado'
import type { ClienteFiado } from '../fiado/SelectorClienteFiado'
import { formatCOP, parsearEntero } from '../../utils/moneda'
import { generarRecibo, compartirPorWhatsApp } from '../../utils/impresion'
import { obtenerConfig } from '../../hooks/useConfig'
import { registrarSalida, verificarStockInsuficiente } from '../../hooks/useStock'
import type { Venta, DetalleVenta } from '../../db/schema'

type MetodoPago = 'efectivo' | 'fiado' | 'transferencia'
type EstadoModal = 'seleccion' | 'confirmando' | 'exito' | 'error'

interface ModalCobroProps {
  onClose: () => void
}

// Obtiene o crea una sesión de caja activa (NUNCA bloquea una venta)
async function obtenerSesionActiva(): Promise<number> {
  const sesion = await db.sesionCaja.where('estado').equals('abierta').first()
  if (sesion?.id) return sesion.id as number
  const id = await db.sesionCaja.add({
    montoApertura: 0,
    totalVentas: 0,
    totalEfectivo: 0,
    totalFiado: 0,
    totalGastos: 0,
    abiertaEn: new Date(),
    estado: 'abierta',
    notas: 'Sesión automática — abre la caja para registrar apertura',
  })
  return id as number
}

// ─── Tab Efectivo ─────────────────────────────────────────────────────────────

function TabEfectivo({
  total,
  billete,
  onBilleteChange,
}: {
  total: number
  billete: string
  onBilleteChange: (v: string) => void
}) {
  const recibido = parsearEntero(billete)
  const cambio = recibido - total

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="text-suave text-sm mb-1">Efectivo recibido</p>
        <p className="moneda font-bold text-total text-texto leading-none">
          {billete ? formatCOP(recibido) : '$0'}
        </p>
      </div>
      <TecladoNumerico valor={billete} onChange={onBilleteChange} />
      <div className={[
        'flex items-center justify-between rounded-xl p-3',
        cambio >= 0 ? 'bg-exito/10 border border-exito/30' : 'bg-red-50 border border-red-200',
      ].join(' ')}>
        <span className="text-sm font-semibold text-texto">Cambio</span>
        <span className={`moneda font-bold text-xl ${cambio >= 0 ? 'text-exito' : 'text-peligro'}`}>
          {cambio >= 0 ? formatCOP(cambio) : `—${formatCOP(Math.abs(cambio))}`}
        </span>
      </div>
    </div>
  )
}

// ─── Tab Fiado ────────────────────────────────────────────────────────────────

function TabFiado({
  clienteFiado,
  onClienteChange,
}: {
  clienteFiado: ClienteFiado | null
  onClienteChange: (v: ClienteFiado | null) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-fiado/10 border border-fiado/30 rounded-xl p-3 text-sm text-fiado font-medium">
        Se anotará la deuda. No se requiere cédula ni documentos.
      </div>
      <SelectorClienteFiado value={clienteFiado} onChange={onClienteChange} />
    </div>
  )
}

// ─── Tab Transferencia ────────────────────────────────────────────────────────

function TabTransferencia() {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <Smartphone size={48} className="text-primario" />
      <p className="text-center text-base text-texto font-medium">
        Confirma que recibiste la transferencia
        <br />
        <span className="text-suave text-sm">Nequi · Daviplata · Bancolombia</span>
      </p>
    </div>
  )
}

// ─── Pantalla de éxito ────────────────────────────────────────────────────────

function PantallaExito({
  venta,
  detalles,
  onNuevaVenta,
}: {
  venta: Venta
  detalles: DetalleVenta[]
  onNuevaVenta: () => void
}) {
  const [compartiendo, setCompartiendo] = useState(false)

  const handleCompartir = async () => {
    setCompartiendo(true)
    try {
      const config = await obtenerConfig()
      const texto = generarRecibo(venta, detalles, config)
      compartirPorWhatsApp(texto)
    } finally {
      setCompartiendo(false)
    }
  }

  const cambio = venta.cambio ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col items-center gap-0 overflow-hidden">

        {/* Banda verde de éxito */}
        <div className="w-full bg-exito py-6 flex flex-col items-center gap-2">
          <CheckCircle2 size={52} className="text-white" strokeWidth={1.5} />
          <p className="font-display font-bold text-2xl text-white">¡Cobrado!</p>
          <p className="moneda font-bold text-3xl text-white">{formatCOP(venta.total)}</p>
          {venta.tipoPago === 'efectivo' && cambio > 0 && (
            <p className="text-white/80 text-sm font-medium">
              Cambio: {formatCOP(cambio)}
            </p>
          )}
          {venta.tipoPago === 'fiado' && (
            <p className="text-white/80 text-sm font-medium">Anotado a fiado</p>
          )}
        </div>

        {/* Acciones */}
        <div className="w-full p-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleCompartir}
            disabled={compartiendo}
            className="w-full h-12 bg-[#25D366] text-white rounded-xl font-semibold
                       flex items-center justify-center gap-2
                       hover:opacity-90 active:scale-95 transition-all
                       disabled:opacity-50"
          >
            <MessageCircle size={18} />
            {compartiendo ? 'Generando recibo…' : 'Compartir recibo por WhatsApp'}
          </button>

          <button
            type="button"
            onClick={onNuevaVenta}
            className="w-full h-12 bg-primario text-white rounded-xl font-display font-bold text-base
                       flex items-center justify-center gap-2
                       hover:bg-primario-hover active:scale-95 transition-all"
          >
            <ShoppingCart size={18} />
            Nueva venta
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal principal ──────────────────────────────────────────────────────────

export function ModalCobro({ onClose }: ModalCobroProps) {
  const items = useVentaStore((s) => s.items)
  const total = useVentaStore(selectTotal)
  const limpiarCarrito = useVentaStore((s) => s.limpiarCarrito)

  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [billete, setBillete] = useState('')
  const [clienteFiado, setClienteFiado] = useState<ClienteFiado | null>(null)
  const [estado, setEstado] = useState<EstadoModal>('seleccion')
  const [mensajeError, setMensajeError] = useState('')

  // Advertencia de stock insuficiente (no bloqueante — el tendero siempre puede vender)
  const [alertasStock, setAlertasStock] = useState<Array<{ nombre: string; stockActual: number; faltante: number }>>([])

  // Para la pantalla de éxito necesitamos la venta guardada y sus detalles
  const [ventaGuardada, setVentaGuardada] = useState<Venta | null>(null)
  const [detallesGuardados, setDetallesGuardados] = useState<DetalleVenta[]>([])

  // Verificar stock cuando cambian los ítems
  useEffect(() => {
    if (items.length === 0) { setAlertasStock([]); return }
    verificarStockInsuficiente(
      items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad }))
    ).then(setAlertasStock).catch(() => setAlertasStock([]))
  }, [items])

  const puedeConfirmar = () => {
    if (estado === 'confirmando') return false
    if (metodo === 'efectivo') return parsearEntero(billete) >= total
    if (metodo === 'fiado') return (clienteFiado?.nombre?.trim()?.length ?? 0) >= 2
    return true
  }

  const confirmarVenta = async () => {
    setEstado('confirmando')
    try {
      const sesionCajaId = await obtenerSesionActiva()
      const ahora = new Date()

      // Snapshot de los detalles antes de limpiar el carrito
      const detallesSnapshot = items.map((item) => ({
        productoId: item.productoId,
        nombreProducto: item.nombreProducto,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        descuento: item.descuento,
        subtotal: item.subtotal,
        esProductoFantasma: item.esProductoFantasma,
      }))

      let ventaId!: number
      let clienteId: number | undefined = undefined

      await db.transaction(
        'rw',
        [db.ventas, db.detallesVenta, db.movimientosFiado, db.clientes],
        async () => {
          // Resolver cliente para fiado
          if (metodo === 'fiado' && clienteFiado) {
            if (clienteFiado.id !== undefined) {
              clienteId = clienteFiado.id
            } else {
              const id = await db.clientes.add({
                nombre: clienteFiado.nombre.trim(),
                totalDeuda: 0,
                activo: true,
                creadoEn: ahora,
              })
              clienteId = id as number
            }
          }

          // Guardar la venta
          const recibido = metodo === 'efectivo' ? parsearEntero(billete) : undefined
          ventaId = (await db.ventas.add({
            sesionCajaId,
            clienteId,
            subtotal: total,
            descuento: 0,
            total,
            tipoPago: metodo,
            efectivoRecibido: recibido,
            cambio: recibido !== undefined ? recibido - total : undefined,
            estado: 'completada',
            creadaEn: ahora,
          })) as number

          // Guardar detalles
          await db.detallesVenta.bulkAdd(
            detallesSnapshot.map((d) => ({ ...d, ventaId }))
          )

          // Fiado: registrar solo el movimiento de cargo dentro de la transacción.
          // La actualización de totalDeuda se hace FUERA con modify() para evitar
          // que db.clientes.get() retorne undefined cuando el cliente fue creado
          // fuera de esta transacción (por SelectorClienteFiado).
          if (metodo === 'fiado' && clienteId !== undefined) {
            await db.movimientosFiado.add({
              clienteId,
              ventaId,
              tipo: 'cargo',
              monto: total,
              descripcion: `Venta a fiado — ${items.length} producto(s)`,
              creadoEn: ahora,
              sesionCajaId,
            })
          }
        }
      )

      // Actualizar la deuda del cliente DESPUÉS de que la transacción hace commit.
      // modify() es atómico: lee, modifica y escribe en una sola operación,
      // garantizando que nunca se pierda un cargo aunque haya concurrencia.
      if (metodo === 'fiado' && clienteId !== undefined) {
        const montoDeuda = total // capturar antes de que limpiarCarrito() lo ponga en 0
        await db.clientes
          .where('id').equals(clienteId)
          .modify((c) => { c.totalDeuda = (c.totalDeuda ?? 0) + montoDeuda })
      }

      // Descontar stock para cada producto catalogado con stock controlado.
      // PRINCIPIO IRROMPIBLE: registrarSalida NUNCA bloquea la venta.
      // Si el producto no tiene stockActual definido, es un no-op silencioso.
      await Promise.all(
        detallesSnapshot
          .filter((d) => d.productoId !== undefined && !d.esProductoFantasma)
          .map((d) =>
            registrarSalida(d.productoId!, d.cantidad, undefined, ventaId)
          )
      )

      // Construir objetos para la pantalla de éxito
      const recibido = metodo === 'efectivo' ? parsearEntero(billete) : undefined
      setVentaGuardada({
        id: ventaId,
        sesionCajaId,
        clienteId,
        subtotal: total,
        descuento: 0,
        total,
        tipoPago: metodo,
        efectivoRecibido: recibido,
        cambio: recibido !== undefined ? recibido - total : undefined,
        estado: 'completada',
        creadaEn: ahora,
      })
      setDetallesGuardados(detallesSnapshot.map((d, i) => ({ ...d, id: i, ventaId })))

      limpiarCarrito()
      setEstado('exito')
    } catch (err) {
      setMensajeError(err instanceof Error ? err.message : 'Error desconocido')
      setEstado('error')
    }
  }

  // ── Pantalla de éxito ──────────────────────────────────────────────────────

  if (estado === 'exito' && ventaGuardada) {
    return (
      <PantallaExito
        venta={ventaGuardada}
        detalles={detallesGuardados}
        onNuevaVenta={onClose}
      />
    )
  }

  // ── Pantalla de error ──────────────────────────────────────────────────────

  if (estado === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl mx-4 max-w-sm">
          <AlertCircle size={48} className="text-peligro" />
          <p className="font-display font-bold text-xl text-texto">Error al guardar</p>
          <p className="text-sm text-suave text-center">{mensajeError}</p>
          <button type="button" onClick={() => setEstado('seleccion')} className="btn-primario w-full">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // ── Modal de cobro ─────────────────────────────────────────────────────────

  const METODOS = [
    { id: 'efectivo'      as MetodoPago, icon: Banknote,   label: 'Efectivo',      color: 'text-exito'    },
    { id: 'fiado'         as MetodoPago, icon: BookOpen,   label: 'Fiado',         color: 'text-fiado'    },
    { id: 'transferencia' as MetodoPago, icon: Smartphone, label: 'Transferencia', color: 'text-primario' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-borde">
          <div>
            <p className="text-suave text-xs font-medium uppercase tracking-wide">Total a cobrar</p>
            <p className="moneda font-bold text-precio text-texto leading-none">{formatCOP(total)}</p>
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

        {/* Tabs */}
        <div className="flex border-b border-borde px-4 pt-3 gap-2">
          {METODOS.map(({ id, icon: Icon, label, color }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMetodo(id)}
              className={[
                'flex items-center gap-2 pb-2 px-3 text-sm font-semibold border-b-2 transition-colors',
                metodo === id ? `border-current ${color}` : 'border-transparent text-suave hover:text-texto',
              ].join(' ')}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-4">
          {metodo === 'efectivo' && (
            <TabEfectivo total={total} billete={billete} onBilleteChange={setBillete} />
          )}
          {metodo === 'fiado' && (
            <TabFiado clienteFiado={clienteFiado} onClienteChange={setClienteFiado} />
          )}
          {metodo === 'transferencia' && <TabTransferencia />}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-borde flex flex-col gap-3">
          {/* Advertencia de stock insuficiente — NO bloquea la venta */}
          {alertasStock.length > 0 && (
            <div className="bg-advertencia/10 border border-advertencia/40 rounded-xl px-3 py-2">
              <p className="text-xs font-semibold text-advertencia mb-1 flex items-center gap-1">
                <AlertCircle size={12} />
                Stock insuficiente (la venta continúa igual)
              </p>
              {alertasStock.map((a) => (
                <p key={a.nombre} className="text-xs text-advertencia/80">
                  {a.nombre}: stock {a.stockActual}, faltan {a.faltante}
                </p>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={confirmarVenta}
            disabled={!puedeConfirmar()}
            className="w-full h-14 bg-primario text-white rounded-xl
                       font-display font-bold text-xl flex items-center justify-center gap-3
                       hover:bg-primario-hover active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed
                       shadow-md shadow-primario/30"
          >
            {estado === 'confirmando' ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 size={22} />
                Confirmar cobro
              </>
            )}
          </button>
        </div>{/* /footer flex */}
      </div>
    </div>
  )
}
