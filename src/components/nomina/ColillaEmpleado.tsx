import { useState, useEffect } from 'react'
import { X, Download, MessageCircle, FileText, Loader2 } from 'lucide-react'
import type { PeriodoNomina, Empleado } from '../../db/schema'
import { obtenerConfig } from '../../hooks/useConfig'
import {
  generarColillaHTML,
  generarTextoColilla,
  generarColillaPDF,
  descargarColillaPDF,
  compartirColillaWhatsApp
} from '../../lib/nominaPDF'

interface Props {
  empleado: Empleado
  periodo: PeriodoNomina
  onClose: () => void
}

export function ColillaEmpleado({ empleado, periodo, onClose }: Props) {
  const [html, setHtml] = useState<string | null>(null)
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const [compartiendo, setCompartiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const config = await obtenerConfig()
      if (cancelled) return
      const htmlDoc = generarColillaHTML(empleado, periodo, config)
      setHtml(htmlDoc)
    }
    init().catch((e) => setError(e instanceof Error ? e.message : 'Error al generar la colilla'))
    return () => { cancelled = true }
  }, [empleado, periodo])

  const handleDescargarPDF = async () => {
    if (!html) return
    setGenerandoPDF(true)
    setError(null)
    try {
      const blob = await generarColillaPDF(html)
      descargarColillaPDF(blob, `colilla-${empleado.nombre.replace(/\s+/g, '-')}-${periodo.fechaInicio.getTime()}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally {
      setGenerandoPDF(false)
    }
  }

  const handleWhatsApp = async () => {
    setCompartiendo(true)
    try {
      const config = await obtenerConfig()
      const texto = generarTextoColilla(empleado, periodo, config)
      compartirColillaWhatsApp(texto)
    } finally {
      setCompartiendo(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 px-2 sm:px-4 pb-4 sm:pb-0">
      <div className="bg-white w-full sm:max-w-md rounded-2xl shadow-xl flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-borde shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primario/10 rounded-xl flex items-center justify-center">
              <FileText size={16} className="text-primario" />
            </div>
            <div>
              <p className="font-display font-bold text-sm text-texto leading-none">
                Colilla de Pago
              </p>
              <p className="text-[11px] text-suave mt-0.5">{empleado.nombre}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-suave hover:text-texto hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Preview iframe */}
        <div className="flex-1 overflow-y-auto p-3 bg-gray-50 min-h-0 flex items-center justify-center">
          {!html && !error && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <Loader2 size={24} className="animate-spin text-primario" />
              <p className="text-sm text-suave">Generando colilla…</p>
            </div>
          )}
          {error && (
            <div className="p-4 bg-peligro/10 border border-peligro/30 rounded-xl text-sm text-peligro text-center">
              {error}
            </div>
          )}
          {html && (
            <iframe
              srcDoc={html}
              title="Vista previa colilla"
              className="rounded-xl border border-borde shadow-sm bg-white"
              style={{ width: '380px', minHeight: '580px', height: 'auto', maxWidth: '100%' }}
              scrolling="no"
              onLoad={(e) => {
                const el = e.currentTarget
                el.style.height = (el.contentWindow?.document.body.scrollHeight ?? 580) + 'px'
              }}
            />
          )}
        </div>

        {/* Acciones */}
        <div className="p-4 border-t border-borde flex flex-col gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDescargarPDF}
            disabled={!html || generandoPDF}
            className="w-full h-11 bg-primario text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primario-hover active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generandoPDF ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {generandoPDF ? 'Generando PDF…' : '⬇️ Descargar PDF'}
          </button>

          <button
            type="button"
            onClick={handleWhatsApp}
            disabled={!html || compartiendo}
            className="w-full h-11 bg-[#25D366] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MessageCircle size={16} />
            {compartiendo ? 'Abriendo WhatsApp…' : '📱 Compartir por WhatsApp'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 border border-borde text-texto rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
