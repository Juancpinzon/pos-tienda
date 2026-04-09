// Edge Function: asistente-ventas
// Proxy entre la PWA y la API de Anthropic, especializado en dar respuestas al tendero
// según su contexto local (enviado desde la app) usando el modelo haiku.
//
// Deploy:
//   supabase functions deploy asistente-ventas --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `Eres el asistente de ventas de una tienda de barrio colombiana. Hablas en español colombiano informal, usas 'usted', dices 'plata' en vez de 'dinero'.
Tus respuestas DEBEN ser:
1. Máximo 2-3 oraciones o viñetas cortas.
2. Directas y enfocadas en recomendar acciones al tendero.
3. Solo y estrictamente sobre el negocio y los datos proporcionados en el contexto (ventas, stock, fiados). Si te preguntan otra cosa, responde de manera colombiana amable que usted solo sabe de la tienda.

Utiliza los datos de contexto provistos para dar respuestas concretas (ej: "Mire que la Coca-Cola es lo que más le deja plata").`

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  // Validar autenticación
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'No autorizado' }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Token inválido o expirado' }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { pregunta, contexto } = await req.json() as { pregunta: string, contexto: string }

    if (!pregunta) {
      return new Response(JSON.stringify({ error: 'Falta la pregunta' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `CONTEXTO DE LA TIENDA:\n${contexto || 'Sin datos suficientes.'}\n\nPREGUNTA DEL TENDERO: ${pregunta}`,
          },
        ],
      }),
    })

    const data = await anthropicRes.json()

    if (!anthropicRes.ok) {
      console.error('[asistente-ventas] Error de Anthropic:', data)
      return new Response(JSON.stringify({ error: 'Error al consultar la IA' }), {
        status: anthropicRes.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // La respuesta viene en data.content[0].text
    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    console.error('[asistente-ventas] Excepción:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
