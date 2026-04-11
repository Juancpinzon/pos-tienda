import { useState, useEffect } from 'react'
import { X, Banknote, BookOpen, Smartphone, CheckCircle2, AlertCircle, MessageCircle, ShoppingCart, Printer, Settings, CreditCard, FileText, MapPin } from 'lucide-react'
import { db } from '../../db/database'
import { useVentaStore, selectTotal } from '../../stores/ventaStore'
import { TecladoNumerico } from '../shared/TecladoNumerico'
import { SelectorClienteFiado } from '../fiado/SelectorClienteFiado'
import type { ClienteFiado } from '../fiado/SelectorClienteFiado'
import { formatCOP, parsearEntero } from '../../utils/moneda'
import { generarRecibo, compartirPorWhatsApp } from '../../utils/impresion'
import { obtenerConfig, usePlan, incrementarVentasDemo } from '../../hooks/useConfig'
import { registrarSalida, verificarStockInsuficiente } from '../../hooks/useStock'
import {
  bluetoothDisponible,
  obtenerNombreImpresora,
  impresoraConectada,
  conectarImpresora,
  imprimirRecibo,
} from '../../lib/impresora'
import type { Venta, DetalleVenta } from '../../db/schema'
import { ModalNotaVenta } from './ModalNotaVenta'
import { siguienteConsecutivo } from '../../lib/notaVenta'
import { ModalPedidoDomicilio } from '../domicilios/ModalPedidoDomicilio'

type MetodoPago = 'efectivo' | 'fiado' | 'transferencia' | 'tarjeta'
type CanalVenta = 'mostrador' | 'domicilio'
type PlataformaTransferencia = 'Nequi' | 'Daviplata' | 'Dale'
type SubtipoTarjeta = 'debito' | 'credito'
type EstadoModal = 'seleccion' | 'confirmando' | 'exito' | 'verificacion' | 'error'

const PLATAFORMAS: { id: PlataformaTransferencia; emoji: string }[] = [
  { id: 'Nequi',     emoji: '🟣' },
  { id: 'Daviplata', emoji: '🔵' },
  { id: 'Dale',      emoji: '🟡' },
]

interface ModalCobroProps {
  onClose: () => void
  /** Callback opcional — se llama justo después de registrar la venta con éxito */
  onVentaExitosa?: () => void
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

// ─── Pantalla de verificación de transferencia ────────────────────────────────

function PantallaVerificacion({
  ventaId,
  total,
  plataforma,
  onVerificado,
  onDespues,
}: {
  ventaId: number
  total: number
  plataforma: string
  onVerificado: () => void
  onDespues: () => void
}) {
  const [cargando, setCargando] = useState(false)

  const handleVerificado = async () => {
    setCargando(true)
    await db.ventas.update(ventaId, { estadoPago: 'verificado' })
    onVerificado()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl
                      flex flex-col items-center p-6 gap-5">
        <CheckCircle2 size={52} className="text-exito" strokeWidth={1.5} />
        <div className="text-center flex flex-col gap-2">
          <p className="font-display font-bold text-xl text-texto">✅ Venta registrada</p>
          <p className="moneda font-bold text-3xl text-primario">{formatCOP(total)}</p>
          <p className="text-suave text-sm leading-relaxed">
            ¿Ya verificaste que llegó la transferencia por{' '}
            <span className="font-semibold text-texto">{plataforma}</span>?
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <button
            type="button"
            onClick={handleVerificado}
            disabled={cargando}
            className="w-full h-12 bg-exito text-white rounded-xl font-display font-bold text-base
                       flex items-center justify-center gap-2
                       hover:bg-exito/90 active:scale-95 transition-all disabled:opacity-50"
          >
            <CheckCircle2 size={18} />
            Sí, llegó
          </button>
          <button
            type="button"
            onClick={onDespues}
            className="w-full h-11 border border-borde text-suave rounded-xl font-semibold text-sm
                       flex items-center justify-center gap-2
                       hover:bg-fondo active:scale-95 transition-all"
          >
            ⏳ Verificar después
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Pantalla de éxito ────────────────────────────────────────────────────────

type EstadoImpresion = 'idle' | 'conectando' | 'imprimiendo' | 'ok' | 'error'

function PantallaExito({
  venta,
  detalles,
  consecutivoNota,
  nombreCliente,
  onNuevaVenta,
}: {
  venta: Venta
  detalles: DetalleVenta[]
  consecutivoNota: string
  nombreCliente?: string
  onNuevaVenta: () => void
}) {
  const [compartiendo,      setCompartiendo]      = useState(false)
  const [estadoImpresion,   setEstadoImpresion]   = useState<EstadoImpresion>('idle')
  const [errorImpresion,    setErrorImpresion]     = useState<string | null>(null)
  const [mostrarNota,       setMostrarNota]        = useState(false)
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
    <>
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

          {/* Nota de venta — siempre disponible */}
          <button
            type="button"
            onClick={() => setMostrarNota(true)}
            className="w-full h-11 bg-primario/8 text-primario border border-primario/25
                       rounded-xl font-semibold text-sm flex items-center justify-center gap-2
                       hover:bg-primario/12 active:scale-95 transition-all"
          >
            <FileText size={16} />
            📄 Ver nota de venta ({consecutivoNota})
          </button>

          {/* Impresión Bluetooth */}
          {bluetoothDisponible() ? (
            nombreImpresora ? (
              /* ── Impresora configurada → botón PRIMARIO ── */
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleImprimir}
                  disabled={ocupado || estadoImpresion === 'ok'}
                  className={[
                    'w-full h-12 rounded-xl font-display font-bold text-base flex items-center justify-center gap-2',
                    'active:scale-95 transition-all disabled:cursor-not-allowed',
                    estadoImpresion === 'ok'
                      ? 'bg-exito/10 text-exito border border-exito/30'
                      : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50',
                  ].join(' ')}
                >
                  {ocupado ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : estadoImpresion === 'ok' ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <Printer size={20} />
                  )}
                  {estadoImpresion === 'conectando'  ? 'Conectando…'
                    : estadoImpresion === 'imprimiendo' ? 'Imprimiendo…'
                    : estadoImpresion === 'ok'          ? '¡Recibo impreso!'
                    : '🖨️ Imprimir recibo'}
                </button>
                {estadoImpresion !== 'ok' && (
                  <p className="text-center text-xs text-suave">🖨️ {nombreImpresora}</p>
                )}
                {estadoImpresion === 'error' && errorImpresion && (
                  <p className="text-center text-xs text-peligro leading-snug px-1">{errorImpresion}</p>
                )}
              </div>
            ) : (
              /* ── Sin impresora configurada → botón SECUNDARIO ── */
              <button
                type="button"
                onClick={handleImprimir}
                disabled={ocupado}
                className="w-full h-10 border border-borde text-texto rounded-xl text-sm font-semibold
                           flex items-center justify-center gap-2
                           hover:bg-fondo active:scale-95 transition-all disabled:opacity-40"
              >
                {ocupado ? (
                  <div className="w-4 h-4 border-2 border-texto/20 border-t-texto/60 rounded-full animate-spin" />
                ) : (
                  <Settings size={15} />
                )}
                {ocupado ? 'Buscando impresora…' : '⚙️ Configurar impresora'}
              </button>
            )
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
            className="w-full h-11 bg-[#25D366] text-white rounded-xl font-semibold text-sm
                       flex items-center justify-center gap-2
                       hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          >
            <MessageCircle size={16} />
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

    {/* Modal Nota de Venta */}
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

// ─── Modal principal ──────────────────────────────────────────────────────────

export function ModalCobro({ onClose, onVentaExitosa }: ModalCobroProps) {
  const { modoDemo, demoAgotado } = usePlan()
  const [modalActivarOpen, setModalActivarOpen] = useState(false)

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
  // Canal de venta (mostrador / domicilio)
  const [canal, setCanal] = useState<CanalVenta>('mostrador')
  const [direccionRapida, setDireccionRapida] = useState('')
  const [mostrarModalDomicilio, setMostrarModalDomicilio] = useState(false)

  // Advertencia de stock insuficiente (no bloqueante — el tendero siempre puede vender)
  const [alertasStock, setAlertasStock] = useState<Array<{ nombre: string; stockActual: number; faltante: number }>>([])

  // Para la pantalla de éxito necesitamos la venta guardada y sus detalles
  const [ventaGuardada, setVentaGuardada] = useState<Venta | null>(null)
  const [detallesGuardados, setDetallesGuardados] = useState<DetalleVenta[]>([])
  const [consecutivoNota, setConsecutivoNota] = useState('')
  const [nombreClienteGuardado, setNombreClienteGuardado] = useState<string | undefined>(undefined)

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
    if (modoDemo && demoAgotado) {
      setModalActivarOpen(true)
      toast.error('Límite de ventas demo alcanzado')
      return
    }

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
            canal: canal,
            estado: 'completada',
            // Transferencias inician como "pendiente_verificacion" — el tendero confirma después
            estadoPago: metodo === 'transferencia' ? 'pendiente_verificacion' : undefined,
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

      // Si es demo, incrementar contador
      if (modoDemo) {
        await incrementarVentasDemo()
      }

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
        canal: canal,
        estadoPago: metodo === 'transferencia' ? 'pendiente_verificacion' : undefined,
        notas: metodo === 'transferencia' && plataforma ? plataforma : undefined,
        estado: 'completada',
        creadaEn: ahora,
      })
      // Generar consecutivo de nota de venta
      const { codigo: codNota } = await siguienteConsecutivo()
      setConsecutivoNota(codNota)
      setNombreClienteGuardado(
        metodo === 'fiado' && clienteFiado ? clienteFiado.nombre.trim() : undefined
      )

      setDetallesGuardados(detallesSnapshot.map((d, i) => ({ ...d, id: i, ventaId })))

      limpiarCarrito()
      onVentaExitosa?.()

      // Si es domicilio, abrir el modal de pedido antes de mostrar éxito
      if (canal === 'domicilio') {
        setMostrarModalDomicilio(true)
      }
      setEstado('exito')
    } catch (err) {
      setMensajeError(err instanceof Error ? err.message : 'Error desconocido')
      setEstado('error')
    }
  }

  // ── Pantalla de verificación de transferencia (antes de éxito) ───────────────

  if (estado === 'exito' && ventaGuardada?.tipoPago === 'transferencia' && ventaGuardada.estadoPago === 'pendiente_verificacion') {
    return (
      <PantallaVerificacion
        ventaId={ventaGuardada.id!}
        total={ventaGuardada.total}
        plataforma={ventaGuardada.notas ?? 'Transferencia'}
        onVerificado={() => setVentaGuardada((v) => v ? { ...v, estadoPago: 'verificado' } : v)}
        onDespues={() => setVentaGuardada((v) => v ? { ...v, estadoPago: undefined } : v)}
      />
    )
  }

  // ── Pantalla de éxito ──────────────────────────────────────────────────────

  if (estado === 'exito' && ventaGuardada) {
    return (
      <>
        <PantallaExito
          venta={ventaGuardada}
          detalles={detallesGuardados}
          consecutivoNota={consecutivoNota}
          nombreCliente={nombreClienteGuardado}
          onNuevaVenta={onClose}
        />
        {/* Modal domicilio se abre sobre PantallaExito cuando el canal es domicilio */}
        {mostrarModalDomicilio && ventaGuardada.id !== undefined && (
          <ModalPedidoDomicilio
            ventaId={ventaGuardada.id}
            totalVenta={ventaGuardada.total}
            direccionInicial={direccionRapida}
            nombreClienteInicial={nombreClienteGuardado ?? ''}
            onGuardado={() => setMostrarModalDomicilio(false)}
            onSaltar={() => setMostrarModalDomicilio(false)}
          />
        )}
      </>
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
    <>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-borde">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-suave/10 flex items-center justify-center">
              <ShoppingCart size={16} className="text-suave" />
            </div>
            <h2 className="font-display font-bold text-base text-texto">Finalizar Venta</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl
                       text-suave hover:text-texto hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Canales (Mostrador / Domicilio) */}
        <div className="flex p-2 gap-1 bg-fondo border-b border-borde">
          {(['mostrador', 'domicilio'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCanal(c)}
              className={[
                'flex-1 h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all',
                canal === c 
                  ? 'bg-white text-primario shadow-sm border border-borde' 
                  : 'text-suave hover:bg-white/50'
              ].join(' ')}
            >
              {c === 'mostrador' ? <ShoppingCart size={14} /> : <MapPin size={14} />}
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>

        {/* Si es domicilio, campo de dirección rápida */}
        {canal === 'domicilio' && (
          <div className="px-4 py-3 bg-acento/5 border-b border-acento/10 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-acento" />
              <input
                type="text"
                value={direccionRapida}
                onChange={(e) => setDireccionRapida(e.target.value)}
                placeholder="Dirección del domicilio (opcional)"
                className="flex-1 bg-transparent border-none text-sm text-texto focus:ring-0 placeholder:text-suave/60"
              />
            </div>
          </div>
        )}

        {/* Métodos de pago */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 p-2 bg-fondo border-b border-borde">
          {METODOS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetodo(m.id)}
              className={[
                'flex flex-col items-center justify-center gap-1.5 h-20 rounded-xl transition-all',
                metodo === m.id
                  ? 'bg-white shadow-sm border border-borde ring-2 ring-primario/10'
                  : 'hover:bg-white/40 grayscale opacity-60'
              ].join(' ')}
            >
              <m.icon size={22} className={metodo === m.id ? m.color : 'text-suave'} />
              <span className={`text-[11px] font-bold ${metodo === m.id ? 'text-texto' : 'text-suave'}`}>
                {m.label}
              </span>
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
        </div>
      </div>
    </div>

    {modalActivarOpen && (
      <ModalActivarBasico onClose={() => setModalActivarOpen(false)} />
    )}
    </>
  )
}
