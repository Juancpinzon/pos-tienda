// Edge Function: validar-codigo
// Valida un código de activación server-side para que los patrones
// y códigos legacy nunca sean visibles en el bundle del cliente.
// Consulta primero la tabla codigos_activacion (códigos emitidos individualmente)
// y luego cae al fallback de patrones/legacy.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Orígenes permitidos: producción + Capacitor Android + dev local
// Configurar ALLOWED_ORIGINS en Supabase secrets cuando cambie el dominio.
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ??
    'https://pos-tienda-ten.vercel.app,https://localhost,capacitor://localhost,http://localhost:5173')
    .split(',').map((o) => o.trim()).filter(Boolean),
)

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : 'https://pos-tienda-ten.vercel.app'
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

const LIMITE_POR_HORA = 10

type Plan = 'basico' | 'pro' | 'upgrade'

interface ResultadoValidacion {
  valido: boolean
  plan: Plan | null
  mensaje?: string
}

function validarFormato(codigo: string): ResultadoValidacion {
  const patronBasico  = /^TIENDA-[A-Z0-9]{4}$/
  const patronPro     = /^PRO-[A-Z0-9]{4}$/
  const patronUpgrade = /^UPG-[A-Z0-9]{4}$/

  const legacyBasico = ['TIENDA2025', 'BARRIO2025', 'POSBASICO2025', 'TENDERO2025', 'TIENDA2026']
  const legacyPro    = ['PROTIENDA2025', 'DOMICILIOS2025', 'UPGRADE2025']

  if (patronBasico.test(codigo)  || legacyBasico.includes(codigo)) return { valido: true, plan: 'basico' }
  if (patronPro.test(codigo)     || legacyPro.includes(codigo))    return { valido: true, plan: 'pro' }
  if (patronUpgrade.test(codigo))                                   return { valido: true, plan: 'upgrade' }

  return { valido: false, plan: null }
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const CORS   = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'No autorizado' }),
      { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  const token = authHeader.replace('Bearer ', '')
  const supabaseAnon = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  )

  const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token)
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Token inválido o expirado' }),
      { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Rate limiting: máx 10 intentos por hora por usuario
  const hace1Hora = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: intentosRecientes } = await supabaseAdmin
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('accion', 'validar_codigo')
    .gte('creado_en', hace1Hora)

  if ((intentosRecientes ?? 0) >= LIMITE_POR_HORA) {
    return new Response(
      JSON.stringify({
        valido: false,
        plan: null,
        mensaje: 'Demasiados intentos. Espera una hora antes de intentar nuevamente.',
      }),
      { status: 429, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  // Registrar intento (fire and forget — no bloquea la respuesta)
  void supabaseAdmin.from('rate_limits').insert({ user_id: user.id, accion: 'validar_codigo' })

  let codigo: string
  try {
    const body = await req.json() as { codigo?: string }
    codigo = (body.codigo ?? '').trim().toUpperCase()
  } catch {
    return new Response(
      JSON.stringify({ valido: false, plan: null, mensaje: 'Cuerpo inválido' }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  if (!codigo) {
    return new Response(
      JSON.stringify({ valido: false, plan: null }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  // 1. Verificar en tabla codigos_activacion (códigos emitidos individualmente)
  const { data: codigoDb } = await supabaseAdmin
    .from('codigos_activacion')
    .select('plan, usado, tienda_id')
    .eq('codigo', codigo)
    .maybeSingle()

  if (codigoDb) {
    if (codigoDb.usado && codigoDb.tienda_id) {
      const { data: usuarioData } = await supabaseAdmin
        .from('usuarios')
        .select('tienda_id')
        .eq('id', user.id)
        .maybeSingle()

      if (usuarioData && codigoDb.tienda_id !== usuarioData.tienda_id) {
        return new Response(
          JSON.stringify({ valido: false, plan: null, mensaje: 'Código ya utilizado por otra tienda' }),
          { headers: { ...CORS, 'Content-Type': 'application/json' } },
        )
      }
    }

    return new Response(
      JSON.stringify({ valido: true, plan: codigoDb.plan as Plan }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  // 2. Fallback: validar por patrón / legacy
  const resultado = validarFormato(codigo)
  return new Response(
    JSON.stringify(resultado),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
})
