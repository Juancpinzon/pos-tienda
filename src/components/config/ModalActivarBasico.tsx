// Modal para ingresar un código de activación del Plan Básico (Modo Demo).

import { useState } from 'react'
import { X, Unlock, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { activarPlanBasico, useConfig } from '../../hooks/useConfig'

interface Props {
  onClose: () => void
}

// Número de WhatsApp del desarrollador (placeholder — cambiar por el real)
const NUMERO_DESARROLLADOR = '573001234567'

export function ModalActivarBasico({ onClose }: Props) {
  const config = useConfig()
  const [codigo, setCodigo] = useState('')
  const [cargando, setCargando] = useState(false)

  const nombreTienda = config?.nombreTienda ?? 'Mi Tienda'

  const handleActivar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codigo.trim()) return
    setCargando(true)
    const ok = await activarPlanBasico(codigo)
    setCargando(false)
    if (ok) {
      toast.success('¡POS activado! — uso ilimitado habilitado')
      onClose()
    } else {
      toast.error('Código inválido. Verifica e intenta de nuevo')
    }
  }

  const urlWhatsApp = `https://wa.me/${NUMERO_DESARROLLADOR}?text=${encodeURIComponent(
    `Hola! Quiero activar el POS Tienda.\nTienda: ${nombreTienda}`
  )}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 fill-mode-both duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-borde">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primario/10 flex items-center justify-center">
              <Unlock size={16} className="text-primario" />
            </div>
            <h2 className="font-display font-bold text-base text-texto">Activar POS Tienda</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl
                       text-suave hover:text-texto hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="px-5 py-5 flex flex-col gap-4">
          <p className="text-sm text-suave leading-relaxed">
            Ingresa tu código de activación para habilitar el uso ilimitado de tu POS y remover las restricciones de Modo Demo.
          </p>

          <form onSubmit={handleActivar} className="flex flex-col gap-3">
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="TIENDA2025"
              maxLength={30}
              autoFocus
              className="w-full h-12 px-4 border border-borde rounded-xl text-sm font-mono
                         font-semibold text-texto tracking-widest text-center uppercase
                         focus:outline-none focus:ring-2 focus:ring-primario/40 focus:border-primario
                         placeholder:text-suave placeholder:font-normal placeholder:tracking-normal"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 border border-borde text-suave rounded-xl
                           text-sm font-semibold hover:bg-gray-50 active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cargando || !codigo.trim()}
                className="flex-1 h-11 bg-primario text-white rounded-xl
                           text-sm font-semibold flex items-center justify-center gap-2
                           hover:bg-primario-hover active:scale-95 transition-all
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Unlock size={14} />
                {cargando ? 'Activando…' : 'Activar'}
              </button>
            </div>
          </form>

          {/* Contactar */}
          <div className="border-t border-borde pt-4">
            <p className="text-xs text-suave text-center mb-2 font-medium">¿No tienes código?</p>
            <a
              href={urlWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-10 w-full
                         bg-green-500 text-white rounded-xl text-sm font-semibold
                         hover:bg-green-600 active:scale-95 transition-all shadow-sm"
            >
              <MessageCircle size={15} />
              Contactar por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
