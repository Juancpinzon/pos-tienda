// Pantalla de inicio de sesión
// Flujo: email + contraseña → verifica usuario en Supabase → carga tienda

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { UsuarioAuth } from '../stores/authStore'

interface LoginPageProps {
  onIrARegistro: () => void
}

export default function LoginPage({ onIrARegistro }: LoginPageProps) {
  const setUsuario = useAuthStore((s) => s.setUsuario)

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState<string | null>(null)

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

      if (perfilError || !perfil) {
        setError('Error al cargar el perfil. Contacta al administrador.')
        await supabase.auth.signOut()
        return
      }

      const usuario: UsuarioAuth = {
        id:           perfil.id,
        email:        perfil.email,
        nombre:       perfil.nombre,
        rol:          perfil.rol as 'dueno' | 'empleado',
        tiendaId:     perfil.tienda_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nombreTienda: (perfil.tiendas as any)?.nombre ?? 'Mi Tienda',
      }

      setUsuario(usuario)
    } catch {
      setError('Error de conexión. Verifica tu internet.')
    } finally {
      setCargando(false)
    }
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
            className="h-13 bg-primario text-white rounded-xl font-display font-bold text-base
                       hover:bg-primario-hover active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed mt-1"
            style={{ height: '52px' }}
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

        {/* Modo offline */}
        <div className="text-center">
          <p className="text-xs text-suave/60">
            Sin internet, la app funciona igual una vez configurada
          </p>
        </div>
      </div>
    </div>
  )
}
