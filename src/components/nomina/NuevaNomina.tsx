import { useState, useEffect } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { useNomina } from '../../hooks/useNomina'
import { calcularDeduccionesSS } from '../../utils/nomina'
import { formatCOP } from '../../utils/moneda'
import type { Empleado, AdelantoEmpleado, PeriodoNomina } from '../../db/schema'
import { startOfMonth, endOfMonth, setDate, format } from 'date-fns'
import { db } from '../../db/database'
import { ColillaEmpleado } from './ColillaEmpleado'

interface Props {
  empleado: Empleado
  onClose: () => void
}

export function NuevaNomina({ empleado, onClose }: Props) {
  const { crearPeriodoNomina, getAdelantosPendientes, smmlv } = useNomina()
  
  const [tipo, setTipo] = useState<'quincenal' | 'mensual'>('quincenal')
  // Pre-fill dates based on current day and 'tipo'
  const hoy = new Date()
  const esPrimeraQuincena = hoy.getDate() <= 15
  
  const [fechaInicio, setFechaInicio] = useState(
    format(tipo === 'quincenal' && !esPrimeraQuincena ? setDate(hoy, 16) : startOfMonth(hoy), 'yyyy-MM-dd')
  )
  const [fechaFin, setFechaFin] = useState(
    format(tipo === 'quincenal' && esPrimeraQuincena ? setDate(hoy, 15) : endOfMonth(hoy), 'yyyy-MM-dd')
  )
  
  const [diasTrabajados, setDiasTrabajados] = useState<number>(15)
  const [bonificaciones, setBonificaciones] = useState<number>(0)
  
  const [adelantos, setAdelantos] = useState<AdelantoEmpleado[]>([])
  
  useEffect(() => {
    getAdelantosPendientes(empleado.id!).then(setAdelantos)
  }, [empleado.id, getAdelantosPendientes])
  
  // Handlers for 'tipo' change
  useEffect(() => {
    const hoy = new Date(fechaInicio || new Date())
    if (tipo === 'mensual') {
      setDiasTrabajados(30)
      setFechaInicio(format(startOfMonth(hoy), 'yyyy-MM-dd'))
      setFechaFin(format(endOfMonth(hoy), 'yyyy-MM-dd'))
    } else {
      setDiasTrabajados(15)
      // Defaults to current quincena if switching to quincenal
      const isFirst = new Date().getDate() <= 15
      setFechaInicio(format(isFirst ? startOfMonth(new Date()) : setDate(new Date(), 16), 'yyyy-MM-dd'))
      setFechaFin(format(isFirst ? setDate(new Date(), 15) : endOfMonth(new Date()), 'yyyy-MM-dd'))
    }
  }, [tipo]) // Only re-run when 'tipo' changes, ignore other deps to avoid circular updates

  // Real-time calculation
  // Base period salary proportional to days worked
  const proporcionDias = diasTrabajados / 30
  const salarioPeriodo = empleado.salario * proporcionDias
  const devengado = salarioPeriodo + bonificaciones
  
  const deduccionesSS = calcularDeduccionesSS(empleado.salario * proporcionDias, smmlv)
  const totalAdelantos = adelantos.reduce((acc, a) => acc + a.monto, 0)
  const otrasDeduciones = totalAdelantos // Can be extended
  
  const totalDeducciones = deduccionesSS.total + otrasDeduciones
  const netoAPagar = devengado - totalDeducciones

  const [guardando, setGuardando] = useState(false)
  const [periodoGenerado, setPeriodoGenerado] = useState<PeriodoNomina | null>(null)

  const handleGuardar = async (estado: 'borrador' | 'pagado') => {
    setGuardando(true)
    try {
      const periodoId = await crearPeriodoNomina({
        empleadoId: empleado.id!,
        tipo,
        fechaInicio: new Date(fechaInicio + 'T12:00:00'),
        fechaFin: new Date(fechaFin + 'T12:00:00'),
        salarioBase: empleado.salario,
        diasTrabajados,
        bonificaciones,
        deduccionSalud: deduccionesSS.salud,
        deduccionPension: deduccionesSS.pension,
        otrasDeduciones,
        totalDevengado: devengado,
        totalDeducciones,
        netoAPagar,
        estado,
        fechaPago: estado === 'pagado' ? new Date() : undefined,
      })

      // Update adelantos to mark as discounted if we included them
      if (adelantos.length > 0) {
        // Run a custom transaction or multiple updates
        // For simplicity, we just update them mapping over them
        await Promise.all(adelantos.map(a => 
          db.adelantosEmpleado.update(a.id!, { descontadoEn: Number(periodoId) })
        ))
      }
      
      if (estado === 'pagado') {
        const pGuardado = await db.periodosNomina.get(periodoId as number)
        if (pGuardado) {
          setPeriodoGenerado(pGuardado)
          return // no hacemos onClose aun, mostramos la colilla
        }
      }

      onClose()
    } catch (error) {
      console.error(error)
      alert("Error al guardar la nómina")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 px-2 sm:px-4 pb-4 sm:pb-0">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b border-borde shrink-0">
          <div>
            <h2 className="font-display font-bold text-lg text-texto">Generar Nómina</h2>
            <p className="text-xs text-suave text-left">{empleado.nombre} • {formatCOP(empleado.salario)}/mes</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-fondo rounded-full text-suave">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          <div className="flex bg-fondo p-1 rounded-xl">
            <button
              onClick={() => setTipo('quincenal')}
              className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${tipo === 'quincenal' ? 'bg-white text-primario shadow-sm' : 'text-suave'}`}
            >
              Quincenal
            </button>
            <button
              onClick={() => setTipo('mensual')}
              className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${tipo === 'mensual' ? 'bg-white text-primario shadow-sm' : 'text-suave'}`}
            >
              Mensual
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-suave uppercase ml-1">Días Trabajados</label>
              <input 
                type="number"
                value={diasTrabajados}
                onChange={e => setDiasTrabajados(Number(e.target.value))}
                className="w-full bg-fondo border border-borde rounded-xl px-3 py-2 text-texto focus:border-primario outline-none"
                min="1" max="31"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-suave uppercase ml-1">Fecha Inicio</label>
              <input 
                type="date"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
                className="w-full bg-fondo border border-borde rounded-xl px-2 py-2 text-xs text-texto focus:border-primario outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-suave uppercase ml-1">Fecha Fin</label>
              <input 
                type="date"
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
                className="w-full bg-fondo border border-borde rounded-xl px-2 py-2 text-xs text-texto focus:border-primario outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-suave uppercase ml-1">Bonificaciones (Opcional)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suave/50">$</span>
              <input 
                type="number"
                value={bonificaciones || ''}
                onChange={e => setBonificaciones(Number(e.target.value))}
                placeholder="0"
                className="w-full bg-fondo border border-borde rounded-xl pl-8 pr-4 py-2 text-texto focus:border-primario outline-none"
              />
            </div>
          </div>

          {adelantos.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-yellow-800">Adelantos pendientes</p>
                <p className="text-xs text-yellow-700">Se descontarán automáticamente {formatCOP(totalAdelantos)} correspondientes a {adelantos.length} adelanto(s).</p>
              </div>
            </div>
          )}

          <div className="bg-fondo border border-borde rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primario/5 rounded-full -translate-y-16 translate-x-16 blur-2xl"></div>
            
            <div className="flex justify-between text-sm">
              <span className="text-suave">Salario proporcional</span>
              <span className="font-medium text-texto">{formatCOP(salarioPeriodo)}</span>
            </div>
            {bonificaciones > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-suave">Bonificaciones</span>
                <span className="font-medium text-acento">+{formatCOP(bonificaciones)}</span>
              </div>
            )}
            <div className="w-full h-px bg-borde/60 my-1"></div>
            <div className="flex justify-between text-sm">
              <span className="text-suave">Salud (4%)</span>
              <span className="font-medium text-peligro">-{formatCOP(deduccionesSS.salud)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-suave">Pensión (4%)</span>
              <span className="font-medium text-peligro">-{formatCOP(deduccionesSS.pension)}</span>
            </div>
            {totalAdelantos > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-suave">Adelantos</span>
                <span className="font-medium text-peligro">-{formatCOP(totalAdelantos)}</span>
              </div>
            )}
            
            <div className="w-full h-px bg-borde my-2"></div>
            <div className="flex justify-between items-end">
              <span className="text-sm font-bold text-texto uppercase tracking-wide">Neto a pagar</span>
              <span className="text-2xl font-display font-bold text-primario">{formatCOP(netoAPagar)}</span>
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-borde flex gap-2 shrink-0">
          <button 
            type="button" 
            onClick={() => handleGuardar('borrador')} 
            disabled={guardando}
            className="flex-1 py-3 text-texto bg-fondo rounded-xl font-bold border border-borde disabled:opacity-50"
          >
            Borrador
          </button>
          <button 
            type="button" 
            onClick={() => handleGuardar('pagado')}
            disabled={guardando}
            className="flex-1 py-3 bg-primario text-white rounded-xl font-bold disabled:opacity-50"
          >
            Marcar pagado
          </button>
        </div>
      </div>

      {/* Si se generó el periodo pagado, montamos el modal de la colilla encima */}
      {periodoGenerado && (
        <ColillaEmpleado 
          empleado={empleado} 
          periodo={periodoGenerado}
          onClose={() => {
            setPeriodoGenerado(null)
            onClose() // cerramos todo
          }}
        />
      )}
    </div>
  )
}
