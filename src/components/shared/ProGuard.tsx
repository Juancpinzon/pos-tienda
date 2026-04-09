// Guard que oculta contenido exclusivo del Plan Pro a usuarios del Plan Básico.
// Uso:
//   <ProGuard mostrarUpgrade>
//     <PanelDomicilios />
//   </ProGuard>

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { usePlan } from '../../hooks/useConfig'
import { ModalActivarPro } from '../config/ModalActivarPro'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode   // Qué mostrar si es Básico (por defecto null)
  mostrarUpgrade?: boolean     // Mostrar banner de upgrade (default: false)
}

export function ProGuard({ children, fallback, mostrarUpgrade = false }: Props) {
  const { esPro } = usePlan()
  const [modalAbierto, setModalAbierto] = useState(false)

  if (esPro) return <>{children}</>

  if (fallback) return <>{fallback}</>

  if (!mostrarUpgrade) return null

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-4 p-6
                      bg-fondo rounded-2xl border-2 border-dashed border-borde text-center">
        <div className="w-14 h-14 rounded-2xl bg-acento/10 flex items-center justify-center">
          <span className="text-3xl">🛵</span>
        </div>
        <div>
          <p className="font-display font-bold text-texto text-base">Función exclusiva Plan Pro</p>
          <p className="text-suave text-sm mt-1 leading-relaxed max-w-xs">
            Gestiona domicilios, catálogo público y vista del repartidor
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className="flex items-center gap-2 h-11 px-5 bg-acento text-white
                     rounded-xl font-semibold text-sm
                     hover:bg-acento-hover active:scale-95 transition-all"
        >
          <Lock size={15} />
          Activar Plan Pro
        </button>
      </div>

      {modalAbierto && <ModalActivarPro onClose={() => setModalAbierto(false)} />}
    </>
  )
}
