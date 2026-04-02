// Edge Function: analizar-factura
// Proxy entre la PWA y la API de Anthropic para evitar bloqueos CORS en el navegador.
// La API key de Anthropic vive como secret en Supabase, nunca expuesta al cliente.
//
// Deploy:
//   supabase functions deploy analizar-factura --no-verify-jwt
//
// Secret requerido (una sola vez):
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   O: Supabase Dashboard → Edge Functions → Manage secrets

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada en los secrets de Supabase' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const { imagenBase64, mimeType } = await req.json() as {
      imagenBase64: string
      mimeType: string
    }

    if (!imagenBase64) {
      return new Response(
        JSON.stringify({ error: 'imagenBase64 es requerido' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20251001',
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
                  media_type: mimeType ?? 'image/jpeg',
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

    const data = await anthropicRes.json()

    if (!anthropicRes.ok) {
      const msg = (data as { error?: { message?: string } }).error?.message ?? `Error ${anthropicRes.status}`
      return new Response(
        JSON.stringify({ error: msg, status: anthropicRes.status }),
        { status: anthropicRes.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
