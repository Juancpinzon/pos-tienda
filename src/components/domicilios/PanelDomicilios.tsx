// Panel principal de gestión de domicilios
// Muestra pedidos activos con controles de estado

import { useState } from 'react'
import { Bike, MapPin, Phone, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, Package } from 'lucide-react'
import { usePedidosDomicilio } from '../../hooks/useDomicilios'
import type { PedidoDomicilio } from '../../db/schema'
import { formatCOP } from '../../utils/moneda'
import { ConfirmDialog } from '../shared/ConfirmDialog'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tiempoTranscurrido(fecha: Date): string {
  const minutos = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000)
  if (minutos < 1)   return 'Ahora mismo'
  if (minutos < 60)  return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24)    return `${horas}h ${minutos % 60}min`
  return `${Math.floor(horas / 24)}d`
}

const ESTADO_CONFIG = {
  pendiente:  { label: 'Pendiente',   color: 'bg-advertencia/15 text-advertencia border-advertencia/30', dot: 'bg-advertencia' },
  en_camino:  { label: 'En camino',   color: 'bg-primario/10 text-primario border-primario/25',          dot: 'bg-primario animate-pulse' },
  entregado:  { label: 'Entregado',   color: 'bg-exito/10 text-exito border-exito/25',                   dot: 'bg-exito' },
  cancelado:  { label: 'Cancelado',   color: 'bg-gray-100 text-suave border-gray-200',                   dot: 'bg-gray-400' },
}

// ─── Tarjeta de pedido ────────────────────────────────────────────────────────

function TarjetaPedido({ pedido }: { pedido: PedidoDomicilio }) {
  const { actualizarEstado } = usePedidosDomicilio()
  const [expandido, setExpandido] = useState(false)
  const [cancelarConfirm, setCancelarConfirm] = useState(false)
  const [actualizando, setActualizando] = useState(false)

  const cfg = ESTADO_CONFIG[pedido.estado]

  const cambiarEstado = async (nuevoEstado: PedidoDomicilio['estado']) => {
    setActualizando(true)
    try {
      await actualizarEstado(pedido.id!, nuevoEstado)
    } finally {
      setActualizando(false)
    }
  }

  return (
    <div className="bg-white border border-borde rounded-2xl overflow-hidden shadow-sm">

      {/* Encabezado de la tarjeta */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛵</span>
              <p className="font-display font-bold text-texto text-base truncate">{pedido.nombre}</p>
            </div>
            <div className="flex items-center gap-1 mt-0.5 text-suave text-sm">
              <MapPin size={13} className="shrink-0" />
              <span className="truncate">{pedido.direccion}</span>
              {pedido.barrio && <span className="text-suave/70">· {pedido.barrio}</span>}
            </div>
            {pedido.telefono && (
              <div className="flex items-center gap-1 mt-0.5 text-suave text-sm">
                <Phone size={13} className="shrink-0" />
                <span>{pedido.telefono}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.color} flex items-center gap-1.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            <div className="flex items-center gap-1 text-suave text-xs">
              <Clock size={11} />
              {tiempoTranscurrido(pedido.creadoEn)}
            </div>
          </div>
        </div>

        {/* Info adicional */}
        <div className="mt-2 flex items-center gap-3 text-xs text-suave">
          {pedido.repartidor && (
            <span className="flex items-center gap-1">
              <Bike size={12} />
              {pedido.repartidor}
            </span>
          )}
          {pedido.costoEnvio > 0 && (
            <span className="font-semibold text-texto">Envío: {formatCOP(pedido.costoEnvio)}</span>
          )}
          {pedido.ventaId && (
            <span className="text-suave/70">Venta #{pedido.ventaId}</span>
          )}
        </div>
      </div>

      {/* Expansión de indicaciones */}
      {pedido.indicaciones && (
        <div>
          <button
            type="button"
            onClick={() => setExpandido(!expandido)}
            className="w-full flex items-center gap-1.5 px-4 py-2 text-xs text-primario font-medium
                       hover:bg-primario/5 transition-colors border-t border-borde/40"
          >
            {expandido ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expandido ? 'Ocultar indicaciones' : 'Ver indicaciones'}
          </button>
          {expandido && (
            <div className="px-4 pb-3 text-sm text-suave italic bg-fondo/50">
              {pedido.indicaciones}
            </div>
          )}
        </div>
      )}

      {/* Controles de estado */}
      {pedido.estado !== 'entregado' && pedido.estado !== 'cancelado' && (
        <div className="px-4 pb-4 pt-2 flex gap-2 border-t border-borde/40">
          {pedido.estado === 'pendiente' && (
            <button
              type="button"
              disabled={actualizando}
              onClick={() => cambiarEstado('en_camino')}
              className="flex-1 h-14 bg-primario text-white rounded-xl font-semibold text-sm
                         flex items-center justify-center gap-2
                         hover:bg-primario-hover active:scale-95 transition-all disabled:opacity-50"
            >
              <Bike size={18} />
              Salió a entregar
            </button>
          )}
          {pedido.estado === 'en_camino' && (
            <button
              type="button"
              disabled={actualizando}
              onClick={() => cambiarEstado('entregado')}
              className="flex-1 h-14 bg-exito text-white rounded-xl font-semibold text-sm
                         flex items-center justify-center gap-2
                         hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              <CheckCircle2 size={18} />
              Entregado
            </button>
          )}
          <button
            type="button"
            disabled={actualizando}
            onClick={() => setCancelarConfirm(true)}
            className="w-14 h-14 border border-peligro/30 text-peligro rounded-xl
                       flex items-center justify-center
                       hover:bg-peligro/8 active:scale-95 transition-all disabled:opacity-50"
          >
            <XCircle size={20} />
          </button>
        </div>
      )}

      {/* Confirmación cancelar */}
      {cancelarConfirm && (
        <ConfirmDialog
          titulo="Cancelar domicilio"
          mensaje={`¿Cancelar el pedido de ${pedido.nombre}?`}
          labelConfirmar="Sí, cancelar"
          labelCancelar="No"
          peligroso
          onConfirmar={() => { setCancelarConfirm(false); void cambiarEstado('cancelado') }}
          onCancelar={() => setCancelarConfirm(false)}
        />
      )}
    </div>
  )
}

// ─── Panel principal ──────────────────────────────────────────────────────────

type VistaPanel = 'activos' | 'historial'

export function PanelDomicilios() {
  const { pedidos, pedidosActivos, cargando } = usePedidosDomicilio()
  const [vista, setVista] = useState<VistaPanel>('activos')

  const pedidosHistorial = pedidos.filter(
    (p) => p.estado === 'entregado' || p.estado === 'cancelado'
  )

  const listaVisible = vista === 'activos' ? pedidosActivos : pedidosHistorial

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Tabs activos / historial */}
      <div className="flex border-b border-borde px-4 pt-2 shrink-0 bg-white">
        {([
          { id: 'activos' as VistaPanel,   label: 'Activos',   count: pedidosActivos.length },
          { id: 'historial' as VistaPanel, label: 'Historial', count: pedidosHistorial.length },
        ]).map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setVista(id)}
            className={[
              'flex items-center gap-2 pb-2 px-3 text-sm font-semibold border-b-2 transition-colors',
              vista === id
                ? 'border-acento text-acento'
                : 'border-transparent text-suave hover:text-texto',
            ].join(' ')}
          >
            {label}
            {count > 0 && (
              <span className={[
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                vista === id ? 'bg-acento/15 text-acento' : 'bg-gray-100 text-suave',
              ].join(' ')}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista de pedidos */}
      <div className="flex-1 overflow-y-auto p-4">
        {cargando ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-3 border-primario/20 border-t-primario rounded-full animate-spin" />
          </div>
        ) : listaVisible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              {vista === 'activos'
                ? <Bike size={28} className="text-suave" />
                : <Package size={28} className="text-suave" />}
            </div>
            <p className="font-semibold text-texto">
              {vista === 'activos' ? 'Sin domicilios activos' : 'Sin historial aún'}
            </p>
            <p className="text-sm text-suave max-w-xs">
              {vista === 'activos'
                ? 'Los domicilios aparecerán aquí al cobrar con canal "Domicilio" en el POS.'
                : 'Los pedidos entregados o cancelados aparecerán aquí.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {listaVisible.map((pedido) => (
              <TarjetaPedido key={pedido.id} pedido={pedido} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
