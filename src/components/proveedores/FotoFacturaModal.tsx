// FotoFacturaModal.tsx
// Modal OCR + mapeo inteligente de SKUs.
//
// Flujo post-OCR:
//   Para cada producto detectado:
//     1. Buscar en mapeosSKU → si hay mapeo exacto: pre-asociar automáticamente
//     2. Si no hay: mostrar buscador con sugerencias del catálogo
//     3. Checkbox "Recordar asociación" (default: true)
//   Al confirmar: guardar todos los mapeos nuevos marcados

import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Camera, ImagePlus, Loader2, AlertCircle, CheckCircle2, Trash2, Link2, Search } from 'lucide-react'
import { analizarFactura, fileABase64, type ItemOCR } from '../../lib/ocr'
import { buscarMapeo, guardarMapeo, sugerirProducto, type SugerenciaProducto } from '../../lib/mapeoSKU'
import { formatCOP } from '../../utils/moneda'
import type { ItemCompra } from '../../hooks/useProveedores'
import type { Producto } from '../../db/schema'

interface FotoFacturaModalProps {
  onAgregar: (items: ItemCompra[]) => void
  onClose: () => void
}

type Estado = 'captura' | 'analizando' | 'resultados' | 'error'

// Un ítem enriquecido con datos de mapeo
interface ItemEnriquecido extends ItemOCR {
  seleccionado: boolean
  // Producto del catálogo asociado (si se encontró o eligió)
  productoAsociado: Producto | null
  // Nombre que vino del mapeo guardado (para badge)
  vinoDeMapa: boolean
  // Si el usuario quiere guardar la asociación
  recordar: boolean
  // Sugerencias del catálogo para este ítem
  sugerencias: SugerenciaProducto[]
  // Controlando el buscador de sugerencias
  busquedaAbierta: boolean
  queryBusqueda: string
}

// ─── Buscador de producto para una línea ─────────────────────────────────────

function BuscadorAsociacion({
  item,
  idx,
  onAsociar,
  onQueryChange,
}: {
  item: ItemEnriquecido
  idx: number
  onAsociar: (idx: number, producto: Producto | null) => void
  onQueryChange: (idx: number, q: string) => void
}) {
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-suave pointer-events-none" />
        <input
          type="text"
          value={item.queryBusqueda}
          onChange={(e) => onQueryChange(idx, e.target.value)}
          placeholder="Buscar en catálogo…"
          className="w-full h-8 pl-8 pr-3 border border-borde rounded-lg text-xs text-texto
                     focus:outline-none focus:ring-1 focus:ring-primario/40"
        />
      </div>

      {/* Sugerencias */}
      {item.sugerencias.length > 0 && (
        <div className="bg-white border border-borde rounded-lg overflow-hidden shadow-sm">
          {item.sugerencias.map((s) => (
            <button
              key={s.producto.id}
              type="button"
              onClick={() => onAsociar(idx, s.producto)}
              className="w-full flex items-center justify-between px-3 py-2
                         hover:bg-fondo transition-colors text-left border-b last:border-0 border-borde/40"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-texto truncate">{s.producto.nombre}</span>
                {s.desdeMapa && (
                  <span className="text-[10px] text-primario font-semibold flex items-center gap-0.5">
                    <Link2 size={9} /> Mapeo guardado
                  </span>
                )}
              </div>
              <span className="moneda text-xs text-suave shrink-0 ml-2">
                {s.producto.precioCompra ? formatCOP(s.producto.precioCompra) : '—'}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onAsociar(idx, null)}
            className="w-full px-3 py-2 text-left text-xs text-suave hover:bg-fondo transition-colors"
          >
            No asociar a ningún producto
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Modal principal ──────────────────────────────────────────────────────────

export function FotoFacturaModal({ onAgregar, onClose }: FotoFacturaModalProps) {
  const inputFileRef = useRef<HTMLInputElement>(null)
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null)
  const [archivo,     setArchivo]     = useState<File | null>(null)
  const [estado,      setEstado]      = useState<Estado>('captura')
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null)
  const [items,       setItems]       = useState<ItemEnriquecido[]>([])

  // ── Seleccionar imagen ──────────────────────────────────────────────────────
  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivo(file)
    setPreviewUrl(URL.createObjectURL(file))
    setEstado('captura')
    setErrorMsg(null)
    setItems([])
  }

  // ── Enriquecer resultados OCR con mapeos ────────────────────────────────────
  const enriquecerConMapeos = useCallback(async (crudos: ItemOCR[]): Promise<ItemEnriquecido[]> => {
    return Promise.all(
      crudos.map(async (p) => {
        // Buscar mapeo guardado
        const mapeo = await buscarMapeo(p.nombreProducto)
        let productoAsociado: Producto | null = null
        let vinoDeMapa = false

        if (mapeo) {
          // Verificar que el producto sigue existiendo
          const { db } = await import('../../db/database')
          const prod = await db.productos.get(mapeo.productoId)
          if (prod?.activo) {
            productoAsociado = prod
            vinoDeMapa = true
          }
        }

        // Sugerencias del catálogo (para cuando no hay mapeo o el usuario quiere cambiar)
        const sugerencias = await sugerirProducto(p.nombreProducto, 4)

        return {
          ...p,
          seleccionado: true,
          productoAsociado,
          vinoDeMapa,
          recordar: true,          // Por defecto: guardar la asociación
          sugerencias,
          busquedaAbierta: !productoAsociado,  // Abrir buscador si no hay mapeo
          queryBusqueda: '',
        }
      })
    )
  }, [])

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

      const enriquecidos = await enriquecerConMapeos(productos)
      setItems(enriquecidos)
      setEstado('resultados')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido')
      setEstado('error')
    }
  }

  // ── Actualizar campo de texto (nombre, cantidad, precio) ────────────────────
  const actualizarCampo = (idx: number, campo: keyof ItemOCR, valor: string) => {
    setItems((prev) =>
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
        // Si cambia el nombre, limpiar la asociación y recalcular sugerencias
        if (campo === 'nombreProducto') {
          actualizado.productoAsociado = null
          actualizado.vinoDeMapa = false
          // Actualizar sugerencias async
          sugerirProducto(valor, 4).then((sugs) => {
            setItems((prev2) =>
              prev2.map((it, j) => j === i ? { ...it, sugerencias: sugs } : it)
            )
          })
        }
        return actualizado
      })
    )
  }

  // ── Asociar / desasociar producto ───────────────────────────────────────────
  const handleAsociar = (idx: number, producto: Producto | null) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, productoAsociado: producto, vinoDeMapa: false, busquedaAbierta: false, queryBusqueda: '' }
          : item
      )
    )
  }

  // ── Actualizar query de búsqueda y recalcular sugerencias ───────────────────
  const handleQueryChange = (idx: number, q: string) => {
    setItems((prev) =>
      prev.map((item, i) => i === idx ? { ...item, queryBusqueda: q } : item)
    )
    // Buscar sugerencias con el texto que está escribiendo
    const texto = q.trim() || items[idx]?.nombreProducto
    sugerirProducto(texto, 4).then((sugs) => {
      setItems((prev) =>
        prev.map((item, i) => i === idx ? { ...item, sugerencias: sugs } : item)
      )
    })
  }

  // ── Toggles ─────────────────────────────────────────────────────────────────
  const toggleSeleccion = (idx: number) =>
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, seleccionado: !it.seleccionado } : it))

  const toggleRecordar = (idx: number) =>
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, recordar: !it.recordar } : it))

  const eliminarItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx))

  // ── Confirmar y guardar mapeos ──────────────────────────────────────────────
  const handleAgregar = async () => {
    const seleccionados = items.filter(
      (i) => i.seleccionado && i.nombreProducto && i.precioUnitario > 0
    )

    // Guardar mapeos nuevos que el tendero quiso recordar
    await Promise.all(
      seleccionados
        .filter((i) => i.recordar && i.productoAsociado?.id !== undefined && !i.vinoDeMapa)
        .map((i) => guardarMapeo(i.nombreProducto, i.productoAsociado!.id!))
    )

    // Incrementar vecesUsado para mapeos existentes que se volvieron a usar
    await Promise.all(
      seleccionados
        .filter((i) => i.vinoDeMapa && i.productoAsociado?.id !== undefined)
        .map((i) => guardarMapeo(i.nombreProducto, i.productoAsociado!.id!))
    )

    // Construir los ItemCompra para el modal padre
    const itemsCompra: ItemCompra[] = seleccionados.map((i) => ({
      nombreProducto: i.productoAsociado?.nombre ?? i.nombreProducto,
      productoId:     i.productoAsociado?.id,
      cantidad:       i.cantidad,
      precioUnitario: i.precioUnitario,
      subtotal:       i.subtotal,
    }))

    onAgregar(itemsCompra)
    onClose()
  }

  const seleccionados    = items.filter((i) => i.seleccionado)
  const totalSeleccionados = seleccionados.reduce((s, i) => s + i.subtotal, 0)
  const autoAsociados    = items.filter((i) => i.vinoDeMapa).length
  const sinAsociar       = seleccionados.filter((i) => !i.productoAsociado).length

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-fondo">

      {/* Header */}
      <div className="bg-white border-b border-borde px-4 py-3 flex items-center gap-3 shrink-0">
        <button type="button" onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-suave
                     hover:text-texto hover:bg-fondo transition-colors">
          <X size={20} />
        </button>
        <div className="flex-1">
          <h2 className="font-display font-bold text-texto text-base leading-tight">
            Foto de factura
          </h2>
          <p className="text-xs text-suave">El sistema extrae y asocia los productos automáticamente</p>
        </div>
        {estado === 'resultados' && autoAsociados > 0 && (
          <span className="text-xs font-semibold text-exito bg-exito/10 px-2 py-1 rounded-lg flex items-center gap-1">
            <Link2 size={11} />
            {autoAsociados} auto-asignado{autoAsociados > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* ── Captura ──────────────────────────────────────────────────────── */}
        {(estado === 'captura' || estado === 'analizando') && (
          <>
            {previewUrl ? (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                <img src={previewUrl} alt="Factura" className="w-full h-full object-contain" />
                {estado === 'analizando' && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                    <Loader2 size={40} className="text-white animate-spin" />
                    <p className="text-white font-semibold text-sm">Analizando factura…</p>
                    <p className="text-white/70 text-xs text-center px-6">
                      Claude lee los productos y busca asociaciones en su historial
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <button type="button" onClick={() => inputFileRef.current?.click()}
                className="aspect-[4/3] rounded-xl border-2 border-dashed border-borde
                           flex flex-col items-center justify-center gap-3
                           bg-white hover:bg-fondo hover:border-primario/40 transition-colors">
                <div className="w-16 h-16 bg-primario/10 rounded-2xl flex items-center justify-center">
                  <Camera size={32} className="text-primario" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-texto text-sm">Tomar foto de la factura</p>
                  <p className="text-xs text-suave mt-1">o seleccionar desde la galería</p>
                </div>
              </button>
            )}

            <div className="flex flex-col gap-2">
              {previewUrl && estado !== 'analizando' && (
                <button type="button" onClick={handleAnalizar}
                  className="h-12 bg-primario text-white rounded-xl font-display font-bold text-base
                             flex items-center justify-center gap-2
                             hover:bg-primario-hover active:scale-[0.98] transition-all">
                  <Camera size={18} />
                  Analizar factura
                </button>
              )}
              <button type="button" onClick={() => inputFileRef.current?.click()}
                disabled={estado === 'analizando'}
                className="h-11 border border-borde text-texto rounded-xl text-sm font-semibold
                           flex items-center justify-center gap-2
                           hover:bg-fondo transition-colors disabled:opacity-40">
                <ImagePlus size={16} />
                {previewUrl ? 'Cambiar imagen' : 'Seleccionar imagen'}
              </button>
            </div>
          </>
        )}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {estado === 'error' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="w-16 h-16 bg-peligro/10 rounded-2xl flex items-center justify-center">
              <AlertCircle size={32} className="text-peligro" />
            </div>
            <div>
              <p className="font-semibold text-texto">No se pudo analizar</p>
              <p className="text-sm text-suave mt-1 max-w-xs mx-auto">{errorMsg}</p>
            </div>
            <button type="button" onClick={() => setEstado('captura')}
              className="h-11 px-6 border border-borde text-texto rounded-xl text-sm font-semibold
                         hover:bg-fondo transition-colors">
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* ── Resultados con mapeos ─────────────────────────────────────────── */}
        {estado === 'resultados' && (
          <>
            {/* Mini preview */}
            {previewUrl && (
              <div className="flex items-center gap-3 bg-white rounded-xl border border-borde p-3">
                <img src={previewUrl} alt="Factura" className="w-14 h-14 object-cover rounded-lg shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-texto">{items.length} productos detectados</p>
                  {autoAsociados > 0 && (
                    <p className="text-xs text-exito font-medium flex items-center gap-1 mt-0.5">
                      <Link2 size={11} />
                      {autoAsociados} reconocido{autoAsociados > 1 ? 's' : ''} del historial
                    </p>
                  )}
                  {sinAsociar > 0 && (
                    <p className="text-xs text-advertencia mt-0.5">
                      {sinAsociar} sin asociar al catálogo
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => { setEstado('captura'); setItems([]) }}
                  className="text-xs text-primario font-semibold hover:underline shrink-0">
                  Nueva foto
                </button>
              </div>
            )}

            {/* Lista de ítems */}
            <div className="bg-white rounded-xl border border-borde overflow-hidden">
              <div className="px-4 py-2.5 border-b border-borde/50 flex items-center">
                <span className="text-sm font-semibold text-texto flex-1">Productos extraídos</span>
                <button type="button"
                  onClick={() => setItems((prev) => prev.map((i) => ({ ...i, seleccionado: true })))}
                  className="text-xs text-primario hover:underline">
                  Seleccionar todos
                </button>
              </div>

              <div className="divide-y divide-borde/30">
                {items.map((item, idx) => (
                  <div key={idx} className={['p-3 flex gap-3 transition-colors', item.seleccionado ? '' : 'opacity-50'].join(' ')}>

                    {/* Checkbox selección */}
                    <button type="button" onClick={() => toggleSeleccion(idx)}
                      className={[
                        'w-5 h-5 rounded border-2 shrink-0 mt-1 flex items-center justify-center transition-colors',
                        item.seleccionado ? 'bg-primario border-primario' : 'border-borde',
                      ].join(' ')}>
                      {item.seleccionado && <CheckCircle2 size={12} className="text-white" />}
                    </button>

                    {/* Contenido */}
                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                      {/* Nombre OCR (editable) */}
                      <input type="text" value={item.nombreProducto}
                        onChange={(e) => actualizarCampo(idx, 'nombreProducto', e.target.value)}
                        className="w-full h-9 px-2.5 border border-borde rounded-lg text-sm text-texto
                                   focus:outline-none focus:ring-1 focus:ring-primario/40" />

                      {/* Cantidad y precio */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[10px] text-suave block mb-0.5">Cant.</label>
                          <input type="number" value={item.cantidad} min={0.01} step={0.01}
                            onChange={(e) => actualizarCampo(idx, 'cantidad', e.target.value)}
                            className="w-full h-8 px-2 border border-borde rounded-lg text-sm moneda
                                       focus:outline-none focus:ring-1 focus:ring-primario/40" />
                        </div>
                        <div>
                          <label className="text-[10px] text-suave block mb-0.5">Precio unit. ($)</label>
                          <input type="number" value={item.precioUnitario} min={0}
                            onChange={(e) => actualizarCampo(idx, 'precioUnitario', e.target.value)}
                            className="w-full h-8 px-2 border border-borde rounded-lg text-sm moneda
                                       focus:outline-none focus:ring-1 focus:ring-primario/40" />
                        </div>
                      </div>

                      {/* Asociación al catálogo */}
                      {item.productoAsociado ? (
                        <div className={[
                          'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs',
                          item.vinoDeMapa
                            ? 'bg-exito/10 border border-exito/30 text-exito'
                            : 'bg-primario/8 border border-primario/20 text-primario',
                        ].join(' ')}>
                          <span className="flex items-center gap-1.5 font-medium truncate">
                            <Link2 size={11} className="shrink-0" />
                            {item.productoAsociado.nombre}
                          </span>
                          <button type="button"
                            onClick={() => setItems((prev) => prev.map((it, j) =>
                              j === idx ? { ...it, productoAsociado: null, vinoDeMapa: false, busquedaAbierta: true } : it
                            ))}
                            className="text-[10px] underline shrink-0 ml-2 opacity-70 hover:opacity-100">
                            cambiar
                          </button>
                        </div>
                      ) : (
                        <button type="button"
                          onClick={() => setItems((prev) => prev.map((it, j) =>
                            j === idx ? { ...it, busquedaAbierta: !it.busquedaAbierta } : it
                          ))}
                          className="text-xs text-suave hover:text-primario transition-colors text-left flex items-center gap-1">
                          <Search size={11} />
                          {item.busquedaAbierta ? 'Cerrar buscador' : 'Asociar a catálogo (opcional)'}
                        </button>
                      )}

                      {/* Buscador de catálogo */}
                      {item.busquedaAbierta && !item.productoAsociado && (
                        <BuscadorAsociacion
                          item={item}
                          idx={idx}
                          onAsociar={handleAsociar}
                          onQueryChange={handleQueryChange}
                        />
                      )}

                      {/* Checkbox "Recordar asociación" */}
                      {item.productoAsociado && !item.vinoDeMapa && (
                        <label className="flex items-center gap-2 cursor-pointer mt-0.5">
                          <input type="checkbox" checked={item.recordar}
                            onChange={() => toggleRecordar(idx)}
                            className="w-3.5 h-3.5 accent-primario" />
                          <span className="text-[11px] text-suave">
                            Recordar: "<span className="text-texto font-medium">{item.nombreProducto}</span>" = {item.productoAsociado.nombre}
                          </span>
                        </label>
                      )}

                      <p className="text-xs text-suave text-right moneda">
                        Subtotal: <span className="font-semibold text-texto">{formatCOP(item.subtotal)}</span>
                      </p>
                    </div>

                    {/* Eliminar */}
                    <button type="button" onClick={() => eliminarItem(idx)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg mt-1
                                 text-suave hover:text-peligro hover:bg-peligro/5 transition-colors shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Input oculto */}
      <input ref={inputFileRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={handleArchivoChange} />

      {/* Footer */}
      {estado === 'resultados' && (
        <div className="bg-white border-t border-borde p-4 shrink-0">
          <button type="button" onClick={handleAgregar}
            disabled={seleccionados.length === 0}
            className="w-full h-14 bg-primario text-white rounded-xl font-display font-bold text-base
                       hover:bg-primario-hover active:scale-[0.98] transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2">
            <CheckCircle2 size={20} />
            {seleccionados.length > 0
              ? `Agregar ${seleccionados.length} producto${seleccionados.length > 1 ? 's' : ''} · ${formatCOP(totalSeleccionados)}`
              : 'Selecciona al menos un producto'}
          </button>
        </div>
      )}
    </div>
  )
}
