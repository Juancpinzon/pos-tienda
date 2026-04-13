import { useState } from 'react'
import { Key, Copy, RefreshCw } from 'lucide-react'
import { generarCodigoCliente } from '../../utils/codigos'
import toast from 'react-hot-toast'

export function GeneradorCodigos() {
  const [planSelected, setPlanSelected] = useState<"basico" | "pro" | "upgrade">("basico")
  const [codigoGenerado, setCodigoGenerado] = useState<string>("")
  const [memoCliente, setMemoCliente] = useState<string>("")

  const btnClass = "h-10 flex-1 rounded-xl text-sm font-semibold border transition-all"
  
  const handleGenerar = () => {
    const nuevoCodigo = generarCodigoCliente(planSelected)
    setCodigoGenerado(nuevoCodigo)
  }

  const handleCopiar = async () => {
    if (!codigoGenerado) return
    let copyText = codigoGenerado
    if (memoCliente.trim()) {
      copyText += ` (Cliente: ${memoCliente.trim()})`
    }
    
    try {
      await navigator.clipboard.writeText(copyText)
      toast.success('Código copiado')
    } catch {
      toast.error('Error al copiar')
    }
  }

  return (
    <section>
      <p className="text-xs font-semibold text-suave uppercase tracking-wider mb-3 flex items-center gap-1.5 text-acento">
        <Key size={13} />
        Generador de Códigos (Admin)
      </p>

      <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 flex flex-col gap-4">
        {/* Selector de Plan */}
        <div className="flex gap-2">
          {(['basico', 'pro', 'upgrade'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlanSelected(p)}
              className={[
                btnClass,
                planSelected === p
                  ? "bg-amber-500 text-white border-amber-600"
                  : "bg-white text-amber-700 border-amber-200 hover:border-amber-300"
              ].join(" ")}
            >
              {p === 'basico' ? 'Básico' : p === 'pro' ? 'Pro' : 'Upgrade'}
            </button>
          ))}
        </div>

        {/* Código Generado */}
        <div>
          <p className="text-xs text-amber-800 font-medium mb-1">Código generado:</p>
          <div className="flex items-center justify-between p-3 bg-white border border-amber-300 rounded-xl">
            <span className="font-mono font-bold text-amber-900 text-lg">
              {codigoGenerado || '—'}
            </span>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleGenerar}
            className="flex-1 h-10 bg-white border border-amber-300 text-amber-800 rounded-xl text-sm font-semibold
                       flex items-center justify-center gap-2 hover:bg-amber-100 active:scale-95 transition-all"
          >
            <RefreshCw size={14} />
            Generar nuevo
          </button>
          <button
            type="button"
            onClick={handleCopiar}
            disabled={!codigoGenerado}
            className="flex-1 h-10 bg-amber-600 text-white rounded-xl text-sm font-semibold
                       flex items-center justify-center gap-2 hover:bg-amber-600 active:scale-95 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Copy size={14} />
            Copiar
          </button>
        </div>

        {/* Memo Cliente */}
        <div>
          <label className="text-xs text-amber-800 font-medium mb-1 block">
            Cliente (memo interno opcional)
          </label>
          <input
            type="text"
            value={memoCliente}
            onChange={(e) => setMemoCliente(e.target.value)}
            placeholder="Ej: Tienda Don Pepito"
            className="w-full h-10 px-3 border border-amber-200 rounded-xl text-sm text-amber-900 bg-white
                       focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500
                       placeholder:text-amber-300"
          />
        </div>
      </div>
    </section>
  )
}
