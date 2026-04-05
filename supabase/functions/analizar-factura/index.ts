// Edge Function: analizar-factura
// Proxy entre la PWA y la API de Anthropic para evitar bloqueos CORS en el navegador.
// La API key de Anthropic vive como secret en Supabase, nunca expuesta al cliente.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PROMPT_SISTEMA = `Eres un experto en leer facturas de distribuidores de tiendas de barrio colombianas.

Extrae toda la informacion de la factura y devuelve UNICAMENTE un JSON valido, sin texto adicional.

REGLA DEL IVA (muy importante):
Las facturas colombianas tienen columnas separadas: precio sin IVA y precio con IVA.
- Para precioUnitario: usa la columna "PRECIO UN IVA" o "P.+IVA" o "PRECIO CON IVA". NO uses "PRECIO UN" (sin IVA).
- Para subtotal: usa la columna "VLR TOT IVA" o "TOTAL CON IVA". NO uses "VLR TOTAL" (sin IVA).
- Para factura.total: usa el total final con todos los impuestos sumados (busca "TOTAL A PAGAR" o el monto escrito a mano).
- Si solo hay un precio por producto (sin columna IVA separada), usalo directamente.
- Si el porcentaje de IVA aparece por producto, ponlo en el campo ivaPercent.

REGLA DE NOMBRES:
Copia el nombre del producto EXACTAMENTE como aparece impreso, letra por letra. No interpretes ni cambies el nombre.
Ejemplo: "BAN SDW. ZENU X 230 G" debe quedar exactamente "BAN SDW. ZENU X 230 G".

OTRAS REGLAS:
- Precios en pesos colombianos sin decimales ni puntos de miles en el JSON
- Cantidades pueden ser fraccionadas (0.5, 2.5)
- Si no lees un numero claramente, usa 0. Si no lees un texto, usa null.
- Fechas en formato YYYY-MM-DD

Formato JSON requerido:
{
  "proveedor": {
    "nombre": "nombre de la empresa o null",
    "nit": "NIT o null",
    "telefono": "telefono o null",
    "direccion": "direccion o null"
  },
  "factura": {
    "numero": "numero de factura o null",
    "fecha": "YYYY-MM-DD o null",
    "total": 0
  },
  "productos": [
    {
      "nombre": "nombre exacto como aparece en la factura",
      "cantidad": 1,
      "precioUnitario": 0,
      "ivaPercent": 0,
      "subtotal": 0
    }
  ]
}

Si la imagen no es una factura, devuelve: {"proveedor":null,"factura":{"numero":null,"fecha":null,"total":0},"productos":[]}`

serve(async (req: Request) => {
  console.log('[analizar-factura] metodo:', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    console.log('[analizar-factura] API Key presente:', !!apiKey)

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json() as { imagenBase64: string; mimeType: string }
    const { imagenBase64, mimeType } = body
    console.log('[analizar-factura] mimeType:', mimeType, '| base64 chars:', imagenBase64?.length ?? 0)

    if (!imagenBase64) {
      return new Response(
        JSON.stringify({ error: 'imagenBase64 es requerido' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    console.log('[analizar-factura] Llamando a Anthropic...')
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: PROMPT_SISTEMA,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType ?? 'image/jpeg',
                  data: imagenBase64,
                },
              },
              {
                type: 'text',
                text: 'Analiza esta factura. Usa precios CON IVA. Copia nombres exactos. Responde solo con el JSON.',
              },
            ],
          },
        ],
      }),
    })

    console.log('[analizar-factura] Anthropic status:', anthropicRes.status)
    const data = await anthropicRes.json()

    if (!anthropicRes.ok) {
      const errData = data as { error?: { message?: string; type?: string } }
      const msg = errData.error?.message ?? `Error ${anthropicRes.status}`
      console.error('[analizar-factura] Error Anthropic:', JSON.stringify(errData))
      return new Response(
        JSON.stringify({ error: msg, status: anthropicRes.status }),
        { status: anthropicRes.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    console.log('[analizar-factura] Exito')
    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    console.error('[analizar-factura] Excepcion:', msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
