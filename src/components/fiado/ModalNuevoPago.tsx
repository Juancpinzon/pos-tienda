import { useState } from 'react'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'
import { TecladoNumerico } from '../shared/TecladoNumerico'
import { registrarPago } from '../../hooks/useFiados'
import { obtenerSesionActiva } from '../../hooks/useCaja'
import { formatCOP, parsearEntero } from '../../utils/moneda'
import type { Cliente } from '../../db/schema'

interface ModalNuevoPagoProps {
  cliente: Cliente
  onClose: () => void
}

type Estado = 'ingresando' | 'guardando' | 'exito' | 'error'
type FormaCobro = 'efectivo' | 'Nequi' | 'Daviplata' | 'Dale' | 'tarjeta_debito' | 'tarjeta_credito'

const FORMAS_COBRO: { id: FormaCobro; label: string; emoji: string }[] = [
  { id: 'efectivo',       label: 'Efectivo',       emoji: '💵' },
  { id: 'Nequi',         label: 'Nequi',          emoji: '🟣' },
  { id: 'Daviplata',     label: 'Daviplata',      emoji: '🔵' },
  { id: 'Dale',          label: 'Dale',           emoji: '🟡' },
  { id: 'tarjeta_debito',  label: 'T. Débito',    emoji: '💳' },
  { id: 'tarjeta_credito', label: 'T. Crédito',   emoji: '💳' },
]

export function ModalNuevoPago({ cliente, onClose }: ModalNuevoPagoProps) {
  const [monto, setMonto] = useState('')
  const [formaCobro, setFormaCobro] = useState<FormaCobro>('efectivo')
  const [estado, setEstado] = useState<Estado>('ingresando')
  const [mensajeError, setMensajeError] = useState('')

  const montoNumero = parsearEntero(monto)
  const deudaActual = cliente.totalDeuda ?? 0
  const saldoTras = deudaActual - montoNumero
  const esPagoTotal = montoNumero >= deudaActual && deudaActual > 0
  const esSobrepago = montoNumero > deudaActual && deudaActual > 0

  const pagarTodo = () => {
    if (deudaActual > 0) setMonto(String(Math.ceil(deudaActual)))
  }

  const confirmar = async () => {
    if (montoNumero <= 0) return
    setEstado('guardando')
    try {
      const sesion = await obtenerSesionActiva()
      await registrarPago(cliente.id!, montoNumero, sesion?.id, formaCobro)
      setEstado('exito')
      setTimeout(onClose, 1200)
    } catch (err) {
      setMensajeError(err instanceof Error ? err.message : 'Error al guardar')
      setEstado('error')
    }
  }

  // ── Éxito ──────────────────────────────────────────────────────────────────
  if (estado === 'exito') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl mx-4">
          <CheckCircle2 size={56} className="text-exito" />
          <p className="font-display font-bold text-xl text-texto">¡Pago registrado!</p>
          <p className="moneda text-exito font-bold text-lg">{formatCOP(montoNumero)}</p>
        </div>
      </div>
    )
  }

  if (estado === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl mx-4 max-w-sm">
          <AlertCircle size={40} className="text-peligro" />
          <p className="font-bold text-texto">Error al guardar</p>
          <p className="text-sm text-suave text-center">{mensajeError}</p>
          <button type="button" onClick={() => setEstado('ingresando')} className="btn-primario w-full">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-borde">
          <div>
            <p className="text-suave text-xs font-medium uppercase tracking-wide">Registrar pago</p>
            <p className="font-display font-bold text-base text-texto">{cliente.nombre}</p>
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

        <div className="p-4 flex flex-col gap-4">

          {/* Deuda actual */}
          <div className="flex justify-between items-center bg-red-50 border border-red-200 rounded-xl p-3">
            <span className="text-sm text-texto font-medium">Deuda actual</span>
            <span className="moneda font-bold text-peligro">{formatCOP(deudaActual)}</span>
          </div>

          {/* Monto ingresado */}
          <div className="text-center">
            <p className="text-suave text-xs mb-1">Monto del pago</p>
            <p className="moneda font-bold text-total text-texto leading-none">
              {montoNumero > 0 ? formatCOP(montoNumero) : '$0'}
            </p>
          </div>

          {/* Teclado numérico */}
          <TecladoNumerico valor={monto} onChange={setMonto} />

          {/* Atajos: pagar todo */}
          {deudaActual > 0 && (
            <button
              type="button"
              onClick={pagarTodo}
              className="w-full h-10 border border-dashed border-primario text-primario
                         rounded-xl text-sm font-semibold hover:bg-primario/5 transition-colors"
            >
              Pagar todo — {formatCOP(deudaActual)}
            </button>
          )}

          {/* Saldo resultante */}
          {montoNumero > 0 && (
            <div className={[
              'flex justify-between items-center rounded-xl p-3 border text-sm',
              esSobrepago
                ? 'bg-orange-50 border-orange-200'
                : saldoTras <= 0
                  ? 'bg-exito/10 border-exito/30'
                  : 'bg-gray-50 border-borde',
            ].join(' ')}>
              <span className="font-medium text-texto">
                {esSobrepago ? 'Crédito a favor' : 'Deuda restante'}
              </span>
              <span className={`moneda font-bold ${
                esSobrepago ? 'text-advertencia' : saldoTras <= 0 ? 'text-exito' : 'text-texto'
              }`}>
                {esSobrepago ? formatCOP(Math.abs(saldoTras)) : formatCOP(Math.max(0, saldoTras))}
              </span>
            </div>
          )}

          {esPagoTotal && !esSobrepago && (
            <p className="text-center text-xs text-exito font-medium">
              ✓ Cancela la deuda completa
            </p>
          )}

          {/* Forma de cobro */}
          <div>
            <p className="text-xs text-suave font-medium mb-2">¿Cómo te pagó?</p>
            <div className="grid grid-cols-3 gap-2">
              {FORMAS_COBRO.map(({ id, label, emoji }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFormaCobro(id)}
                  className={[
                    'flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-xs font-medium transition-all',
                    formaCobro === id
                      ? 'bg-primario/10 text-primario border-primario/40'
                      : 'bg-white text-suave border-borde hover:border-gray-300',
                  ].join(' ')}
                >
                  <span className="text-base">{emoji}</span>
                  <span className="leading-tight text-center">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Confirmar */}
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={confirmar}
            disabled={montoNumero <= 0 || estado === 'guardando'}
            className="w-full h-14 bg-exito text-white rounded-xl
                       font-display font-bold text-xl flex items-center justify-center gap-3
                       hover:opacity-90 active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {estado === 'guardando' ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 size={22} />
                Registrar pago
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
