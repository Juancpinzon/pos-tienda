// Cliente Supabase — singleton para toda la aplicación
// Variables de entorno definidas en .env.local (nunca en el repo)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Si las variables no están definidas, el cliente se crea con valores vacíos.
// El modo offline funciona igual — Supabase solo se usa cuando hay internet + credenciales.
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)

// True si las variables de entorno están configuradas
export const supabaseConfigurado =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  supabaseUrl !== 'https://placeholder.supabase.co'
