// Módulo OCR: analiza fotos de facturas con Claude Vision.
//
// Arquitectura:
//   Cuando Supabase está configurado (producción) → llama a la Edge Function
//   'analizar-factura' como proxy. Esto resuelve el bloqueo CORS del navegador
//   y mantiene la API key de Anthropic en el servidor, nunca expuesta al cliente.
//
//   Cuando Supabase NO está configurado (dev local sin .env) → intento directo
//   con VITE_ANTHROPIC_API_KEY + cabecera 'anthropic-dangerous-direct-browser-calls'.

import { supabase, supabaseConfigurado } from './supabase'

// ─── Tipos públicos ───────────────────────────────────────────────────────────

/** Un producto extraído de la factura */
export interface ItemOCR {
  nombreProducto: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

/** Datos del proveedor detectados en la factura */
export interface ProveedorOCR {
  nombre: string
  nit: string | null
  telefono: string | null
  direccion: string | null
}

/** Metadatos de la factura */
export interface FacturaOCR {
  numero: string | null
  fecha: string | null   // YYYY-MM-DD
  total: number
}

/** Resultado completo del análisis de una factura */
export interface ResultadoOCR {
  proveedor: ProveedorOCR | null
  factura: FacturaOCR | null
  productos: ItemOCR[]
}

// ─── Formato crudo del modelo (usa "nombre" en lugar de "nombreProducto") ────

interface ProductoRaw {
  nombre?: string
  nombreProducto?: string   // compatibilidad con respuestas antiguas
  cantidad?: number
  precioUnitario?: number
  subtotal?: number
}

interface RespuestaRaw {
  proveedor?: {
    nombre?: string | null
    nit?: string | null
    telefono?: string | null
    direccion?: string | null
  } | null
  factura?: {
    numero?: string | null
    fecha?: string | null
    total?: number
  } | null
  productos?: ProductoRaw[]
}

// ─── Parseo de respuesta ──────────────────────────────────────────────────────

function parsearRespuestaAnthropic(
  data: { content?: Array<{ type: string; text?: string }> },
): ResultadoOCR {
  const textoRespuesta = (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')

  // Extraer JSON (puede venir envuelto en markdown)
  const jsonMatch = textoRespuesta.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('La respuesta del modelo no contiene JSON válido')
  }

  const parsed = JSON.parse(jsonMatch[0]) as RespuestaRaw

  // ── Productos ─────────────────────────────────────────────────────────────
  const productosRaw = Array.isArray(parsed.productos) ? parsed.productos : []
  const productos: ItemOCR[] = productosRaw
    .filter((p) => (p.nombre || p.nombreProducto) && (p.precioUnitario ?? 0) > 0)
    .map((p) => {
      const nombre = String(p.nombre ?? p.nombreProducto ?? '').trim()
      const cantidad = Math.max(0.01, Number(p.cantidad) || 1)
      const precioUnitario = Math.round(Math.max(0, Number(p.precioUnitario) || 0))
      const subtotalCalc = Math.round(cantidad * precioUnitario)
      const subtotal = Math.round(Math.max(0, Number(p.subtotal) || subtotalCalc))
      return { nombreProducto: nombre, cantidad, precioUnitario, subtotal }
    })

  // ── Proveedor ─────────────────────────────────────────────────────────────
  let proveedor: ProveedorOCR | null = null
  if (parsed.proveedor?.nombre) {
    proveedor = {
      nombre: String(parsed.proveedor.nombre).trim(),
      nit: parsed.proveedor.nit ? String(parsed.proveedor.nit).trim() : null,
      telefono: parsed.proveedor.telefono ? String(parsed.proveedor.telefono).trim() : null,
      direccion: parsed.proveedor.direccion ? String(parsed.proveedor.direccion).trim() : null,
    }
  }

  // ── Factura ───────────────────────────────────────────────────────────────
  let factura: FacturaOCR | null = null
  if (parsed.factura) {
    factura = {
      numero: parsed.factura.numero ? String(parsed.factura.numero).trim() : null,
      fecha: parsed.factura.fecha ? String(parsed.factura.fecha).trim() : null,
      total: Math.round(Math.max(0, Number(parsed.factura.total) || 0)),
    }
  }

  return { proveedor, factura, productos }
}

// ─── Llamada a través de Supabase Edge Function (producción) ─────────────────

async function analizarViaEdgeFunction(
  imagenBase64: string,
  mimeType: string,
): Promise<ResultadoOCR> {
  // Verificar sesión activa antes de llamar a la Edge Function
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('OFFLINE: Función disponible solo con conexión activa. Inicie sesión para usar el OCR.')
  }

  const { data, error } = await supabase.functions.invoke('analizar-factura', {
    body: { imagenBase64, mimeType },
  })

  if (error) {
    const msg = error.message ?? ''
    console.error('[OCR] Edge Function error:', msg)
    if (msg.includes('401') || msg.includes('nvalid') || msg.includes('Unauthorized')) throw new Error('API_KEY_INVALID')
    if (msg.includes('429') || msg.includes('rate')) throw new Error('RATE_LIMIT')
    throw new Error(`API_ERROR:${msg}`)
  }

  // La Edge Function puede devolver { error: '...' } con status 200 en algunos casos
  const payload = data as {
    error?: string
    status?: number
    content?: Array<{ type: string; text?: string }>
  }
  if (payload?.error) {
    if (String(payload.error).includes('ANTHROPIC_API_KEY')) throw new Error('API_KEY_MISSING')
    throw new Error(`API_ERROR:${payload.error}`)
  }

  return parsearRespuestaAnthropic(payload)
}

// ─── Llamada directa (fallback desarrollo local) ──────────────────────────────

const PROMPT_SISTEMA_DIRECTO = `Eres un asistente especializado en leer facturas y remisiones de proveedores de tiendas de barrio colombianas.

Cuando te muestren una imagen de una factura o remisión, extrae TODA la información disponible.

REGLAS:
- Los precios están en pesos colombianos (COP), sin decimales
- Las cantidades pueden ser fraccionadas (ej: 0.5 kg, 2.5 litros)
- Si no puedes leer un valor, usa null o 0 según corresponda
- Las fechas van en formato YYYY-MM-DD
- Devuelve ÚNICAMENTE un JSON válido, sin texto adicional

Formato:
{
  "proveedor": { "nombre": null, "nit": null, "telefono": null, "direccion": null },
  "factura": { "numero": null, "fecha": null, "total": 0 },
  "productos": [{ "nombre": "nombre", "cantidad": 1, "precioUnitario": 0, "subtotal": 0 }]
}`

async function analizarDirecto(
  imagenBase64: string,
  mimeType: string,
): Promise<ResultadoOCR> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('API_KEY_MISSING')

  const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-calls': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20251001',
      max_tokens: 2048,
      system: PROMPT_SISTEMA_DIRECTO,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imagenBase64 } },
          { type: 'text', text: 'Analiza esta factura colombiana y extrae TODA la información. Responde SOLO con el JSON.' },
        ],
      }],
    }),
  })

  if (!respuesta.ok) {
    const err = await respuesta.json().catch(() => ({})) as { error?: { message?: string } }
    const msg = err.error?.message ?? ''
    if (respuesta.status === 401) throw new Error('API_KEY_INVALID')
    if (respuesta.status === 429) throw new Error('RATE_LIMIT')
    throw new Error(`API_ERROR:${respuesta.status}:${msg}`)
  }

  const data = await respuesta.json() as { content: Array<{ type: string; text?: string }> }
  return parsearRespuestaAnthropic(data)
}

// ─── Punto de entrada principal ───────────────────────────────────────────────

export async function analizarFactura(
  imagenBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg',
): Promise<ResultadoOCR> {
  console.log(
    '[OCR] vía:', supabaseConfigurado ? 'Edge Function' : 'directo',
    '| chars imagen:', imagenBase64.length,
  )

  try {
    if (supabaseConfigurado) {
      return await analizarViaEdgeFunction(imagenBase64, mimeType)
    } else {
      return await analizarDirecto(imagenBase64, mimeType)
    }
  } catch (err) {
    if (err instanceof Error) throw err
    throw new Error('NETWORK_ERROR')
  }
}

// ─── Compresión de imagen ─────────────────────────────────────────────────────
// Anthropic Vision tiene un límite de 5 MB por imagen (decodificada).
// Las fotos de celular pueden pesar 8–15 MB; el canvas las reduce a ~1 MB.

async function reducirImagen(file: File, maxLado = 1_600, calidad = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
      const w = Math.round(img.width  * escala)
      const h = Math.round(img.height * escala)
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas no disponible')); return }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Error al comprimir la imagen')),
        'image/jpeg',
        calidad,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Error al cargar la imagen')) }
    img.src = url
  })
}

// Convierte un Blob/File a base64
export function fileABase64(
  file: File | Blob,
): Promise<{ base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [header, base64] = result.split(',')
      const mimeMatch = header.match(/data:([^;]+)/)
      const mime = (mimeMatch?.[1] ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      resolve({ base64, mimeType: mime })
    }
    reader.onerror = () => reject(new Error('Error al leer la imagen'))
    reader.readAsDataURL(file)
  })
}

// Comprime, convierte a base64 y analiza la imagen con Claude Vision.
export async function analizarFoto(file: File): Promise<ResultadoOCR> {
  const comprimida = await reducirImagen(file)
  const { base64, mimeType } = await fileABase64(comprimida)
  return analizarFactura(base64, mimeType)
}
