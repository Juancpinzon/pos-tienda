import { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { useNomina } from '../../hooks/useNomina'
import { formatCOP } from '../../utils/moneda'
import type { Empleado, LiquidacionPrestaciones } from '../../db/schema'

interface Props {
  empleado: Empleado
  onClose: () => void
}

export function PrestacionesEmpleado({ empleado, onClose }: Props) {
  const { calcularPrestacionesEmpleado, registrarPagoPrestacion } = useNomina()
  const [prestaciones, setPrestaciones] = useState<LiquidacionPrestaciones[]>([])
  const [cargando, setCargando] = useState(true)

  const añoActual = new Date().getFullYear()

  useEffect(() => {
    cargarPrestaciones()
  }, [empleado.id])

  const cargarPrestaciones = async () => {
    setCargando(true)
    const datos = await calcularPrestacionesEmpleado(empleado.id!, añoActual)
    setPrestaciones(datos)
    setCargando(false)
  }

  // Estado para el modal de pago
  const [prestacionAPagar, setPrestacionAPagar] = useState<LiquidacionPrestaciones | null>(null)
  const [montoPago, setMontoPago] = useState<number>(0)
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])

  const abrirModalPago = (p: LiquidacionPrestaciones) => {
    setPrestacionAPagar(p)
    setMontoPago(p.monto)
    setFechaPago(new Date().toISOString().split('T')[0])
  }

  const handlePagar = async () => {
    if (!prestacionAPagar) return
    await registrarPagoPrestacion({
      ...prestacionAPagar,
      monto: montoPago,
      fechaPago: new Date(fechaPago + 'T12:00:00'),
    })
    setPrestacionAPagar(null)
    cargarPrestaciones()
  }

  const getNombresTipo = (tipo: string, periodo: string) => {
    switch (tipo) {
      case 'prima': return `Prima ${periodo.split('-')[1]}`
      case 'cesantias': return 'Cesantías'
      case 'intereses_cesantias': return 'Intereses Cesantías'
      case 'vacaciones': return 'Vacaciones'
      default: return tipo
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 px-2 sm:px-4 pb-4 sm:pb-0">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b border-borde shrink-0">
          <div>
            <h2 className="font-display font-bold text-lg text-texto">Prestaciones {añoActual}</h2>
            <p className="text-xs text-suave">{empleado.nombre}</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-fondo rounded-full text-suave">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {cargando ? (
            <p className="text-center text-suave text-sm p-4">Calculando prestaciones...</p>
          ) : prestaciones.length === 0 ? (
            <p className="text-center text-suave text-sm p-4">No hay prestaciones calculables para este período.</p>
          ) : (
            prestaciones.map((p, idx) => (
              <div key={p.id || idx} className="bg-fondo border border-borde rounded-xl p-4 flex flex-col gap-2 relative">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-texto uppercase text-sm tracking-wide">
                      {getNombresTipo(p.tipo, p.periodo)}
                    </h3>
                    <p className="text-xs text-suave mt-0.5">
                      Base: {formatCOP(p.baseCalculo)} • Días: {p.diasCalculo}
                    </p>
                  </div>
                  {p.estado === 'pagado' ? (
                    <span className="flex items-center gap-1 bg-verde/10 text-verde px-2 py-1 rounded text-xs font-bold">
                      <Check size={12} /> Pagado
                    </span>
                  ) : (
                    <span className="bg-yellow-500/10 text-yellow-700 px-2 py-1 rounded text-xs font-bold">
                      Pendiente
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xl font-display font-bold text-primario">
                    {formatCOP(p.monto)}
                  </div>
                  {p.estado === 'pendiente' && (
                    <button 
                      onClick={() => abrirModalPago(p)}
                      className="px-3 py-1.5 bg-primario text-white text-xs font-bold rounded-lg hover:bg-primario/90 transition-colors"
                    >
                      Registrar pago
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sub-modal de confirmación de pago */}
      {prestacionAPagar && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <header className="p-4 border-b border-borde relative">
              <h3 className="font-display font-bold text-texto text-center">Registrar Pago</h3>
              <button onClick={() => setPrestacionAPagar(null)} className="absolute right-4 top-4 text-suave">
                <X size={18} />
              </button>
            </header>
            <div className="p-4 flex flex-col gap-4">
              <div className="text-center">
                <p className="text-sm font-medium text-texto">
                  {getNombresTipo(prestacionAPagar.tipo, prestacionAPagar.periodo)}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-suave uppercase ml-1">Monto Pagado</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suave/50">$</span>
                  <input 
                    type="number"
                    value={montoPago || ''}
                    onChange={e => setMontoPago(Number(e.target.value))}
                    className="w-full bg-fondo border border-borde rounded-xl pl-8 pr-4 py-2 text-texto focus:border-primario outline-none text-right font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-suave uppercase ml-1">Fecha de Pago</label>
                <input 
                  type="date"
                  value={fechaPago}
                  onChange={e => setFechaPago(e.target.value)}
                  className="w-full bg-fondo border border-borde rounded-xl px-3 py-2 text-texto focus:border-primario outline-none"
                />
              </div>

              <button 
                onClick={handlePagar}
                className="w-full py-3 bg-primario text-white rounded-xl font-bold mt-2"
              >
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
