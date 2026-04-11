import { usePlan } from '../../hooks/useConfig'
import { Unlock, AlertTriangle } from 'lucide-react'

interface BannerDemoProps {
  onActivar: () => void
}

export function BannerDemo({ onActivar }: BannerDemoProps) {
  const { modoDemo, ventasRestantesDemo, esPro } = usePlan()

  if (!modoDemo || esPro) return null

  // Colores reactivos según urgencia
  let bgColor = 'bg-advertencia/10'
  let borderColor = 'border-advertencia/30'
  let textColor = 'text-advertencia'
  let iconColor = 'text-advertencia'

  if (ventasRestantesDemo <= 5) {
    bgColor = 'bg-peligro/8'
    borderColor = 'border-peligro/30'
    textColor = 'text-peligro'
    iconColor = 'text-peligro'
  } else if (ventasRestantesDemo <= 15) {
    textColor = 'text-orange-600'
    iconColor = 'text-orange-500'
  }

  return (
    <div className={`w-full ${bgColor} border-b ${borderColor} px-4 py-2 flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300`}>
      <div className="flex items-center gap-2 min-w-0">
        <div className={`shrink-0 ${ventasRestantesDemo <= 5 ? 'animate-pulse' : ''}`}>
          {ventasRestantesDemo <= 10 ? <AlertTriangle size={18} className={iconColor} /> : <Unlock size={18} className={iconColor} />}
        </div>
        <p className={`text-sm font-semibold ${textColor} truncate`}>
          🔓 Modo Demo — 
          <span className="ml-1">
            {ventasRestantesDemo === 0 
              ? 'Límite alcanzado' 
              : `Te queda${ventasRestantesDemo === 1 ? '' : 'n'} ${ventasRestantesDemo} venta${ventasRestantesDemo === 1 ? '' : 's'}`
            }
          </span>
        </p>
      </div>
      
      <button
        onClick={onActivar}
        className={`shrink-0 h-8 px-3 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm
                   ${ventasRestantesDemo <= 5 
                     ? 'bg-peligro text-white hover:bg-peligro-hover' 
                     : 'bg-primario text-white hover:bg-primario-hover'}`}
      >
        Activar ahora
      </button>
    </div>
  )
}
