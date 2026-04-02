// Módulo OCR: analiza fotos de facturas de proveedores con Claude Vision
// Llama directamente a la API de Anthropic desde el navegador

export interface ItemOCR {
  nombreProducto: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

interface RespuestaOCR {
  productos: ItemOCR[]
}

const PROMPT_SISTEMA = `Eres un asistente especializado en leer facturas y remisiones de proveedores de tiendas de barrio colombianas.

Cuando te muestren una imagen de una factura o remisión, extrae todos los productos con sus cantidades y precios.

IMPORTANTE:
- Los precios están en pesos colombianos (COP), sin decimales
- Las cantidades pueden ser fraccionadas (ej: 0.5 kg, 2.5 litros)
- Si un precio parece por docena/bulto, divídelo para obtener el unitario
- Si no puedes leer claramente un valor, usa 0
- Devuelve ÚNICAMENTE un JSON válido, sin explicaciones adicionales

Formato de respuesta requerido:
{
  "productos": [
    {
      "nombreProducto": "nombre del producto",
      "cantidad": número,
      "precioUnitario": número entero en pesos,
      "subtotal": número entero en pesos
    }
  ]
}

Si la imagen no es una factura o no puedes extraer productos, devuelve:
{
  "productos": []
}`

export async function analizarFactura(
  imagenBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg',
): Promise<ItemOCR[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('No hay API key de Anthropic configurada (VITE_ANTHROPIC_API_KEY)')
  }

  const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-calls': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: PROMPT_SISTEMA,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imagenBase64,
              },
            },
            {
              type: 'text',
              text: 'Extrae todos los productos de esta factura.',
            },
          ],
        },
      ],
    }),
  })

  if (!respuesta.ok) {
    const errorData = await respuesta.json().catch(() => ({}))
    const msg = (errorData as { error?: { message?: string } }).error?.message ?? `Error ${respuesta.status}`
    throw new Error(`Error de API: ${msg}`)
  }

  const data = await respuesta.json() as {
    content: Array<{ type: string; text?: string }>
  }
  const textoRespuesta = data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')

  // Extraer JSON de la respuesta (puede venir envuelto en markdown)
  const jsonMatch = textoRespuesta.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('La respuesta del modelo no contiene JSON válido')
  }

  const parsed = JSON.parse(jsonMatch[0]) as RespuestaOCR
  if (!Array.isArray(parsed.productos)) {
    throw new Error('Formato de respuesta inesperado')
  }

  // Normalizar y limpiar los datos
  return parsed.productos
    .filter((p) => p.nombreProducto && p.precioUnitario > 0)
    .map((p) => ({
      nombreProducto: String(p.nombreProducto).trim(),
      cantidad: Math.max(0.01, Number(p.cantidad) || 1),
      precioUnitario: Math.round(Math.max(0, Number(p.precioUnitario) || 0)),
      subtotal: Math.round(Math.max(0, Number(p.subtotal) || 0)),
    }))
}

// Redimensiona y comprime una imagen antes de enviarla al API.
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
export function fileABase64(file: File | Blob): Promise<{ base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // result es "data:image/jpeg;base64,XXXX..."
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
// Punto de entrada principal para el modal de foto de factura.
export async function analizarFoto(file: File): Promise<ItemOCR[]> {
  const comprimida = await reducirImagen(file)
  const { base64, mimeType } = await fileABase64(comprimida)
  return analizarFactura(base64, mimeType)
}
