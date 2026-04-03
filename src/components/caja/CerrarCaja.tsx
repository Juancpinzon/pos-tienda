import { useState } from 'react'
import { X, Lock, AlertTriangle, CheckCircle, Banknote, Smartphone, BookOpen, TrendingDown, ClipboardList } from 'lucide-react'
import { TecladoNumerico } from '../shared/TecladoNumerico'
import { cerrarCaja, useResumenCaja } from '../../hooks/useCaja'
import { useCantidadCuentasAbiertas } from '../../hooks/useCuentasAbiertas'
import { formatCOP } from '../../utils/moneda'

interface CerrarCajaProps {
  sesionId: number
  onClose: () => void
}

export function CerrarCaja({ sesionId, onClose }: CerrarCajaProps) {
  const [efectivoContado, setEfectivoContado] = useState('')
  const [notas, setNotas] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const resumen = useResumenCaja(sesionId)

  const montoCierre = parseInt(efectivoContado || '0', 10)
  const diferencia = resumen ? montoCierre - resumen.efectivoEsperado : 0
  const diferenciaGrande = Math.abs(diferencia) > 5000
  const puedeConfirmar = efectivoContado.length > 0
  const cuentasAbiertas = useCantidadCuentasAbiertas()

  const confirmar = async () => {
    if (!puedeConfirmar || cerrando) return
    setCerrando(true)
    try {
      await cerrarCaja(sesionId, montoCierre, notas || undefined)
      onClose()
    } finally {
      setCerrando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[94vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-borde shrink-0">
          <div className="flex items-center gap-3">
            <Lock size={20} className="text-peligro" />
            <h2 className="font-display font-bold text-lg text-texto">Cerrar caja</h2>
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

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Advertencia: cuentas abiertas sin cobrar */}
          {cuentasAbiertas > 0 && (
            <div className="bg-advertencia/10 border border-advertencia/30 rounded-xl px-4 py-3 flex items-start gap-3">
              <ClipboardList size={18} className="text-advertencia shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-advertencia leading-snug">
                  {cuentasAbiertas} cuenta{cuentasAbiertas !== 1 ? 's' : ''} abierta{cuentasAbiertas !== 1 ? 's' : ''} sin cobrar
                </p>
                <p className="text-xs text-suave mt-0.5 leading-snug">
                  Cobra las cuentas pendientes antes de cerrar la caja para que queden registradas en el cierre de hoy.
                </p>
              </div>
            </div>
          )}

          {/* Resumen del día — desglose completo antes de pedir el conteo */}
          {resumen && (
            <div className="bg-fondo rounded-xl border border-borde overflow-hidden">

              {/* Encabezado con total */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-borde/60">
                <div>
                  <p className="text-xs text-suave">Total vendido hoy</p>
                  <p className="moneda font-bold text-lg text-texto leading-tight">
                    {formatCOP(resumen.totalVentas)}
                  </p>
                </div>
                <p className="text-xs text-suave">
                  {resumen.cantidadVentas} venta{resumen.cantidadVentas !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Desglose por método */}
              <div className="divide-y divide-borde/40">
                <FilaCierre
                  icon={<Banknote size={13} className="text-exito" />}
                  label="💵 Ventas en efectivo"
                  valor={resumen.totalEfectivo}
                  colorValor="text-exito"
                />
                <FilaCierre
                  icon={<Smartphone size={13} className="text-primario" />}
                  label="📱 Ventas por transferencia"
                  valor={resumen.totalTransferencia}
                  colorValor="text-primario"
                  nota="No cuenta como efectivo en caja"
                />
                <FilaCierre
                  icon={<BookOpen size={13} className="text-fiado" />}
                  label="📒 Ventas a fiado"
                  valor={resumen.totalFiado}
                  colorValor="text-fiado"
                  nota="No es efectivo, es deuda"
                />
                {resumen.totalGastos > 0 && (
                  <FilaCierre
                    icon={<TrendingDown size={13} className="text-peligro" />}
                    label="Gastos del día"
                    valor={resumen.totalGastos}
                    colorValor="text-peligro"
                    negativo
                  />
                )}
              </div>

              {/* Efectivo esperado (lo único que debe estar físicamente en caja) */}
              <div className="px-4 py-3 bg-exito/5 border-t border-exito/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-exito">Efectivo esperado en caja</p>
                    <p className="text-xs text-suave mt-0.5">
                      Apertura + ventas efectivo − gastos
                      {resumen.totalTransferencia > 0 && ' (sin contar transferencias)'}
                    </p>
                  </div>
                  <p className="moneda font-bold text-lg text-exito shrink-0 ml-2">
                    {formatCOP(resumen.efectivoEsperado)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Display del monto contado */}
          <div className="text-center">
            <p className="text-sm text-suave mb-1">Efectivo contado en caja</p>
            <p className="moneda font-bold text-4xl text-texto">
              {efectivoContado ? formatCOP(montoCierre) : '$0'}
            </p>

            {/* Diferencia */}
            {efectivoContado && resumen && (
              <div className={`flex items-center justify-center gap-1.5 mt-2 text-sm font-medium ${
                diferencia === 0 ? 'text-exito' : diferenciaGrande ? 'text-peligro' : 'text-advertencia'
              }`}>
                {diferencia === 0 ? (
                  <><CheckCircle size={14} /> Cuadra perfectamente</>
                ) : diferenciaGrande ? (
                  <><AlertTriangle size={14} /> Diferencia: {diferencia > 0 ? '+' : ''}{formatCOP(diferencia)}</>
                ) : (
                  <><AlertTriangle size={14} /> Diferencia: {diferencia > 0 ? '+' : ''}{formatCOP(diferencia)}</>
                )}
              </div>
            )}
          </div>

          {/* Teclado numérico */}
          <TecladoNumerico valor={efectivoContado} onChange={setEfectivoContado} />

          {/* Notas opcionales */}
          <div>
            <label className="text-sm font-medium text-texto block mb-1">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones del cierre…"
              rows={2}
              className="w-full px-3 py-2 border border-borde rounded-xl text-sm text-texto
                         focus:outline-none focus:ring-2 focus:ring-primario/40 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3 shrink-0 border-t border-borde pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 border border-borde text-texto rounded-xl
                       font-semibold hover:bg-gray-50 active:scale-95 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!puedeConfirmar || cerrando}
            className="flex-1 h-12 bg-peligro text-white rounded-xl
                       font-display font-bold text-base
                       hover:opacity-90 active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cerrando ? 'Cerrando…' : 'Cerrar caja'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Fila de desglose ─────────────────────────────────────────────────────────

function FilaCierre({
  icon,
  label,
  valor,
  colorValor,
  nota,
  negativo = false,
}: {
  icon: React.ReactNode
  label: string
  valor: number
  colorValor: string
  nota?: string
  negativo?: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-texto">{label}</p>
        {nota && <p className="text-xs text-suave/70">{nota}</p>}
      </div>
      <span className={`moneda font-semibold text-sm shrink-0 ${colorValor}`}>
        {negativo && valor > 0 ? '-' : ''}{formatCOP(valor)}
      </span>
    </div>
  )
}
