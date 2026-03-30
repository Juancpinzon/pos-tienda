// themeStore.ts — Estado global del tema de la app
// Tres opciones: claro | oscuro | sistema (sigue la preferencia del OS)
// Persiste en localStorage para que sobreviva recargas

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Tema = 'claro' | 'oscuro' | 'sistema'

interface ThemeState {
  tema: Tema
  setTema: (t: Tema) => void
  toggleTema: () => void  // alterna entre claro y oscuro
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      tema: 'sistema',

      setTema: (tema) => set({ tema }),

      toggleTema: () => {
        const actual = get().tema
        // Si es sistema, pasar a oscuro; si oscuro → claro; si claro → oscuro
        const siguiente: Tema =
          actual === 'oscuro' ? 'claro' : 'oscuro'
        set({ tema: siguiente })
      },
    }),
    {
      name: 'pos-tema',
    }
  )
)

// Utilidad: resuelve si el modo activo es oscuro considerando "sistema"
export function esModoOscuroActivo(tema: Tema): boolean {
  if (tema === 'oscuro') return true
  if (tema === 'claro')  return false
  // sistema → preguntar al OS
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
