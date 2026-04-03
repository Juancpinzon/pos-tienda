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
  console.log('[analizar-factura] Función iniciada, método:', req.method)

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // 1. Verificar API key
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    console.log('[analizar-factura] API Key presente:', !!apiKey)
    if (apiKey) {
      console.log('[analizar-factura] API Key prefijo:', apiKey.substring(0, 10) + '...')
    }

    if (!apiKey) {
      console.error('[analizar-factura] ERROR: ANTHROPIC_API_KEY no configurada')
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada en los secrets de Supabase' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 2. Parsear body
    let imagenBase64: string
    let mimeType: string
    try {
      const body = await req.json() as { imagenBase64: string; mimeType: string }
      imagenBase64 = body.imagenBase64
      mimeType = body.mimeType
      console.log('[analizar-factura] Body recibido — mimeType:', mimeType, '| base64 chars:', imagenBase64?.length ?? 0)
    } catch (parseErr) {
      console.error('[analizar-factura] ERROR parseando body:', parseErr)
      return new Response(
        JSON.stringify({ error: 'Body inválido o no es JSON' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    if (!imagenBase64) {
      console.error('[analizar-factura] ERROR: imagenBase64 vacío')
      return new Response(
        JSON.stringify({ error: 'imagenBase64 es requerido' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 3. Llamar a Anthropic
    console.log('[analizar-factura] Llamando a Anthropic API...')
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

    console.log('[analizar-factura] Respuesta Anthropic status:', anthropicRes.status)

    const data = await anthropicRes.json()

    if (!anthropicRes.ok) {
      const errData = data as { error?: { message?: string; type?: string } }
      const msg = errData.error?.message ?? `Error ${anthropicRes.status}`
      console.error('[analizar-factura] ERROR Anthropic:', JSON.stringify(errData))
      return new Response(
        JSON.stringify({ error: msg, status: anthropicRes.status, tipo: errData.error?.type }),
        { status: anthropicRes.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    console.log('[analizar-factura] Éxito — stop_reason:', (data as { stop_reason?: string }).stop_reason)
    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    console.error('[analizar-factura] EXCEPCIÓN no controlada:', msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
