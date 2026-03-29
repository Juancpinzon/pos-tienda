import { Download, X } from 'lucide-react'
import { usePWAInstall } from '../../hooks/usePWAInstall'

/**
 * Banner flotante que aparece cuando el navegador soporta instalación PWA.
 * Se muestra automáticamente y el usuario puede instalarlo o descartarlo.
 */
export function BannerInstalacion() {
  const { puedeInstalar, instalar, descartar } = usePWAInstall()

  if (!puedeInstalar) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 z-30 sm:left-auto sm:right-6 sm:w-80
                    bg-white border border-borde rounded-2xl shadow-xl p-4 flex items-start gap-3
                    animate-in slide-in-from-bottom-4 duration-300">
      <div className="w-10 h-10 bg-primario/10 rounded-xl flex items-center justify-center shrink-0">
        <span className="text-xl">🏪</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-texto">Instalar POS Tienda</p>
        <p className="text-xs text-suave mt-0.5 mb-2">
          Instala la app para usarla sin internet y tener acceso rápido desde el escritorio
        </p>
        <button
          type="button"
          onClick={instalar}
          className="flex items-center gap-1.5 h-8 px-3 bg-primario text-white rounded-lg
                     text-xs font-semibold hover:bg-primario-hover active:scale-95 transition-all"
        >
          <Download size={13} />
          Instalar ahora
        </button>
      </div>
      <button
        type="button"
        onClick={descartar}
        className="w-7 h-7 flex items-center justify-center rounded-lg
                   text-suave hover:text-texto hover:bg-gray-100 transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}
