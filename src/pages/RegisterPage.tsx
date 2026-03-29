// Registro de tienda nueva — solo para el dueño
// Crea: auth.user + tiendas(row) + usuarios(row, rol='dueno')

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { UsuarioAuth } from '../stores/authStore'

interface RegisterPageProps {
  onIrALogin: () => void
}

export default function RegisterPage({ onIrALogin }: RegisterPageProps) {
  const setUsuario = useAuthStore((s) => s.setUsuario)

  const [nombreTienda, setNombreTienda] = useState('')
  const [nombreDueno,  setNombreDueno]  = useState('')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [password2,    setPassword2]    = useState('')
  const [cargando,     setCargando]     = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== password2) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setCargando(true)

    try {
      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { nombre: nombreDueno.trim() },
        },
      })

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('Este correo ya está registrado. Intenta iniciar sesión.')
        } else {
          setError(signUpError.message)
        }
        return
      }

      if (!authData.user) {
        setError('Error al crear la cuenta. Intenta de nuevo.')
        return
      }

      // 2. Crear registro de tienda
      const { data: tiendaData, error: tiendaError } = await supabase
        .from('tiendas')
        .insert({ nombre: nombreTienda.trim() })
        .select('id, nombre')
        .single()

      if (tiendaError || !tiendaData) {
        setError('Error al crear la tienda. Intenta de nuevo.')
        // Intentar limpiar el usuario creado
        await supabase.auth.signOut()
        return
      }

      // 3. Crear registro de usuario con rol 'dueno'
      const { error: usuarioError } = await supabase
        .from('usuarios')
        .insert({
          id:        authData.user.id,
          tienda_id: tiendaData.id,
          email:     email.trim().toLowerCase(),
          nombre:    nombreDueno.trim(),
          rol:       'dueno',
        })

      if (usuarioError) {
        setError('Error al configurar el perfil. Contacta soporte.')
        await supabase.auth.signOut()
        return
      }

      // 4. Guardar en store — ya está logueado
      const usuario: UsuarioAuth = {
        id:           authData.user.id,
        email:        email.trim().toLowerCase(),
        nombre:       nombreDueno.trim(),
        rol:          'dueno',
        tiendaId:     tiendaData.id,
        nombreTienda: tiendaData.nombre,
      }

      setUsuario(usuario)
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-fondo flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-6xl">🏪</span>
          <h1 className="font-display font-bold text-2xl text-primario">Registrar tienda</h1>
          <p className="text-suave text-sm text-center">
            Crea tu cuenta — accede desde cualquier dispositivo
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleRegistro} className="bg-white rounded-2xl shadow-sm border border-borde p-6 flex flex-col gap-4">

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Nombre de la tienda</label>
            <input
              type="text"
              value={nombreTienda}
              onChange={(e) => setNombreTienda(e.target.value)}
              placeholder="Ej: Tienda Doña Rosa"
              required
              maxLength={60}
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
              placeholder="Ej: Rosa Martínez"
              required
              maxLength={60}
              className="h-12 px-4 border border-borde rounded-xl text-base
                         focus:outline-none focus:ring-2 focus:ring-primario/40 focus:border-primario"
            />
          </div>

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
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              required
              minLength={6}
              className="h-12 px-4 border border-borde rounded-xl text-base
                         focus:outline-none focus:ring-2 focus:ring-primario/40 focus:border-primario"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Repetir contraseña</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Repite la contraseña"
              autoComplete="new-password"
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
            disabled={cargando || !nombreTienda || !nombreDueno || !email || !password || !password2}
            className="font-display font-bold text-base text-white bg-primario rounded-xl
                       hover:bg-primario-hover active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ height: '52px' }}
          >
            {cargando ? 'Creando cuenta…' : 'Crear tienda'}
          </button>
        </form>

        {/* Volver al login */}
        <div className="text-center">
          <p className="text-sm text-suave">
            ¿Ya tienes cuenta?{' '}
            <button
              type="button"
              onClick={onIrALogin}
              className="text-primario font-semibold hover:underline"
            >
              Iniciar sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
