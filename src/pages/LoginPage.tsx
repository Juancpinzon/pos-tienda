// Pantalla de inicio de sesión
// Flujo: email + contraseña → verifica perfil en tabla usuarios
// Si el perfil no existe (registro incompleto) → muestra formulario de completar registro

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { UsuarioAuth } from '../stores/authStore'

interface LoginPageProps {
  onIrARegistro: () => void
}

// ─── Sub-pantalla: completar registro cuando auth existe pero no hay perfil ───

interface CompletarRegistroProps {
  userId: string
  emailUsuario: string
  onCancelar: () => void
  onCompletado: (usuario: UsuarioAuth) => void
}

function CompletarRegistro({ userId, emailUsuario, onCancelar, onCompletado }: CompletarRegistroProps) {
  const [nombreTienda, setNombreTienda] = useState('')
  const [nombreDueno,  setNombreDueno]  = useState('')
  const [cargando,     setCargando]     = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const handleCompletar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCargando(true)

    try {
      // 1. Crear la tienda
      const { data: tiendaData, error: tiendaError } = await supabase
        .from('tiendas')
        .insert({ nombre: nombreTienda.trim() })
        .select('id, nombre')
        .single()

      if (tiendaError || !tiendaData) {
        setError('Error al crear la tienda: ' + (tiendaError?.message ?? 'intenta de nuevo'))
        return
      }

      // 2. Crear el perfil de usuario con rol 'dueno'
      const { error: usuarioError } = await supabase
        .from('usuarios')
        .insert({
          id:        userId,
          tienda_id: tiendaData.id,
          email:     emailUsuario,
          nombre:    nombreDueno.trim(),
          rol:       'dueno',
        })

      if (usuarioError) {
        setError('Error al guardar el perfil: ' + usuarioError.message)
        return
      }

      onCompletado({
        id:           userId,
        email:        emailUsuario,
        nombre:       nombreDueno.trim(),
        rol:          'dueno',
        tiendaId:     tiendaData.id,
        nombreTienda: tiendaData.nombre,
      })
    } catch {
      setError('Error de conexión. Verifica tu internet.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-fondo flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm flex flex-col gap-6">

        <div className="flex flex-col items-center gap-2">
          <span className="text-5xl">🏪</span>
          <h1 className="font-display font-bold text-xl text-primario">Completa tu registro</h1>
          <p className="text-suave text-sm text-center">
            Tu cuenta existe pero falta configurar la tienda
          </p>
        </div>

        <form onSubmit={handleCompletar} className="bg-white rounded-2xl shadow-sm border border-borde p-6 flex flex-col gap-4">

          {/* Email no editable */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Correo electrónico</label>
            <div className="h-12 px-4 bg-fondo border border-borde rounded-xl text-sm text-suave flex items-center">
              {emailUsuario}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Nombre de la tienda</label>
            <input
              type="text"
              value={nombreTienda}
              onChange={(e) => setNombreTienda(e.target.value)}
              placeholder="Ej: Tienda Doña Rosa"
              required
              maxLength={60}
              autoFocus
              className="h-12 px-4 border border-borde rounded-xl text-base
                         focus:outline-none focus:ring-2 focus:ring-primario/40 focus:border-primario"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Tu nombre</label>
            <input
              type="text"
              value={nombreDueno}
              onChange={(e) => setNombreDueno(e.target.value)}
              placeholder="Ej: Juan Camilo"
              required
              maxLength={60}
              className="h-12 px-4 border border-borde rounded-xl text-base
                         focus:outline-none focus:ring-2 focus:ring-primario/40 focus:border-primario"
            />
          </div>

          {error && (
            <div className="bg-peligro/8 border border-peligro/20 rounded-xl px-4 py-3">
              <p className="text-sm text-peligro">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={cargando || !nombreTienda || !nombreDueno}
            style={{ height: '52px' }}
            className="bg-primario text-white rounded-xl font-display font-bold text-base
                       hover:bg-primario-hover active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cargando ? 'Guardando…' : 'Completar registro'}
          </button>

          <button
            type="button"
            onClick={onCancelar}
            className="text-sm text-suave hover:text-texto transition-colors text-center"
          >
            Cancelar y cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Pantalla principal de login ─────────────────────────────────────────────

export default function LoginPage({ onIrARegistro }: LoginPageProps) {
  const setUsuario = useAuthStore((s) => s.setUsuario)

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // Estado para registro incompleto: auth OK pero sin fila en usuarios
  const [registroIncompleto, setRegistroIncompleto] = useState<{
    userId: string
    email: string
  } | null>(null)

  // Cuando el usuario cancela el completar registro: cerrar sesión de Supabase
  const handleCancelarCompletarRegistro = async () => {
    await supabase.auth.signOut()
    setRegistroIncompleto(null)
    setError(null)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCargando(true)

    try {
      // 1. Autenticar con Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (authError) {
        setError('Email o contraseña incorrectos')
        return
      }

      // 2. Cargar perfil del usuario (rol + tienda)
      const { data: perfil, error: perfilError } = await supabase
        .from('usuarios')
        .select('id, tienda_id, email, nombre, rol, tiendas(nombre)')
        .eq('id', authData.user.id)
        .single()

      // Perfil no existe → registro incompleto, ofrecer completarlo
      if (perfilError?.code === 'PGRST116' || !perfil) {
        setRegistroIncompleto({
          userId: authData.user.id,
          email:  authData.user.email ?? email.trim().toLowerCase(),
        })
        return
      }

      if (perfilError) {
        setError('Error al cargar el perfil. Intenta de nuevo.')
        await supabase.auth.signOut()
        return
      }

      setUsuario({
        id:           perfil.id,
        email:        perfil.email,
        nombre:       perfil.nombre,
        rol:          perfil.rol as 'dueno' | 'empleado',
        tiendaId:     perfil.tienda_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nombreTienda: (perfil.tiendas as any)?.nombre ?? 'Mi Tienda',
      })
    } catch {
      setError('Error de conexión. Verifica tu internet.')
    } finally {
      setCargando(false)
    }
  }

  // Mostrar pantalla de completar registro si es necesario
  if (registroIncompleto) {
    return (
      <CompletarRegistro
        userId={registroIncompleto.userId}
        emailUsuario={registroIncompleto.email}
        onCancelar={handleCancelarCompletarRegistro}
        onCompletado={setUsuario}
      />
    )
  }

  return (
    <div className="min-h-screen bg-fondo flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm flex flex-col gap-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-6xl">🏪</span>
          <h1 className="font-display font-bold text-2xl text-primario">POS Tienda</h1>
          <p className="text-suave text-sm text-center">Ingresa para continuar</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm border border-borde p-6 flex flex-col gap-4">

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
              required
              className="h-12 px-4 border border-borde rounded-xl text-base
                         focus:outline-none focus:ring-2 focus:ring-primario/40 focus:border-primario"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="h-12 px-4 border border-borde rounded-xl text-base
                         focus:outline-none focus:ring-2 focus:ring-primario/40 focus:border-primario"
            />
          </div>

          {error && (
            <div className="bg-peligro/8 border border-peligro/20 rounded-xl px-4 py-3">
              <p className="text-sm text-peligro">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={cargando || !email || !password}
            style={{ height: '52px' }}
            className="bg-primario text-white rounded-xl font-display font-bold text-base
                       hover:bg-primario-hover active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed mt-1"
          >
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        {/* Registro */}
        <div className="text-center">
          <p className="text-sm text-suave">
            ¿Primera vez?{' '}
            <button
              type="button"
              onClick={onIrARegistro}
              className="text-primario font-semibold hover:underline"
            >
              Registrar tienda nueva
            </button>
          </p>
        </div>

        <div className="text-center">
          <p className="text-xs text-suave/60">
            Sin internet, la app funciona igual una vez configurada
          </p>
        </div>
      </div>
    </div>
  )
}
