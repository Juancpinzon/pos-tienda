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

// Convierte un File a base64
export function fileABase64(file: File): Promise<{ base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' }> {
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
