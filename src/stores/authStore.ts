// Estado de autenticación — Zustand con persistencia en localStorage
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RolUsuario = 'dueno' | 'encargado' | 'empleado'

export interface TiendaResumen {
  id:     string
  nombre: string
}

export interface UsuarioAuth {
  id:           string       // UUID de auth.users
  email:        string
  nombre:       string
  rol:          RolUsuario
  tiendaId:     string       // UUID de la tienda ACTIVA
  nombreTienda: string
}

interface AuthState {
  usuario:           UsuarioAuth  | null
  todasLasTiendas:   TiendaResumen[]  // Tiendas del dueño (vacío si empleado o sin Supabase)
  isLoading:         boolean
  setUsuario:        (u: UsuarioAuth | null) => void
  setTodasLasTiendas:(tiendas: TiendaResumen[]) => void
  setIsLoading:      (v: boolean) => void
  cerrarSesion:      () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario:           null,
      todasLasTiendas:   [],
      isLoading:         true,
      setUsuario:        (usuario)          => set({ usuario, isLoading: false }),
      setTodasLasTiendas:(todasLasTiendas)  => set({ todasLasTiendas }),
      setIsLoading:      (isLoading)        => set({ isLoading }),
      cerrarSesion:      ()                 => set({ usuario: null, todasLasTiendas: [], isLoading: false }),
    }),
    {
      name: 'pos-auth',
      // Persistir usuario y tiendas para mostrar selector sin esperar carga
      partialize: (state) => ({
        usuario:         state.usuario,
        todasLasTiendas: state.todasLasTiendas,
      }),
    }
  )
)

// ─── Helpers de rol ──────────────────────────────────────────────────────────

/** Rutas permitidas para cada rol */
export const RUTAS_POR_ROL: Record<RolUsuario, string[]> = {
  dueno:     ['/', '/fiados', '/productos', '/inventario', '/proveedores', '/caja', '/reportes', '/historial', '/pedido', '/multi-tienda', '/nomina', '/domicilios'],
  encargado: ['/', '/fiados', '/productos', '/proveedores', '/caja', '/reportes', '/historial', '/pedido', '/nomina', '/domicilios'],
  empleado:  ['/', '/fiados', '/historial'],
}

export function puedeAcceder(rol: RolUsuario, ruta: string): boolean {
  return RUTAS_POR_ROL[rol].includes(ruta)
}
