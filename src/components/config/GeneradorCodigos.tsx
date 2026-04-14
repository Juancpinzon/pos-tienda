import { useState, useEffect } from 'react'
import { Key, Copy, RefreshCw, X, Clock } from 'lucide-react'
import { generarCodigoCliente } from '../../utils/codigos'
import toast from 'react-hot-toast'

const STORAGE_KEY = 'pos_codigos_admin'

interface EntradaHistorial {
  cliente: string
  codigo: string
  plan: string
  fecha: string
}

interface Props {
  onCerrar: () => void
}

export function GeneradorCodigos({ onCerrar }: Props) {
  const [plan, setPlan]       = useState<'basico' | 'pro' | 'upgrade'>('basico')
  const [codigo, setCodigo]   = useState('')
  const [cliente, setCliente] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [historial, setHistorial] = useState<EntradaHistorial[]>([])

  // Cargar historial y generar primer código al montar
  useEffect(() => {
    const guardado = localStorage.getItem(STORAGE_KEY)
    if (guardado) {
      try { setHistorial(JSON.parse(guardado)) } catch { /* ignorar */ }
    }
    generarNuevo()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function generarNuevo() {
    setCodigo(generarCodigoCliente(plan))
    setCopiado(false)
  }

  // Regenerar cuando cambia el plan
  useEffect(() => {
    if (codigo) generarNuevo()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan])

  async function copiarYGuardar() {
    if (!codigo) return
    try {
      await navigator.clipboard.writeText(codigo)
    } catch {
      toast.error('Error al copiar')
      return
    }

    const entrada: EntradaHistorial = {
      cliente: cliente.trim() || 'Sin nombre',
      codigo,
      plan,
      fecha: new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }),
    }
    const nuevo = [entrada, ...historial].slice(0, 20)
    setHistorial(nuevo)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevo))
    setCopiado(true)
    toast.success('Código copiado y guardado')
  }

  async function copiarDelHistorial(cod: string) {
    try {
      await navigator.clipboard.writeText(cod)
      toast.success('Copiado')
    } catch {
      toast.error('Error al copiar')
    }
  }

  const labelPlan = { basico: 'Básico', pro: 'Pro', upgrade: 'Upgrade' }

  return (
    <section>
      <p className="text-xs font-semibold text-suave uppercase tracking-wider mb-3 flex items-center justify-between gap-1.5">
        <span className="flex items-center gap-1.5 text-acento">
          <Key size={13} />
          Generador de Códigos (Admin)
        </span>
        <button
          type="button"
          onClick={onCerrar}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-suave
                     hover:bg-gray-100 hover:text-texto transition-colors"
          aria-label="Cerrar generador"
        >
          <X size={14} />
        </button>
      </p>

      <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 flex flex-col gap-4">
        {/* Selector de plan */}
        <div className="flex gap-2">
          {(['basico', 'pro', 'upgrade'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlan(p)}
              className={[
                'h-10 flex-1 rounded-xl text-sm font-semibold border transition-all',
                plan === p
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-white text-amber-700 border-amber-200 hover:border-amber-400',
              ].join(' ')}
            >
              {labelPlan[p]}
            </button>
          ))}
        </div>

        {/* Código generado */}
        <div>
          <p className="text-xs text-amber-800 font-medium mb-1">Código generado:</p>
          <div className="flex items-center justify-between p-3 bg-white border border-amber-300 rounded-xl">
            <span className="font-mono font-bold text-amber-900 text-lg tracking-widest">
              {codigo || '—'}
            </span>
            {copiado && (
              <span className="text-xs font-semibold text-exito">✓ Copiado</span>
            )}
          </div>
        </div>

        {/* Cliente (memo interno) */}
        <div>
          <label className="text-xs text-amber-800 font-medium mb-1 block">
            Cliente (memo interno — opcional)
          </label>
          <input
            type="text"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="Ej: Tienda Don Pepito"
            className="w-full h-10 px-3 border border-amber-200 rounded-xl text-sm text-amber-900 bg-white
                       focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500
                       placeholder:text-amber-300"
          />
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={generarNuevo}
            className="flex-1 h-10 bg-white border border-amber-300 text-amber-800 rounded-xl text-sm font-semibold
                       flex items-center justify-center gap-2 hover:bg-amber-100 active:scale-95 transition-all"
          >
            <RefreshCw size={14} />
            Nuevo
          </button>
          <button
            type="button"
            onClick={copiarYGuardar}
            disabled={!codigo}
            className="flex-1 h-10 bg-amber-600 text-white rounded-xl text-sm font-semibold
                       flex items-center justify-center gap-2 hover:bg-amber-700 active:scale-95 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Copy size={14} />
            Copiar y guardar
          </button>
        </div>

        {/* Historial */}
        {historial.length > 0 && (
          <div>
            <p className="text-xs text-amber-800 font-medium mb-2 flex items-center gap-1.5">
              <Clock size={11} />
              Historial (últimos {historial.length})
            </p>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {historial.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => copiarDelHistorial(h.codigo)}
                  title="Tocar para copiar"
                  className="flex items-center justify-between px-3 py-2 bg-white border border-amber-100
                             rounded-lg text-left hover:border-amber-300 hover:bg-amber-50 transition-colors
                             active:scale-[0.98]"
                >
                  <span className="font-mono text-xs font-bold text-amber-900 tracking-wider">{h.codigo}</span>
                  <span className="text-[10px] text-amber-600 ml-2 shrink-0">{h.plan}</span>
                  <span className="text-[10px] text-amber-500 ml-2 truncate max-w-[90px]">{h.cliente}</span>
                  <span className="text-[10px] text-amber-400 ml-2 shrink-0">{h.fecha}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
