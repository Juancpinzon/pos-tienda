// Página de gestión de domicilios
// Accesible para dueño y encargado

import { PanelDomicilios } from '../components/domicilios/PanelDomicilios'

export default function DomiciliosPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 pt-4 pb-2">
        <h1 className="font-display font-bold text-xl text-texto flex items-center gap-2">
          🛵 Domicilios
        </h1>
        <p className="text-sm text-suave mt-0.5">Pedidos activos e historial de entregas</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <PanelDomicilios />
      </div>
    </div>
  )
}
