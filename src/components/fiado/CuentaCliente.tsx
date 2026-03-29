import { useState } from 'react'
import { ArrowLeft, TrendingUp, TrendingDown, Plus } from 'lucide-react'
import { useCuentaCliente } from '../../hooks/useFiados'
import { ModalNuevoPago } from './ModalNuevoPago'
import { formatCOP } from '../../utils/moneda'

interface CuentaClienteProps {
  clienteId: number
  onVolver?: () => void
}

function formatFecha(fecha: Date): string {
  const d = new Date(fecha)
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CuentaCliente({ clienteId, onVolver }: CuentaClienteProps) {
  const [mostrarPago, setMostrarPago] = useState(false)
  const datos = useCuentaCliente(clienteId)

  // ── Skeleton de carga ─────────────────────────────────────────────────────
  if (datos === undefined) {
    return (
      <div className="h-full flex flex-col p-4 gap-3 animate-pulse">
        <div className="h-24 bg-gray-100 rounded-2xl" />
        <div className="h-10 bg-gray-100 rounded-xl" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!datos) {
    return (
      <div className="h-full flex items-center justify-center text-suave">
        Cliente no encontrado
      </div>
    )
  }

  const { cliente, movimientos } = datos
  const deudaPositiva = (cliente.totalDeuda ?? 0) > 0
  const tieneCredito = (cliente.totalDeuda ?? 0) < 0

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header */}
      <div className={[
        'p-4 shrink-0',
        deudaPositiva ? 'bg-red-50' : tieneCredito ? 'bg-exito/10' : 'bg-fondo',
      ].join(' ')}>
        <div className="flex items-start gap-3">
          {onVolver && (
            <button
              type="button"
              onClick={onVolver}
              className="mt-0.5 w-8 h-8 flex items-center justify-center rounded-lg
                         text-suave hover:text-texto hover:bg-black/10 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-xl text-texto truncate">
              {cliente.nombre}
            </h2>
            {cliente.telefono && (
              <p className="text-suave text-sm">{cliente.telefono}</p>
            )}
          </div>
        </div>

        {/* Deuda total — destacada */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-suave text-sm font-medium">
            {tieneCredito ? 'Crédito a favor:' : deudaPositiva ? 'Deuda total:' : 'Sin deuda'}
          </span>
          <span className={`moneda font-bold text-precio leading-none ${
            tieneCredito ? 'text-exito' : deudaPositiva ? 'text-peligro' : 'text-suave'
          }`}>
            {tieneCredito
              ? formatCOP(Math.abs(cliente.totalDeuda))
              : deudaPositiva
                ? formatCOP(cliente.totalDeuda)
                : '$0'}
          </span>
        </div>

        {/* Botón registrar pago */}
        <button
          type="button"
          onClick={() => setMostrarPago(true)}
          disabled={!deudaPositiva}
          className="mt-3 w-full h-12 bg-exito text-white rounded-xl
                     font-display font-bold flex items-center justify-center gap-2
                     hover:opacity-90 active:scale-95 transition-all
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus size={18} />
          Registrar pago
        </button>
      </div>

      {/* Historial de movimientos */}
      <div className="flex-1 overflow-y-auto">
        {movimientos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-suave/60 p-8">
            <div className="text-4xl">📋</div>
            <p className="text-sm text-center">
              Sin movimientos registrados
            </p>
          </div>
        ) : (
          <div className="divide-y divide-borde/50">
            {movimientos.map((mov) => {
              const esCargo = mov.tipo === 'cargo'
              return (
                <div key={mov.id} className="flex items-start gap-3 px-4 py-3">
                  {/* Ícono tipo */}
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    esCargo ? 'bg-red-100' : 'bg-exito/10'
                  }`}>
                    {esCargo
                      ? <TrendingUp size={15} className="text-peligro" />
                      : <TrendingDown size={15} className="text-exito" />}
                  </div>

                  {/* Descripción y fecha */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-texto leading-tight truncate">
                      {mov.descripcion}
                    </p>
                    <p className="text-xs text-suave mt-0.5">
                      {formatFecha(mov.creadoEn)}
                    </p>
                  </div>

                  {/* Monto */}
                  <div className="text-right shrink-0">
                    <span className={`moneda font-bold text-sm ${
                      esCargo ? 'text-peligro' : 'text-exito'
                    }`}>
                      {esCargo ? '+' : '−'}{formatCOP(mov.monto)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de pago */}
      {mostrarPago && (
        <ModalNuevoPago
          cliente={cliente}
          onClose={() => setMostrarPago(false)}
        />
      )}
    </div>
  )
}
