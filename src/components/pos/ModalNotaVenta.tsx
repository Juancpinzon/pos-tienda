// ModalNotaVenta — Preview y acciones de una nota de venta
// Genera PDF descargable y comparte por WhatsApp.

import { useState, useEffect } from 'react'
import { X, Download, MessageCircle, FileText, Loader2 } from 'lucide-react'
import type { Venta, DetalleVenta } from '../../db/schema'
import { obtenerConfig } from '../../hooks/useConfig'
import { db } from '../../db/database'
import {
  generarNotaVenta,
  generarTextoNotaVenta,
  generarPDF,
  descargarPDF,
  compartirNotaPorWhatsApp,
  siguienteConsecutivo,
  formatearConsecutivo,
} from '../../lib/notaVenta'

interface ModalNotaVentaProps {
  venta: Venta
  detalles: DetalleVenta[]
  nombreCliente?: string
  /** Si ya se generó antes, pasar el consecutivo guardado para no incrementar */
  consecutivoExistente?: string
  onClose: () => void
}

export function ModalNotaVenta({
  venta,
  detalles,
  nombreCliente,
  consecutivoExistente,
  onClose,
}: ModalNotaVentaProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [consecutivo, setConsecutivo] = useState<string>(consecutivoExistente ?? '')
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const [compartiendo, setCompartiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generar el HTML al montar
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const config = await obtenerConfig()

      let cod = consecutivoExistente
      if (!cod) {
        // Solo generamos un NUEVO consecutivo si no se pasó uno pre-generado
        const { codigo } = await siguienteConsecutivo()
        cod = codigo
      }

      if (cancelled) return
      setConsecutivo(cod)

      const htmlDoc = generarNotaVenta(venta, detalles, config, {
        consecutivo: cod,
        nombreCliente,
      })
      setHtml(htmlDoc)
    }

    init().catch((e) => setError(e instanceof Error ? e.message : 'Error al generar la nota'))

    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDescargarPDF = async () => {
    if (!html) return
    setGenerandoPDF(true)
    setError(null)
    try {
      const blob = await generarPDF(html)
      descargarPDF(blob, `nota-venta-${consecutivo}.pdf`)
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
      const texto = generarTextoNotaVenta(venta, detalles, config, {
        consecutivo,
        nombreCliente,
      })
      compartirNotaPorWhatsApp(texto)
    } finally {
      setCompartiendo(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-borde shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primario/10 rounded-xl flex items-center justify-center">
              <FileText size={16} className="text-primario" />
            </div>
            <div>
              <p className="font-display font-bold text-sm text-texto leading-none">
                Nota de venta
              </p>
              {consecutivo && (
                <p className="text-[11px] text-suave mt-0.5">{consecutivo}</p>
              )}
            </div>
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

        {/* Preview iframe */}
        <div className="flex-1 overflow-y-auto p-3 bg-gray-50 min-h-0">
          {!html && !error && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={24} className="animate-spin text-primario" />
              <p className="text-sm text-suave">Generando nota de venta…</p>
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
              title="Vista previa nota de venta"
              className="w-full rounded-xl border border-borde"
              style={{ minHeight: '520px', height: 'auto' }}
              scrolling="no"
              onLoad={(e) => {
                // Ajustar altura al contenido
                const el = e.currentTarget
                el.style.height = (el.contentWindow?.document.body.scrollHeight ?? 520) + 'px'
              }}
            />
          )}
        </div>

        {/* Acciones */}
        <div className="p-4 border-t border-borde flex flex-col gap-2.5 shrink-0">

          {/* Descargar PDF */}
          <button
            type="button"
            onClick={handleDescargarPDF}
            disabled={!html || generandoPDF}
            className="w-full h-11 bg-primario text-white rounded-xl font-semibold text-sm
                       flex items-center justify-center gap-2
                       hover:bg-primario-hover active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generandoPDF ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {generandoPDF ? 'Generando PDF…' : '⬇️ Descargar PDF'}
          </button>

          {/* WhatsApp */}
          <button
            type="button"
            onClick={handleWhatsApp}
            disabled={!consecutivo || compartiendo}
            className="w-full h-11 bg-[#25D366] text-white rounded-xl font-semibold text-sm
                       flex items-center justify-center gap-2
                       hover:opacity-90 active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MessageCircle size={16} />
            {compartiendo ? 'Abriendo WhatsApp…' : '📱 Compartir por WhatsApp'}
          </button>

          {/* Cerrar */}
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 border border-borde text-texto rounded-xl
                       font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Hook para obtener el consecutivo de una venta existente ──────────────────
// Usa el id de venta como referencia cuando no hay consecutivo guardado.
// El tendero puede regenerar la nota de cualquier venta pasada.

export async function obtenerConsecutivoParaVenta(ventaId: number): Promise<string> {
  // Buscar si ya hay un consecutivo guardado para esta venta
  // (en una implementación futura se podría guardar en la venta misma)
  // Por ahora, generamos un consecutivo estable basado en el ID de venta
  const cfg = await db.configFiscal.get(1)
  const prefijo = cfg?.prefijo ?? 'NV'
  return formatearConsecutivo(prefijo, ventaId)
}
