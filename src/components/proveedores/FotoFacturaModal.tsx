// FotoFacturaModal.tsx
// Modal OCR + mapeo inteligente de SKUs.
//
// Flujo post-OCR:
//   1. Detecta proveedor, número de factura y productos automáticamente
//   2. Busca el proveedor en Dexie por nombre o NIT
//   3. Para cada producto: buscar en mapeosSKU → si hay mapeo: pre-asociar
//   4. Al confirmar: crear proveedor si es nuevo y el checkbox está activo

import { useRef, useState, useCallback } from 'react'
import {
  X, Camera, ImagePlus, Loader2, AlertCircle, CheckCircle2,
  Trash2, Link2, Search, KeyRound, Truck, Plus,
} from 'lucide-react'
import { analizarFoto, type ItemOCR, type ProveedorOCR, type FacturaOCR } from '../../lib/ocr'
import { supabaseConfigurado } from '../../lib/supabase'
import { buscarMapeo, guardarMapeo, sugerirProducto, type SugerenciaProducto } from '../../lib/mapeoSKU'
import { crearProveedor } from '../../hooks/useProveedores'
import { formatCOP } from '../../utils/moneda'
import { db } from '../../db/database'
import type { ItemCompra } from '../../hooks/useProveedores'
import type { Producto, Proveedor } from '../../db/schema'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString()

// OCR disponible si hay Edge Function (Supabase) o API key directa (dev local)
const OCR_DISPONIBLE = supabaseConfigurado || !!(import.meta.env.VITE_ANTHROPIC_API_KEY)

// Traduce los códigos de error internos de ocr.ts a mensajes amigables para el tendero
function traducirError(raw: string): string {
  if (raw === 'API_KEY_MISSING')
    return 'API key no configurada. Agrega VITE_ANTHROPIC_API_KEY en las variables de entorno de Vercel y vuelve a desplegar.'
  if (raw === 'API_KEY_INVALID')
    return 'API key inválida o expirada. Verifica que la key sea correcta en Vercel → Settings → Environment Variables.'
  if (raw === 'SUPABASE_NOT_CONFIGURED')
    return 'Supabase no está configurado. Agrega las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel y vuelve a desplegar.'
  if (raw === 'NETWORK_ERROR')
    return 'Sin conexión. Verifica tu internet e intenta de nuevo.'
  if (raw === 'RATE_LIMIT')
    return 'Límite de uso de la API alcanzado. Espera unos minutos e intenta de nuevo.'
  if (raw === 'IMAGE_TOO_LARGE')
    return 'La imagen es demasiado grande para la API. Intenta con una foto de menor resolución.'
  if (raw.startsWith('API_ERROR:')) {
    const [, status, msg] = raw.split(':')
    return `Error de API (${status})${msg ? ': ' + msg : ''}. Intenta de nuevo o revisa los logs.`
  }
  return raw
}

interface FotoFacturaModalProps {
  /** Callback al confirmar: entrega los ítems y, opcionalmente, proveedor detectado y notas de factura */
  onAgregar: (
    items: ItemCompra[],
    extras?: { proveedor?: { id: number; nombre: string }; notasFactura?: string }
  ) => void
  onClose: () => void
}

type Estado = 'captura' | 'analizando' | 'resultados' | 'error'

// Un ítem enriquecido con datos de mapeo
interface ItemEnriquecido extends ItemOCR {
  seleccionado: boolean
  productoAsociado: Producto | null
  vinoDeMapa: boolean
  recordar: boolean
  sugerencias: SugerenciaProducto[]
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
  const inputCameraRef = useRef<HTMLInputElement>(null)
  const inputGalleryRef = useRef<HTMLInputElement>(null)
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null)
  const [archivo,     setArchivo]     = useState<File | null>(null)
  const [estado,      setEstado]      = useState<Estado>('captura')
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null)
  const [items,       setItems]       = useState<ItemEnriquecido[]>([])

  // Datos de proveedor y factura detectados por OCR
  const [proveedorOCR,   setProveedorOCR]   = useState<ProveedorOCR | null>(null)
  const [facturaOCR,     setFacturaOCR]     = useState<FacturaOCR | null>(null)
  // Proveedor encontrado en Dexie (null = no encontrado aún / no buscado)
  const [provExistente,  setProvExistente]  = useState<Proveedor | null | undefined>(undefined)
  // Si el tendero quiere crear/actualizar el proveedor al confirmar
  const [crearProv,      setCrearProv]      = useState(true)

  // ── Convertir PDF a Imagen ──────────────────────────────────────────────────
  const convertirPdfAImagen = async (file: File): Promise<File> => {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 2.0 })

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas no soportado')

    canvas.width = viewport.width
    canvas.height = viewport.height

    await page.render({ canvasContext: ctx, viewport }).promise

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], file.name.replace(/\.pdf$/i, '.jpg'), { type: 'image/jpeg' }))
        } else {
          reject(new Error('Error al generar imagen del PDF'))
        }
      }, 'image/jpeg', 0.9)
    })
  }

  // ── Seleccionar imagen ──────────────────────────────────────────────────────
  const handleArchivoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0]
    if (!file) return

    setEstado('analizando')
    setErrorMsg(null)

    try {
      if (file.type === 'application/pdf') {
        file = await convertirPdfAImagen(file)
      }

      setArchivo(file)
      setPreviewUrl(URL.createObjectURL(file))
      setEstado('captura')
      setItems([])
      setProveedorOCR(null)
      setFacturaOCR(null)
      setProvExistente(undefined)
      setCrearProv(true)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al procesar el archivo')
      setEstado('error')
    }
  }

  // ── Buscar proveedor en Dexie por nombre o NIT ──────────────────────────────
  const buscarProveedorLocal = useCallback(async (prov: ProveedorOCR) => {
    const lower = prov.nombre.toLowerCase().trim()
    const todos = await db.proveedores.filter((p) => p.activo).toArray()
    // Intentar match exacto o muy parecido (contiene el nombre del OCR)
    const encontrado = todos.find(
      (p) =>
        p.nombre.toLowerCase() === lower ||
        p.nombre.toLowerCase().includes(lower) ||
        lower.includes(p.nombre.toLowerCase())
    )
    setProvExistente(encontrado ?? null)
  }, [])

  // ── Enriquecer resultados OCR con mapeos ────────────────────────────────────
  const enriquecerConMapeos = useCallback(async (crudos: ItemOCR[]): Promise<ItemEnriquecido[]> => {
    return Promise.all(
      crudos.map(async (p) => {
        const mapeo = await buscarMapeo(p.nombreProducto)
        let productoAsociado: Producto | null = null
        let vinoDeMapa = false

        if (mapeo) {
          const prod = await db.productos.get(mapeo.productoId)
          if (prod?.activo) {
            productoAsociado = prod
            vinoDeMapa = true
          }
        }

        const sugerencias = await sugerirProducto(p.nombreProducto, 4)

        return {
          ...p,
          seleccionado: true,
          productoAsociado,
          vinoDeMapa,
          recordar: true,
          sugerencias,
          busquedaAbierta: !productoAsociado,
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
      const resultado = await analizarFoto(archivo)
      const { proveedor, factura, productos } = resultado

      if (productos.length === 0) {
        setErrorMsg('No se encontraron productos en la imagen. Intenta con una foto más clara.')
        setEstado('error')
        return
      }

      // Guardar datos de proveedor y factura
      setProveedorOCR(proveedor)
      setFacturaOCR(factura)

      // Buscar si el proveedor ya existe en local
      if (proveedor) {
        await buscarProveedorLocal(proveedor)
      } else {
        setProvExistente(undefined)
      }

      const enriquecidos = await enriquecerConMapeos(productos)
      setItems(enriquecidos)
      setEstado('resultados')
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      setErrorMsg(traducirError(raw))
      setEstado('error')
    }
  }

  // ── Actualizar campo de texto ───────────────────────────────────────────────
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
        if (campo === 'nombreProducto') {
          actualizado.productoAsociado = null
          actualizado.vinoDeMapa = false
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

  // ── Actualizar query de búsqueda ────────────────────────────────────────────
  const handleQueryChange = (idx: number, q: string) => {
    setItems((prev) =>
      prev.map((item, i) => i === idx ? { ...item, queryBusqueda: q } : item)
    )
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

    // Guardar mapeos nuevos
    await Promise.all(
      seleccionados
        .filter((i) => i.recordar && i.productoAsociado?.id !== undefined && !i.vinoDeMapa)
        .map((i) => guardarMapeo(i.nombreProducto, i.productoAsociado!.id!))
    )

    // Incrementar vecesUsado para mapeos existentes
    await Promise.all(
      seleccionados
        .filter((i) => i.vinoDeMapa && i.productoAsociado?.id !== undefined)
        .map((i) => guardarMapeo(i.nombreProducto, i.productoAsociado!.id!))
    )

    // Construir ItemCompra[]
    const itemsCompra: ItemCompra[] = seleccionados.map((i) => ({
      nombreProducto: i.productoAsociado?.nombre ?? i.nombreProducto,
      productoId:     i.productoAsociado?.id,
      cantidad:       i.cantidad,
      precioUnitario: i.precioUnitario,
      subtotal:       i.subtotal,
    }))

    // Resolver proveedor
    let proveedorExtra: { id: number; nombre: string } | undefined

    if (provExistente) {
      // Ya existe en Dexie → pre-seleccionarlo
      proveedorExtra = { id: provExistente.id!, nombre: provExistente.nombre }
    } else if (crearProv && proveedorOCR) {
      // Proveedor nuevo → crearlo en Dexie
      const id = await crearProveedor(proveedorOCR.nombre, {
        telefono: proveedorOCR.telefono ?? undefined,
      })
      proveedorExtra = { id, nombre: proveedorOCR.nombre }
    }

    // Notas con número de factura si se detectó
    const notasFactura = facturaOCR?.numero ? `Factura #${facturaOCR.numero}` : undefined

    onAgregar(itemsCompra, { proveedor: proveedorExtra, notasFactura })
    onClose()
  }

  const seleccionados      = items.filter((i) => i.seleccionado)
  const totalSeleccionados = seleccionados.reduce((s, i) => s + i.subtotal, 0)
  const autoAsociados      = items.filter((i) => i.vinoDeMapa).length
  const sinAsociar         = seleccionados.filter((i) => !i.productoAsociado).length

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
          <p className="text-xs text-suave">El sistema extrae proveedor y productos automáticamente</p>
        </div>
        {estado === 'resultados' && autoAsociados > 0 && (
          <span className="text-xs font-semibold text-exito bg-exito/10 px-2 py-1 rounded-lg flex items-center gap-1">
            <Link2 size={11} />
            {autoAsociados} auto
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* Banner: OCR no disponible */}
        {!OCR_DISPONIBLE && (
          <div className="flex items-start gap-3 bg-advertencia/10 border border-advertencia/40 rounded-xl p-3">
            <KeyRound size={16} className="text-advertencia shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-advertencia">OCR no disponible</p>
              <p className="text-xs text-texto/80 leading-relaxed">
                El OCR requiere Supabase configurado (producción) o{' '}
                <span className="font-mono bg-black/5 px-1 rounded">VITE_ANTHROPIC_API_KEY</span>{' '}
                (desarrollo local). Puede agregar los productos manualmente usando el formulario de abajo.
              </p>
            </div>
          </div>
        )}

        {/* ── Captura ──────────────────────────────────────────────────────── */}
        {(estado === 'captura' || estado === 'analizando') && (
          <>
            {previewUrl ? (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                <img src={previewUrl} alt="Factura" className="w-full h-full object-contain" />
                {estado === 'analizando' && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                    <Loader2 size={40} className="text-white animate-spin" />
                    <p className="text-white font-semibold text-sm">Procesando factura…</p>
                    <p className="text-white/70 text-xs text-center px-6">
                      Extrayendo proveedor, número y productos con Claude Vision
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-3">
                <button type="button" onClick={() => inputCameraRef.current?.click()}
                  className="flex-1 aspect-[4/5] sm:aspect-square rounded-xl border-2 border-dashed border-borde
                             flex flex-col items-center justify-center gap-3
                             bg-white hover:bg-fondo hover:border-primario/40 transition-colors p-2">
                  <div className="w-14 h-14 bg-primario/10 rounded-2xl flex items-center justify-center shrink-0">
                    <Camera size={28} className="text-primario" />
                  </div>
                  <div className="text-center px-1">
                    <p className="font-semibold text-texto text-sm">Tomar foto</p>
                  </div>
                </button>

                <button type="button" onClick={() => inputGalleryRef.current?.click()}
                  className="flex-1 aspect-[4/5] sm:aspect-square rounded-xl border-2 border-dashed border-borde
                             flex flex-col items-center justify-center gap-3
                             bg-white hover:bg-fondo hover:border-primario/40 transition-colors p-2">
                  <div className="w-14 h-14 bg-primario/10 rounded-2xl flex items-center justify-center shrink-0">
                    <ImagePlus size={28} className="text-primario" />
                  </div>
                  <div className="text-center px-1">
                    <p className="font-semibold text-texto text-sm">Elegir de galería</p>
                    <p className="text-[10px] text-suave mt-1 leading-tight">También acepta PDFs</p>
                  </div>
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {previewUrl && estado !== 'analizando' && (
                <button type="button" onClick={handleAnalizar}
                  disabled={!OCR_DISPONIBLE}
                  title={!OCR_DISPONIBLE ? 'Configura Supabase o VITE_ANTHROPIC_API_KEY para usar el OCR' : undefined}
                  className="h-12 bg-primario text-white rounded-xl font-display font-bold text-base
                             flex items-center justify-center gap-2
                             hover:bg-primario-hover active:scale-[0.98] transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed">
                  <Camera size={18} />
                  Analizar factura
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => inputCameraRef.current?.click()}
                  disabled={estado === 'analizando'}
                  className="h-11 border border-borde text-texto rounded-xl text-sm font-semibold
                             flex items-center justify-center gap-2
                             hover:bg-fondo transition-colors disabled:opacity-40">
                  <Camera size={16} />
                  Tomar otra
                </button>
                <button type="button" onClick={() => inputGalleryRef.current?.click()}
                  disabled={estado === 'analizando'}
                  className="h-11 border border-borde text-texto rounded-xl text-sm font-semibold
                             flex items-center justify-center gap-2
                             hover:bg-fondo transition-colors disabled:opacity-40">
                  <ImagePlus size={16} />
                  De galería
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {estado === 'error' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-16 h-16 bg-peligro/10 rounded-2xl flex items-center justify-center">
              <AlertCircle size={32} className="text-peligro" />
            </div>
            <div className="w-full">
              <p className="font-semibold text-texto mb-2">No se pudo analizar</p>
              {errorMsg && (
                <div className="bg-peligro/5 border border-peligro/20 rounded-xl px-4 py-3 text-left mx-2">
                  <p className="text-sm text-texto leading-relaxed">{errorMsg}</p>
                </div>
              )}
            </div>
            <button type="button" onClick={() => setEstado('captura')}
              className="h-11 px-6 border border-borde text-texto rounded-xl text-sm font-semibold
                         hover:bg-fondo transition-colors">
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* ── Resultados ───────────────────────────────────────────────────── */}
        {estado === 'resultados' && (
          <>
            {/* Mini preview */}
            {previewUrl && (
              <div className="flex items-center gap-3 bg-white rounded-xl border border-borde p-3">
                <img src={previewUrl} alt="Factura" className="w-14 h-14 object-cover rounded-lg shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-texto">{items.length} productos detectados</p>
                  {facturaOCR?.numero && (
                    <p className="text-xs text-suave mt-0.5">Factura #{facturaOCR.numero}</p>
                  )}
                  {facturaOCR?.fecha && (
                    <p className="text-xs text-suave">{facturaOCR.fecha}</p>
                  )}
                </div>
                <button type="button" onClick={() => { setEstado('captura'); setItems([]) }}
                  className="text-xs text-primario font-semibold hover:underline shrink-0">
                  Nueva foto
                </button>
              </div>
            )}

            {/* Proveedor detectado */}
            {proveedorOCR && (
              <div className={[
                'rounded-xl border p-3 flex flex-col gap-2',
                provExistente
                  ? 'bg-exito/5 border-exito/30'
                  : 'bg-primario/5 border-primario/20',
              ].join(' ')}>
                {/* Cabecera */}
                <div className="flex items-start gap-2">
                  <Truck size={15} className={provExistente ? 'text-exito shrink-0 mt-0.5' : 'text-primario shrink-0 mt-0.5'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-suave uppercase tracking-wide mb-0.5">
                      {provExistente ? '✅ Proveedor ya registrado' : '📦 Proveedor detectado'}
                    </p>
                    <p className="text-sm font-bold text-texto truncate">{proveedorOCR.nombre}</p>
                    {(proveedorOCR.nit || proveedorOCR.telefono) && (
                      <p className="text-xs text-suave mt-0.5 flex flex-wrap gap-x-3">
                        {proveedorOCR.nit && <span>NIT: {proveedorOCR.nit}</span>}
                        {proveedorOCR.telefono && <span>Tel: {proveedorOCR.telefono}</span>}
                      </p>
                    )}
                    {provExistente && (
                      <p className="text-xs text-exito font-medium mt-0.5">{provExistente.nombre}</p>
                    )}
                  </div>
                </div>

                {/* Checkbox crear/actualizar */}
                {!provExistente && (
                  <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-primario/10">
                    <div
                      onClick={() => setCrearProv((v) => !v)}
                      className={[
                        'w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors cursor-pointer',
                        crearProv ? 'bg-primario border-primario' : 'border-borde',
                      ].join(' ')}
                    >
                      {crearProv && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <span className="text-xs text-texto flex items-center gap-1">
                      <Plus size={11} className="text-primario" />
                      Crear este proveedor automáticamente
                    </span>
                  </label>
                )}
              </div>
            )}

            {/* Lista de ítems */}
            <div className="bg-white rounded-xl border border-borde overflow-hidden">
              <div className="px-4 py-2.5 border-b border-borde/50 flex items-center">
                <span className="text-sm font-semibold text-texto flex-1">
                  Productos extraídos
                  {autoAsociados > 0 && (
                    <span className="ml-2 text-xs font-normal text-exito">
                      · {autoAsociados} reconocido{autoAsociados > 1 ? 's' : ''}
                    </span>
                  )}
                  {sinAsociar > 0 && (
                    <span className="ml-2 text-xs font-normal text-advertencia">
                      · {sinAsociar} sin asociar
                    </span>
                  )}
                </span>
                <button type="button"
                  onClick={() => setItems((prev) => prev.map((i) => ({ ...i, seleccionado: true })))}
                  className="text-xs text-primario hover:underline">
                  Todos
                </button>
              </div>

              <div className="divide-y divide-borde/30">
                {items.map((item, idx) => (
                  <div key={idx} className={['p-3 flex gap-3 transition-colors', item.seleccionado ? '' : 'opacity-50'].join(' ')}>

                    {/* Checkbox */}
                    <button type="button" onClick={() => toggleSeleccion(idx)}
                      className={[
                        'w-5 h-5 rounded border-2 shrink-0 mt-1 flex items-center justify-center transition-colors',
                        item.seleccionado ? 'bg-primario border-primario' : 'border-borde',
                      ].join(' ')}>
                      {item.seleccionado && <CheckCircle2 size={12} className="text-white" />}
                    </button>

                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                      {/* Nombre editable */}
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

                      {item.busquedaAbierta && !item.productoAsociado && (
                        <BuscadorAsociacion
                          item={item}
                          idx={idx}
                          onAsociar={handleAsociar}
                          onQueryChange={handleQueryChange}
                        />
                      )}

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

      {/* Inputs ocultos */}
      <input ref={inputCameraRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={handleArchivoChange} />
      <input ref={inputGalleryRef} type="file" accept="image/*,application/pdf"
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
