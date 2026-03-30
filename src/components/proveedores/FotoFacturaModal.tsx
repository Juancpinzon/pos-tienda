// Modal para capturar foto de factura y extraer productos con OCR (Claude Vision)

import { useRef, useState } from 'react'
import { X, Camera, ImagePlus, Loader2, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react'
import { analizarFactura, fileABase64, type ItemOCR } from '../../lib/ocr'
import { formatCOP } from '../../utils/moneda'
import type { ItemCompra } from '../../hooks/useProveedores'

interface FotoFacturaModalProps {
  onAgregar: (items: ItemCompra[]) => void
  onClose: () => void
}

type Estado = 'captura' | 'analizando' | 'resultados' | 'error'

export function FotoFacturaModal({ onAgregar, onClose }: FotoFacturaModalProps) {
  const inputFileRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [estado, setEstado] = useState<Estado>('captura')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Resultados del OCR con selección
  const [itemsOCR, setItemsOCR] = useState<(ItemOCR & { seleccionado: boolean })[]>([])

  // ── Seleccionar imagen ──────────────────────────────────────────────────────
  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivo(file)
    setPreviewUrl(URL.createObjectURL(file))
    setEstado('captura')
    setErrorMsg(null)
    setItemsOCR([])
  }

  // ── Analizar con OCR ───────────────────────────────────────────────────────
  const handleAnalizar = async () => {
    if (!archivo) return
    setEstado('analizando')
    setErrorMsg(null)

    try {
      const { base64, mimeType } = await fileABase64(archivo)
      const productos = await analizarFactura(base64, mimeType)

      if (productos.length === 0) {
        setErrorMsg('No se encontraron productos en la imagen. Intenta con una foto más clara.')
        setEstado('error')
        return
      }

      setItemsOCR(productos.map((p) => ({ ...p, seleccionado: true })))
      setEstado('resultados')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setErrorMsg(msg)
      setEstado('error')
    }
  }

  // ── Editar item de resultado ───────────────────────────────────────────────
  const actualizarItem = (idx: number, campo: keyof ItemOCR, valor: string) => {
    setItemsOCR((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item
        const num = campo === 'nombreProducto' ? valor : Math.max(0, Number(valor) || 0)
        const actualizado = { ...item, [campo]: num }
        if (campo === 'cantidad' || campo === 'precioUnitario') {
          actualizado.subtotal = Math.round(
            (campo === 'cantidad' ? Number(valor) : item.cantidad) *
            (campo === 'precioUnitario' ? Number(valor) : item.precioUnitario)
          )
        }
        return actualizado
      })
    )
  }

  const toggleSeleccion = (idx: number) => {
    setItemsOCR((prev) =>
      prev.map((item, i) => i === idx ? { ...item, seleccionado: !item.seleccionado } : item)
    )
  }

  const eliminarItem = (idx: number) => {
    setItemsOCR((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Agregar al pedido ──────────────────────────────────────────────────────
  const handleAgregar = () => {
    const seleccionados = itemsOCR
      .filter((i) => i.seleccionado && i.nombreProducto && i.precioUnitario > 0)
      .map(({ nombreProducto, cantidad, precioUnitario, subtotal }): ItemCompra => ({
        nombreProducto,
        cantidad,
        precioUnitario,
        subtotal,
      }))

    if (seleccionados.length === 0) return
    onAgregar(seleccionados)
    onClose()
  }

  const itemsSeleccionados = itemsOCR.filter((i) => i.seleccionado)
  const totalSeleccionados = itemsSeleccionados.reduce((s, i) => s + i.subtotal, 0)

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-fondo">

      {/* Header */}
      <div className="bg-white border-b border-borde px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-suave
                     hover:text-texto hover:bg-fondo transition-colors"
        >
          <X size={20} />
        </button>
        <div className="flex-1">
          <h2 className="font-display font-bold text-texto text-base leading-tight">
            Foto de factura
          </h2>
          <p className="text-xs text-suave">El sistema extrae los productos automáticamente</p>
        </div>
        {estado === 'resultados' && itemsSeleccionados.length > 0 && (
          <span className="text-xs font-semibold text-primario bg-primario/10 px-2 py-1 rounded-lg">
            {itemsSeleccionados.length} seleccionados
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* ── Zona de captura ─────────────────────────────────────────────── */}
        {(estado === 'captura' || estado === 'analizando') && (
          <>
            {/* Preview de imagen */}
            {previewUrl ? (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                <img
                  src={previewUrl}
                  alt="Factura"
                  className="w-full h-full object-contain"
                />
                {estado === 'analizando' && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                    <Loader2 size={40} className="text-white animate-spin" />
                    <p className="text-white font-semibold text-sm">Analizando factura…</p>
                    <p className="text-white/70 text-xs text-center px-6">
                      Claude está leyendo los productos, cantidades y precios
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Zona vacía para tomar foto */
              <button
                type="button"
                onClick={() => inputFileRef.current?.click()}
                className="aspect-[4/3] rounded-xl border-2 border-dashed border-borde
                           flex flex-col items-center justify-center gap-3
                           bg-white hover:bg-fondo hover:border-primario/40 transition-colors"
              >
                <div className="w-16 h-16 bg-primario/10 rounded-2xl flex items-center justify-center">
                  <Camera size={32} className="text-primario" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-texto text-sm">Tomar foto de la factura</p>
                  <p className="text-xs text-suave mt-1">o seleccionar desde la galería</p>
                </div>
              </button>
            )}

            {/* Botones de acción */}
            <div className="flex flex-col gap-2">
              {previewUrl && estado !== 'analizando' && (
                <button
                  type="button"
                  onClick={handleAnalizar}
                  className="h-12 bg-primario text-white rounded-xl font-display font-bold text-base
                             flex items-center justify-center gap-2
                             hover:bg-primario-hover active:scale-[0.98] transition-all"
                >
                  <Camera size={18} />
                  Analizar factura
                </button>
              )}

              <button
                type="button"
                onClick={() => inputFileRef.current?.click()}
                disabled={estado === 'analizando'}
                className="h-11 border border-borde text-texto rounded-xl text-sm font-semibold
                           flex items-center justify-center gap-2
                           hover:bg-fondo transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ImagePlus size={16} />
                {previewUrl ? 'Cambiar imagen' : 'Seleccionar imagen'}
              </button>
            </div>
          </>
        )}

        {/* ── Estado: error ────────────────────────────────────────────────── */}
        {estado === 'error' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="w-16 h-16 bg-peligro/10 rounded-2xl flex items-center justify-center">
              <AlertCircle size={32} className="text-peligro" />
            </div>
            <div>
              <p className="font-semibold text-texto">No se pudo analizar</p>
              <p className="text-sm text-suave mt-1 max-w-xs mx-auto">{errorMsg}</p>
            </div>
            <button
              type="button"
              onClick={() => setEstado('captura')}
              className="h-11 px-6 border border-borde text-texto rounded-xl text-sm font-semibold
                         hover:bg-fondo transition-colors"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* ── Resultados del OCR ───────────────────────────────────────────── */}
        {estado === 'resultados' && (
          <>
            {/* Mini preview de la imagen */}
            {previewUrl && (
              <div className="flex items-center gap-3 bg-white rounded-xl border border-borde p-3">
                <img
                  src={previewUrl}
                  alt="Factura"
                  className="w-16 h-16 object-cover rounded-lg shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-texto">
                    {itemsOCR.length} productos detectados
                  </p>
                  <p className="text-xs text-suave mt-0.5">
                    Revisa y ajusta antes de agregar al pedido
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setEstado('captura'); setItemsOCR([]) }}
                  className="text-xs text-primario font-semibold hover:underline shrink-0"
                >
                  Nueva foto
                </button>
              </div>
            )}

            {/* Lista editable de productos */}
            <div className="bg-white rounded-xl border border-borde overflow-hidden">
              <div className="px-4 py-2.5 border-b border-borde/50 flex items-center">
                <span className="text-sm font-semibold text-texto flex-1">
                  Productos extraídos
                </span>
                <button
                  type="button"
                  onClick={() => setItemsOCR((prev) => prev.map((i) => ({ ...i, seleccionado: true })))}
                  className="text-xs text-primario hover:underline"
                >
                  Seleccionar todos
                </button>
              </div>

              <div className="divide-y divide-borde/30">
                {itemsOCR.map((item, idx) => (
                  <div key={idx} className={[
                    'p-3 flex gap-3 transition-colors',
                    item.seleccionado ? '' : 'opacity-50',
                  ].join(' ')}>

                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleSeleccion(idx)}
                      className={[
                        'w-5 h-5 rounded border-2 shrink-0 mt-1 flex items-center justify-center transition-colors',
                        item.seleccionado
                          ? 'bg-primario border-primario'
                          : 'border-borde',
                      ].join(' ')}
                    >
                      {item.seleccionado && (
                        <CheckCircle2 size={12} className="text-white" />
                      )}
                    </button>

                    {/* Campos editables */}
                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                      <input
                        type="text"
                        value={item.nombreProducto}
                        onChange={(e) => actualizarItem(idx, 'nombreProducto', e.target.value)}
                        className="w-full h-9 px-2.5 border border-borde rounded-lg text-sm text-texto
                                   focus:outline-none focus:ring-1 focus:ring-primario/40"
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[10px] text-suave block mb-0.5">Cant.</label>
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => actualizarItem(idx, 'cantidad', e.target.value)}
                            min={0.01}
                            step={0.01}
                            className="w-full h-8 px-2 border border-borde rounded-lg text-sm moneda text-texto
                                       focus:outline-none focus:ring-1 focus:ring-primario/40"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-suave block mb-0.5">Precio unit. ($)</label>
                          <input
                            type="number"
                            value={item.precioUnitario}
                            onChange={(e) => actualizarItem(idx, 'precioUnitario', e.target.value)}
                            min={0}
                            className="w-full h-8 px-2 border border-borde rounded-lg text-sm moneda text-texto
                                       focus:outline-none focus:ring-1 focus:ring-primario/40"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-suave text-right moneda">
                        Subtotal: <span className="font-semibold text-texto">{formatCOP(item.subtotal)}</span>
                      </p>
                    </div>

                    {/* Eliminar */}
                    <button
                      type="button"
                      onClick={() => eliminarItem(idx)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg mt-1
                                 text-suave hover:text-peligro hover:bg-peligro/5 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Input de archivo oculto */}
      <input
        ref={inputFileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleArchivoChange}
      />

      {/* Footer con botón agregar */}
      {estado === 'resultados' && (
        <div className="bg-white border-t border-borde p-4 shrink-0">
          <button
            type="button"
            onClick={handleAgregar}
            disabled={itemsSeleccionados.length === 0}
            className="w-full h-14 bg-primario text-white rounded-xl font-display font-bold text-base
                       hover:bg-primario-hover active:scale-[0.98] transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={20} />
            {itemsSeleccionados.length > 0
              ? `Agregar ${itemsSeleccionados.length} producto${itemsSeleccionados.length > 1 ? 's' : ''} · ${formatCOP(totalSeleccionados)}`
              : 'Selecciona al menos un producto'}
          </button>
        </div>
      )}
    </div>
  )
}
