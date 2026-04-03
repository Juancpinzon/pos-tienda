import { useState, useRef, useEffect } from 'react'
import { X, Send, Loader2, Sparkles, User, BotMessageSquare } from 'lucide-react'
import { consultarIA } from '../../lib/asistente'

export function AsistenteIA() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<{ rol: 'user' | 'ia'; texto: string }[]>([])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const finMensajesRef = useRef<HTMLDivElement>(null)

  const EJEMPLOS = [
    '¿Qué producto me deja más plata?',
    '¿Quién me debe hace más tiempo?',
    '¿Qué productos agotados debo surtir urgente?',
  ]

  // Auto-scroll al final del chat
  useEffect(() => {
    finMensajesRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, cargando])

  const prenderGpt = () => {
    setAbierto(true)
    if (mensajes.length === 0) {
      setMensajes([{ rol: 'ia', texto: '¡Quiubo! Soy su asistente de ventas. ¿En qué le puedo colaborar hoy mi pez?' }])
    }
  }

  const enviarPregunta = async (pregunta: string) => {
    if (!pregunta.trim() || cargando) return

    const nuevoMensaje = pregunta.trim()
    setInput('')
    setMensajes((prev) => [...prev, { rol: 'user', texto: nuevoMensaje }])
    setCargando(true)

    try {
      const respuesta = await consultarIA(nuevoMensaje)
      setMensajes((prev) => [...prev, { rol: 'ia', texto: respuesta }])
    } catch (error) {
      setMensajes((prev) => [...prev, { rol: 'ia', texto: 'Uy qué pena, falló la conexión. Intente otra vez.' }])
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      {/* Botón flotante siempre visible */}
      {!abierto && (
        <button
          type="button"
          onClick={prenderGpt}
          className="fixed bottom-6 right-6 z-40 bg-primario text-white pl-4 pr-5 py-3 
                     rounded-full font-semibold shadow-lg hover:-translate-y-1 hover:shadow-xl
                     transition-transform flex items-center gap-2 group"
        >
          <BotMessageSquare size={20} className="group-hover:animate-bounce" />
          Preguntarle a la IA
        </button>
      )}

      {/* Ventana de chat */}
      {abierto && (
        <div className="fixed bottom-6 right-6 w-full max-w-[340px] bg-white rounded-2xl shadow-2xl 
                        z-50 border border-borde overflow-hidden flex flex-col h-[500px] sm:max-h-[85vh]">
          
          {/* Header */}
          <div className="bg-primario text-white p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <BotMessageSquare size={20} />
              <span className="font-semibold text-sm">Asistente de Tienda</span>
            </div>
            <button 
              type="button" 
              onClick={() => setAbierto(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body de mensajes */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50/50">
            {mensajes.map((m, i) => (
              <div 
                key={i} 
                className={['flex flex-col max-w-[85%]', m.rol === 'user' ? 'self-end bg-primario/10 rounded-2xl rounded-tr-sm ml-auto p-3' : 'self-start bg-white border border-borde/70 rounded-2xl rounded-tl-sm shadow-sm p-3'].join(' ')}
              >
                <div className="flex items-center gap-1.5 mb-1 opacity-60">
                  {m.rol === 'user' ? <User size={12} /> : <Sparkles size={12} />}
                  <span className="text-[10px] font-bold uppercase">{m.rol === 'user' ? 'Tú' : 'IA'}</span>
                </div>
                <p className="text-[13px] text-texto whitespace-pre-line leading-relaxed">
                  {m.texto}
                </p>
              </div>
            ))}
            
            {cargando && (
              <div className="self-start bg-white border border-borde/70 rounded-2xl rounded-tl-sm p-3 shadow-sm flex items-center gap-2 text-suave">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs font-medium">Analizando negocio...</span>
              </div>
            )}
            <div ref={finMensajesRef} />
          </div>

          {/* Sugerencias pre-hechas (si no hay muchos mensajes) */}
          {mensajes.length <= 1 && !cargando && (
            <div className="px-4 pb-2 pt-1 flex flex-col gap-1.5 bg-gray-50/50 shrink-0">
              {EJEMPLOS.map((ej, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => enviarPregunta(ej)}
                  className="text-xs bg-white border border-borde text-suave hover:text-primario 
                             hover:border-primario/40 text-left p-2 rounded-lg transition-colors"
                >
                  "{ej}"
                </button>
              ))}
            </div>
          )}

          {/* Footer - Input */}
          <form 
            onSubmit={(e) => { e.preventDefault(); enviarPregunta(input); }} 
            className="p-3 bg-white border-t border-borde flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escriba su pregunta..."
              disabled={cargando}
              className="flex-1 h-10 px-3 border border-borde rounded-xl text-sm focus:outline-none focus:border-primario focus:ring-1 focus:ring-primario"
            />
            <button
              type="submit"
              disabled={!input.trim() || cargando}
              className="w-10 h-10 flex items-center justify-center bg-primario text-white rounded-xl disabled:opacity-50 hover:bg-primario-hover transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
