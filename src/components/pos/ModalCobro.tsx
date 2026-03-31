import { useState, useEffect } from 'react'
import { X, Banknote, BookOpen, Smartphone, CheckCircle2, AlertCircle, MessageCircle, ShoppingCart, Printer, Settings, CreditCard } from 'lucide-react'
import { db } from '../../db/database'
import { useVentaStore, selectTotal } from '../../stores/ventaStore'
import { TecladoNumerico } from '../shared/TecladoNumerico'
import { SelectorClienteFiado } from '../fiado/SelectorClienteFiado'
import type { ClienteFiado } from '../fiado/SelectorClienteFiado'
import { formatCOP, parsearEntero } from '../../utils/moneda'
import { generarRecibo, compartirPorWhatsApp } from '../../utils/impresion'
import { obtenerConfig } from '../../hooks/useConfig'
import { registrarSalida, verificarStockInsuficiente } from '../../hooks/useStock'
import {
  bluetoothDisponible,
  obtenerNombreImpresora,
  impresoraConectada,
  conectarImpresora,
  imprimirRecibo,
} from '../../lib/impresora'
import type { Venta, DetalleVenta } from '../../db/schema'

type MetodoPago = 'efectivo' | 'fiado' | 'transferencia' | 'tarjeta'
type PlataformaTransferencia = 'Nequi' | 'Daviplata' | 'Dale'
type SubtipoTarjeta = 'debito' | 'credito'
type EstadoModal = 'seleccion' | 'confirmando' | 'exito' | 'error'

const PLATAFORMAS: { id: PlataformaTransferencia; emoji: string }[] = [
  { id: 'Nequi',     emoji: '🟣' },
  { id: 'Daviplata', emoji: '🔵' },
  { id: 'Dale',      emoji: '🟡' },
]

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
  total,
  onClienteChange,
}: {
  clienteFiado: ClienteFiado | null
  total: number
  onClienteChange: (v: ClienteFiado | null) => void
}) {
  // Advertencia de límite de crédito — no bloquea, el tendero decide
  const advertenciaLimite = (() => {
    if (!clienteFiado) return null
    const limite = clienteFiado.limiteCredito
    if (!limite || limite <= 0) return null
    const deudaTrasCargo = (clienteFiado.totalDeuda ?? 0) + total
    if (deudaTrasCargo <= limite) return null
    return {
      limite,
      deudaActual: clienteFiado.totalDeuda ?? 0,
      deudaTrasCargo,
      exceso: deudaTrasCargo - limite,
    }
  })()

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-fiado/10 border border-fiado/30 rounded-xl p-3 text-sm text-fiado font-medium">
        Se anotará la deuda. No se requiere cédula ni documentos.
      </div>
      <SelectorClienteFiado value={clienteFiado} onChange={onClienteChange} />

      {/* Advertencia de límite de crédito — siempre no bloqueante */}
      {advertenciaLimite && (
        <div className="flex items-start gap-2 bg-orange-50 border border-orange-300
                        rounded-xl px-3 py-2.5 text-sm text-orange-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-orange-500" />
          <div className="flex flex-col gap-0.5">
            <span className="font-bold">Supera el límite de crédito</span>
            <span className="text-xs text-orange-700">
              Límite: {formatCOP(advertenciaLimite.limite)} · Deuda tras esta venta: {formatCOP(advertenciaLimite.deudaTrasCargo)}
              {' '}(exceso de {formatCOP(advertenciaLimite.exceso)})
            </span>
            <span className="text-xs text-orange-600 font-medium mt-0.5">
              La venta continúa — el tendero decide si fía.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab Transferencia ────────────────────────────────────────────────────────

function TabTransferencia({
  plataforma,
  onPlataformaChange,
}: {
  plataforma: PlataformaTransferencia | null
  onPlataformaChange: (p: PlataformaTransferencia) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-suave text-center">¿Por cuál plataforma llegó la transferencia?</p>
      <div className="grid grid-cols-3 gap-3">
        {PLATAFORMAS.map(({ id, emoji }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPlataformaChange(id)}
            className={[
              'flex flex-col items-center justify-center gap-2 h-20 rounded-xl border-2 font-semibold text-sm transition-all active:scale-95',
              plataforma === id
                ? 'border-acento bg-acento/8 text-texto shadow-sm'
                : 'border-borde text-suave hover:border-gray-300 hover:text-texto',
            ].join(' ')}
          >
            <span className="text-2xl leading-none">{emoji}</span>
            <span>{id}</span>
          </button>
        ))}
      </div>
      {!plataforma && (
        <p className="text-xs text-suave text-center">Selecciona una plataforma para continuar</p>
      )}
    </div>
  )
}

// ─── Tab Tarjeta ──────────────────────────────────────────────────────────────

function TabTarjeta({
  subtipo,
  onSubtipoChange,
}: {
  subtipo: SubtipoTarjeta | null
  onSubtipoChange: (s: SubtipoTarjeta) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-suave text-center">¿Débito o crédito?</p>
      <div className="grid grid-cols-2 gap-3">
        {([
          { id: 'debito'  as SubtipoTarjeta, label: 'Débito',  desc: 'Pago directo de cuenta' },
          { id: 'credito' as SubtipoTarjeta, label: 'Crédito', desc: 'Pago con cupo de crédito' },
        ]).map(({ id, label, desc }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSubtipoChange(id)}
            className={[
              'flex flex-col items-center justify-center gap-2 h-24 rounded-xl border-2 font-semibold text-sm transition-all active:scale-95',
              subtipo === id
                ? 'border-acento bg-acento/8 text-texto shadow-sm'
                : 'border-borde text-suave hover:border-gray-300 hover:text-texto',
            ].join(' ')}
          >
            <CreditCard size={24} className={subtipo === id ? 'text-acento' : 'text-suave'} />
            <span>{label}</span>
            <span className="text-[10px] font-normal text-suave leading-tight text-center px-1">{desc}</span>
          </button>
        ))}
      </div>
      {!subtipo && (
        <p className="text-xs text-suave text-center">Selecciona el tipo de tarjeta para continuar</p>
      )}
    </div>
  )
}

// ─── Pantalla de éxito ────────────────────────────────────────────────────────

type EstadoImpresion = 'idle' | 'conectando' | 'imprimiendo' | 'ok' | 'error'

function PantallaExito({
  venta,
  detalles,
  onNuevaVenta,
}: {
  venta: Venta
  detalles: DetalleVenta[]
  onNuevaVenta: () => void
}) {
  const [compartiendo,      setCompartiendo]      = useState(false)
  const [estadoImpresion,   setEstadoImpresion]   = useState<EstadoImpresion>('idle')
  const [errorImpresion,    setErrorImpresion]     = useState<string | null>(null)
  // Nombre de la impresora — refresca si cambia durante la sesión
  const [nombreImpresora,   setNombreImpresora]   = useState<string | null>(
    () => obtenerNombreImpresora()
  )

  const cambio = venta.cambio ?? 0

  // ── WhatsApp ───────────────────────────────────────────────────────────────

  const handleCompartir = async () => {
    setCompartiendo(true)
    try {
      const config = await obtenerConfig()
      compartirPorWhatsApp(generarRecibo(venta, detalles, config))
    } finally {
      setCompartiendo(false)
    }
  }

  // ── Impresión Bluetooth ───────────────────────────────────────────────────

  const handleImprimir = async () => {
    setErrorImpresion(null)

    // Si no está conectada, intentar conectar primero
    if (!impresoraConectada()) {
      setEstadoImpresion('conectando')
      try {
        const { nombre } = await conectarImpresora()
        setNombreImpresora(nombre)
      } catch (err) {
        setErrorImpresion(err instanceof Error ? err.message : 'No se pudo conectar')
        setEstadoImpresion('error')
        return
      }
    }

    setEstadoImpresion('imprimiendo')
    try {
      const config = await obtenerConfig()
      await imprimirRecibo(venta, detalles, config)
      setEstadoImpresion('ok')
    } catch (err) {
      setErrorImpresion(err instanceof Error ? err.message : 'Error al imprimir')
      setEstadoImpresion('error')
    }
  }

  // Etiqueta dinámica del botón de impresión
  const labelImprimir = () => {
    if (estadoImpresion === 'conectando')  return 'Conectando…'
    if (estadoImpresion === 'imprimiendo') return 'Imprimiendo…'
    if (estadoImpresion === 'ok')          return '¡Recibo impreso!'
    if (nombreImpresora)                   return 'Imprimir recibo'
    return 'Conectar impresora'
  }

  const ocupado = estadoImpresion === 'conectando' || estadoImpresion === 'imprimiendo'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col items-center gap-0 overflow-hidden">

        {/* Banda verde de éxito */}
        <div className="w-full bg-exito py-6 flex flex-col items-center gap-2">
          <CheckCircle2 size={52} className="text-white" strokeWidth={1.5} />
          <p className="font-display font-bold text-2xl text-white">¡Cobrado!</p>
          <p className="moneda font-bold text-3xl text-white">{formatCOP(venta.total)}</p>
          {venta.tipoPago === 'efectivo' && cambio > 0 && (
            <p className="text-white/80 text-sm font-medium">Cambio: {formatCOP(cambio)}</p>
          )}
          {venta.tipoPago === 'fiado' && (
            <p className="text-white/80 text-sm font-medium">Anotado a fiado</p>
          )}
          {venta.tipoPago === 'transferencia' && (
            <p className="text-white/80 text-sm font-medium">{venta.notas ?? 'Transferencia'}</p>
          )}
          {venta.tipoPago === 'tarjeta' && (
            <p className="text-white/80 text-sm font-medium">
              💳 Tarjeta {venta.subtipoTarjeta === 'debito' ? 'débito' : 'crédito'}
            </p>
          )}
        </div>

        {/* Acciones */}
        <div className="w-full p-5 flex flex-col gap-3">

          {/* Botón de impresión — solo si Web Bluetooth disponible */}
          {bluetoothDisponible() ? (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={handleImprimir}
                disabled={ocupado || estadoImpresion === 'ok'}
                className={[
                  'w-full h-12 rounded-xl font-semibold flex items-center justify-center gap-2',
                  'active:scale-95 transition-all disabled:cursor-not-allowed',
                  estadoImpresion === 'ok'
                    ? 'bg-exito/10 text-exito border border-exito/30'
                    : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50',
                ].join(' ')}
              >
                {ocupado ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : estadoImpresion === 'ok' ? (
                  <CheckCircle2 size={16} />
                ) : nombreImpresora ? (
                  <Printer size={18} />
                ) : (
                  <Settings size={18} />
                )}
                {labelImprimir()}
              </button>
              {/* Nombre de impresora conectada */}
              {nombreImpresora && estadoImpresion !== 'ok' && (
                <p className="text-center text-xs text-suave">🖨️ {nombreImpresora}</p>
              )}
              {/* Error de impresión */}
              {estadoImpresion === 'error' && errorImpresion && (
                <p className="text-center text-xs text-peligro leading-snug px-1">
                  {errorImpresion}
                </p>
              )}
            </div>
          ) : (
            /* Mensaje iOS / navegador incompatible */
            <div className="flex items-start gap-2 bg-gray-50 border border-borde rounded-xl px-3 py-2.5">
              <Printer size={15} className="text-suave shrink-0 mt-0.5" />
              <p className="text-xs text-suave leading-relaxed">
                La impresión Bluetooth funciona en Chrome para Android.
                En iPhone use el botón de WhatsApp.
              </p>
            </div>
          )}

          {/* WhatsApp — siempre disponible */}
          <button
            type="button"
            onClick={handleCompartir}
            disabled={compartiendo}
            className="w-full h-12 bg-[#25D366] text-white rounded-xl font-semibold
                       flex items-center justify-center gap-2
                       hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          >
            <MessageCircle size={18} />
            {compartiendo ? 'Generando recibo…' : 'Compartir por WhatsApp'}
          </button>

          {/* Nueva venta */}
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
  const [plataforma, setPlataforma] = useState<PlataformaTransferencia | null>(null)
  const [subtipoTarjeta, setSubtipoTarjeta] = useState<SubtipoTarjeta | null>(null)
  const [tieneDatafono, setTieneDatafono] = useState(false)
  const [estado, setEstado] = useState<EstadoModal>('seleccion')
  const [mensajeError, setMensajeError] = useState('')

  // Advertencia de stock insuficiente (no bloqueante — el tendero siempre puede vender)
  const [alertasStock, setAlertasStock] = useState<Array<{ nombre: string; stockActual: number; faltante: number }>>([])

  // Para la pantalla de éxito necesitamos la venta guardada y sus detalles
  const [ventaGuardada, setVentaGuardada] = useState<Venta | null>(null)
  const [detallesGuardados, setDetallesGuardados] = useState<DetalleVenta[]>([])

  // Leer config una sola vez al montar
  useEffect(() => {
    obtenerConfig().then((cfg) => setTieneDatafono(cfg.tieneDatafono ?? false))
  }, [])

  // Resetear sub-selecciones al cambiar método de pago
  useEffect(() => { setPlataforma(null); setSubtipoTarjeta(null) }, [metodo])

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
    if (metodo === 'transferencia') return plataforma !== null
    if (metodo === 'tarjeta') return subtipoTarjeta !== null
    return true
  }

  const confirmarVenta = async () => {
    setEstado('confirmando')
    try {
      const sesionCajaId = await obtenerSesionActiva()
      const ahora = new Date()

      // Pre-fetch precioCompra para snapshot de margen
      const preciosCompra: Record<number, number | undefined> = {}
      for (const item of items) {
        if (item.productoId !== undefined) {
          const prod = await db.productos.get(item.productoId)
          preciosCompra[item.productoId] = prod?.precioCompra
        }
      }

      // Snapshot de los detalles antes de limpiar el carrito
      const detallesSnapshot = items.map((item) => ({
        productoId: item.productoId,
        nombreProducto: item.nombreProducto,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        precioCompraSnapshot: item.productoId !== undefined ? preciosCompra[item.productoId] : undefined,
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
            subtipoTarjeta: metodo === 'tarjeta' && subtipoTarjeta ? subtipoTarjeta : undefined,
            efectivoRecibido: recibido,
            cambio: recibido !== undefined ? recibido - total : undefined,
            estado: 'completada',
            notas: metodo === 'transferencia' && plataforma ? plataforma : undefined,
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
          .modify((c) => {
            c.totalDeuda = (c.totalDeuda ?? 0) + montoDeuda
            c.ultimoMovimiento = ahora  // registrar fecha del cargo para mora
          })
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
        subtipoTarjeta: metodo === 'tarjeta' && subtipoTarjeta ? subtipoTarjeta : undefined,
        efectivoRecibido: recibido,
        cambio: recibido !== undefined ? recibido - total : undefined,
        notas: metodo === 'transferencia' && plataforma ? plataforma : undefined,
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
    { id: 'efectivo'      as MetodoPago, icon: Banknote,    label: 'Efectivo',      color: 'text-exito'    },
    { id: 'fiado'         as MetodoPago, icon: BookOpen,    label: 'Fiado',         color: 'text-fiado'    },
    { id: 'transferencia' as MetodoPago, icon: Smartphone,  label: 'Transf.',       color: 'text-primario' },
    ...(tieneDatafono ? [{ id: 'tarjeta' as MetodoPago, icon: CreditCard, label: 'Tarjeta', color: 'text-texto' }] : []),
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
            <TabFiado clienteFiado={clienteFiado} total={total} onClienteChange={setClienteFiado} />
          )}
          {metodo === 'transferencia' && (
            <TabTransferencia plataforma={plataforma} onPlataformaChange={setPlataforma} />
          )}
          {metodo === 'tarjeta' && (
            <TabTarjeta subtipo={subtipoTarjeta} onSubtipoChange={setSubtipoTarjeta} />
          )}
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
