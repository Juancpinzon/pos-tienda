// Diálogo de confirmación reutilizable — reemplaza window.confirm()
// REGLA: usar este componente para todas las acciones destructivas

import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  titulo: string
  mensaje: string
  labelConfirmar?: string
  labelCancelar?: string
  peligroso?: boolean       // true = botón confirmar en rojo
  onConfirmar: () => void
  onCancelar: () => void
}

export function ConfirmDialog({
  titulo,
  mensaje,
  labelConfirmar = 'Confirmar',
  labelCancelar  = 'Cancelar',
  peligroso      = true,
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">

        {/* Icono + título */}
        <div className="px-6 pt-6 pb-4 flex flex-col items-center gap-3 text-center">
          <div className={[
            'w-14 h-14 rounded-full flex items-center justify-center',
            peligroso ? 'bg-peligro/10' : 'bg-advertencia/10',
          ].join(' ')}>
            <AlertTriangle size={28} className={peligroso ? 'text-peligro' : 'text-advertencia'} />
          </div>
          <h2 className="font-display font-bold text-lg text-texto">{titulo}</h2>
          <p className="text-sm text-suave leading-relaxed">{mensaje}</p>
        </div>

        {/* Botones */}
        <div className="flex border-t border-borde">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 h-12 text-sm font-semibold text-texto
                       hover:bg-fondo transition-colors border-r border-borde"
          >
            {labelCancelar}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className={[
              'flex-1 h-12 text-sm font-bold transition-colors',
              peligroso
                ? 'text-peligro hover:bg-peligro/5'
                : 'text-primario hover:bg-primario/5',
            ].join(' ')}
          >
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}
