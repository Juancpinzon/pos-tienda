import { useState } from 'react'
import { useNomina } from '../../hooks/useNomina'
import { formatCOP } from '../../utils/moneda'
import { User, Briefcase, Calendar, Calculator, Wallet, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { FormEmpleado } from './FormEmpleado'
import { NuevaNomina } from './NuevaNomina'
import { PrestacionesEmpleado } from './PrestacionesEmpleado'
import type { Empleado } from '../../db/schema'

export function ListaEmpleados() {
  const { empleados, archivarEmpleado } = useNomina()
  const [empleadoActivo, setEmpleadoActivo] = useState<Empleado | null>(null)
  const [empleadoPrestaciones, setEmpleadoPrestaciones] = useState<Empleado | null>(null)
  const [empleadoEditando, setEmpleadoEditando] = useState<number | null>(null)
  const [empleadoBorrando, setEmpleadoBorrando] = useState<Empleado | null>(null)

  const handleBorrar = async () => {
    if (empleadoBorrando?.id) {
      await archivarEmpleado(empleadoBorrando.id)
      toast.success('Empleado archivado correctamente')
      setEmpleadoBorrando(null)
    }
  }

  if (!empleados) {
    return <div className="text-center p-8 text-suave text-sm">Cargando empleados...</div>
  }

  if (empleados.length === 0) {
    return (
      <div className="text-center p-12 bg-white rounded-xl border border-borde/50">
        <div className="w-16 h-16 bg-primario/5 rounded-full flex items-center justify-center mx-auto mb-4 text-primario/40">
          <User size={32} />
        </div>
        <h3 className="font-display font-bold text-lg text-texto mb-1">Sin empleados</h3>
        <p className="text-sm text-suave max-w-[250px] mx-auto">
          Registra a tus empleados para calcular sus prestaciones y generar colillas de pago.
        </p>
      </div>
    )
  }

  const getAntiguedad = (fecha: Date) => {
    const diff = new Date().getTime() - fecha.getTime()
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (dias < 30) return `${dias} días`
    const meses = Math.floor(dias / 30)
    if (meses < 12) return `${meses} meses`
    const años = Math.floor(meses / 12)
    return `${años} años`
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {empleados.map((emp) => (
          <div key={emp.id} className="bg-white border border-borde rounded-xl p-3 flex items-center justify-between active:scale-[0.98] transition-transform">
            <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-primario/10 flex flex-col items-center justify-center text-primario shrink-0">
              <span className="text-sm font-bold uppercase">{emp.nombre.substring(0, 2)}</span>
            </div>
            <div className="flex flex-col justify-center">
              <p className="font-bold text-texto text-sm">{emp.nombre}</p>
              <div className="flex items-center gap-2 text-xs text-suave">
                <span className="flex items-center gap-0.5">
                  <Briefcase size={12} />
                  {emp.cargo || 'Sin cargo'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-0.5" title={emp.fechaIngreso.toLocaleDateString()}>
                  <Calendar size={12} />
                  {getAntiguedad(emp.fechaIngreso)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="moneda font-bold text-primario text-sm">{formatCOP(emp.salario)}</p>
              <p className="text-[10px] text-suave uppercase">/ mes</p>
            </div>
            <button 
              onClick={() => setEmpleadoPrestaciones(emp)}
              className="p-2 bg-acento/10 text-acento hover:bg-acento hover:text-white rounded-lg transition-colors ml-2"
              title="Ver Prestaciones"
            >
              <Wallet size={18} />
            </button>
            <button 
              onClick={() => setEmpleadoActivo(emp)}
              className="p-2 bg-primario/10 text-primario hover:bg-primario hover:text-white rounded-lg transition-colors ml-2 border border-transparent shadow-sm"
              title="Liquidar Nómina"
            >
              <Calculator size={18} />
            </button>
            <div className="w-px h-6 bg-borde mx-1"></div>
            <button 
              onClick={() => setEmpleadoEditando(emp.id!)}
              className="p-1.5 text-suave hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
              title="Editar"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={() => setEmpleadoBorrando(emp)}
              className="p-1.5 text-suave hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
              title="Eliminar"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
      </div>

      {empleadoActivo && (
        <NuevaNomina 
          empleado={empleadoActivo} 
          onClose={() => setEmpleadoActivo(null)} 
        />
      )}

      {empleadoPrestaciones && (
        <PrestacionesEmpleado 
          empleado={empleadoPrestaciones} 
          onClose={() => setEmpleadoPrestaciones(null)} 
        />
      )}
      {empleadoEditando && (
        <FormEmpleado 
          empleadoId={empleadoEditando}
          onClose={() => setEmpleadoEditando(null)}
        />
      )}

      {empleadoBorrando && (
        <ConfirmDialog
          isOpen={true}
          titulo="Eliminar Empleado"
          mensaje={`¿Estás seguro de que quieres eliminar a ${empleadoBorrando.nombre}? El empleado no se borrará, solo se archivará para conservar su historial de nómina.`}
          onConfirm={handleBorrar}
          onCancel={() => setEmpleadoBorrando(null)}
        />
      )}
    </>
  )
}
