import { useState, useEffect } from 'react'
import { Users, Plus, AlertCircle, Info } from 'lucide-react'
import { useNomina } from '../hooks/useNomina'
import { ListaEmpleados } from '../components/nomina/ListaEmpleados'
import { FormEmpleado } from '../components/nomina/FormEmpleado'
import { checkAlertasNomina } from '../lib/notificaciones'

export default function NominaPage() {
  const [mostrarForm, setMostrarForm] = useState(false)
  const { empleados } = useNomina()
  const [alertas, setAlertas] = useState<Awaited<ReturnType<typeof checkAlertasNomina>>>([])

  useEffect(() => {
    checkAlertasNomina().then(setAlertas)
  }, [])

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

      <main className="flex-1 overflow-y-auto p-4 relative flex flex-col gap-4">
        {alertas.length > 0 && (
          <div className="flex flex-col gap-2">
            {alertas.map(a => (
              <div 
                key={a.id} 
                className={`p-3 rounded-xl border flex items-start gap-3 ${
                  a.tipo === 'warning' 
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-800' 
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {a.tipo === 'warning' ? <AlertCircle size={18} /> : <Info size={18} />}
                </div>
                <div>
                  <h4 className="font-bold text-sm tracking-tight">{a.titulo}</h4>
                  <p className="text-xs mt-0.5 opacity-90 leading-snug">{a.mensaje}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <ListaEmpleados />
      </main>

      {mostrarForm && (
        <FormEmpleado onClose={() => setMostrarForm(false)} />
      )}
    </div>
  )
}
