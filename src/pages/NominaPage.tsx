import { useState } from 'react'
import { Users, Plus } from 'lucide-react'
import { useNomina } from '../hooks/useNomina'
import { ListaEmpleados } from '../components/nomina/ListaEmpleados'
import { FormEmpleado } from '../components/nomina/FormEmpleado'

export default function NominaPage() {
  const [mostrarForm, setMostrarForm] = useState(false)
  const { empleados } = useNomina()

  return (
    <div className="flex flex-col h-full bg-fondo">
      <header className="bg-white px-4 py-3 border-b border-borde flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primario/10 flex items-center justify-center text-primario">
            <Users size={18} />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-texto leading-none">
              Nómina
            </h1>
            <p className="text-xs text-suave">
              {empleados?.length ?? 0} empleados activos
            </p>
          </div>
        </div>
        <button
          onClick={() => setMostrarForm(true)}
          className="btn-primario py-1.5 px-3 text-sm flex items-center gap-1.5"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Nuevo empleado</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 relative">
        <ListaEmpleados />
      </main>

      {mostrarForm && (
        <FormEmpleado onClose={() => setMostrarForm(false)} />
      )}
    </div>
  )
}
