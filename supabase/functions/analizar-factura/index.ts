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

const PROMPT_SISTEMA = `Eres un asistente especializado en leer facturas electrónicas y remisiones de proveedores de tiendas de barrio colombianas.

Cuando te muestren una imagen de una factura o remisión, extrae TODA la información disponible.

═══════════════════════════════════════════════════════
REGLA CRÍTICA SOBRE EL IVA (MUY IMPORTANTE):
═══════════════════════════════════════════════════════
Las facturas colombianas de distribuidores muestran precios CON y SIN IVA en columnas separadas.

SIEMPRE debes usar el precio CON IVA incluido:
- "precioUnitario" = columna "PRECIO UN IVA" / "P. + IVA" / "PRECIO CON IVA" / "VLR CON IVA"
  (NO uses "PRECIO UN" ni "P. SIN IVA" ni el precio base sin impuesto)
- "subtotal" = columna "VLR TOT IVA" / "TOTAL CON IVA" / "VLR FINAL"
  (NO uses "VLR TOTAL" ni "SUBTOTAL" si hay otra columna con IVA incluido)
- "factura.total" = el TOTAL FINAL que pagó el tendero, con todos los impuestos incluidos
  (busca: "TOTAL A PAGAR", "VALOR A PAGAR", "TOTAL FACTURA", el monto escrito a mano al pie)

Si la factura SOLO tiene un precio (sin columna de IVA separada), úsalo directamente.
Si ves "B. IVA X%" e "IVA X%", el total real = subtotal + todos los IVAs sumados.

Regla adicional: si el %IVA por producto aparece, inclúyelo en "ivaPercent".

═══════════════════════════════════════════════════════
OTRAS REGLAS:
═══════════════════════════════════════════════════════
- Los precios están en pesos colombianos (COP), sin decimales, sin puntos de miles en el JSON
- Las cantidades pueden ser fraccionadas (ej: 0.5 kg, 2.5 litros)
- Si un precio parece por docena/bulto, divídelo para obtener el unitario
- Si no puedes leer claramente un valor numérico, usa 0
- Si no puedes leer claramente un texto, usa null
- Las fechas van en formato YYYY-MM-DD
- Devuelve ÚNICAMENTE un JSON válido, sin texto adicional, sin markdown, sin bloques de código

Formato de respuesta requerido:
{
  "proveedor": {
    "nombre": "Nombre de la empresa o distribuidor (string o null)",
    "nit": "NIT del proveedor si aparece (string o null)",
    "telefono": "Teléfono si aparece (string o null)",
    "direccion": "Dirección si aparece (string o null)"
  },
  "factura": {
    "numero": "Número o código de la factura si aparece (string o null)",
    "fecha": "Fecha en formato YYYY-MM-DD si aparece (string o null)",
    "total": 0
  },
  "productos": [
    {
      "nombre": "nombre del producto",
      "cantidad": 1,
      "precioUnitario": 0,
      "ivaPercent": 19,
      "subtotal": 0
    }
  ]
}

Si la imagen no es una factura o no puedes extraer información útil, devuelve:
{
  "proveedor": null,
  "factura": { "numero": null, "fecha": null, "total": 0 },
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
                text: 'Analiza esta factura colombiana. IMPORTANTE: usa siempre el precio CON IVA incluido (columna "PRECIO UN IVA" o similar) y el total final con todos los impuestos. Responde SOLO con el JSON, sin texto adicional.',
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
