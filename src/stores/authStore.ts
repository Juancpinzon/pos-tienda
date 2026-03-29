// Estado de autenticación — Zustand con persistencia en localStorage
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RolUsuario = 'dueno' | 'empleado'

export interface UsuarioAuth {
  id: string           // UUID de auth.users
  email: string
  nombre: string
  rol: RolUsuario
  tiendaId: string     // UUID de la tienda
  nombreTienda: string
}

interface AuthState {
  usuario: UsuarioAuth | null
  isLoading: boolean
  setUsuario: (u: UsuarioAuth | null) => void
  setIsLoading: (v: boolean) => void
  cerrarSesion: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      isLoading: true,
      setUsuario: (usuario) => set({ usuario, isLoading: false }),
      setIsLoading: (isLoading) => set({ isLoading }),
      cerrarSesion: () => set({ usuario: null, isLoading: false }),
    }),
    {
      name: 'pos-auth',
      // Solo persistir el usuario, no el loading state
      partialize: (state) => ({ usuario: state.usuario }),
    }
  )
)

// ─── Helpers de rol ──────────────────────────────────────────────────────────

/** Rutas permitidas para cada rol */
export const RUTAS_POR_ROL: Record<RolUsuario, string[]> = {
  dueno:    ['/', '/fiados', '/productos', '/inventario', '/proveedores', '/caja', '/reportes'],
  empleado: ['/', '/fiados'],
}

export function puedeAcceder(rol: RolUsuario, ruta: string): boolean {
  return RUTAS_POR_ROL[rol].includes(ruta)
}
