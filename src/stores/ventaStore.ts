import { create } from 'zustand'
import type { ItemCarrito } from '../types'

interface VentaStore {
  items: ItemCarrito[]
  agregarItem: (item: Omit<ItemCarrito, 'subtotal'>) => void
  quitarItem: (index: number) => void
  cambiarCantidad: (index: number, cantidad: number) => void
  cambiarPrecio: (index: number, precio: number) => void
  limpiarCarrito: () => void
}

function sub(cantidad: number, precio: number, descuento: number): number {
  return Math.round(cantidad * precio - descuento)
}

export const useVentaStore = create<VentaStore>((set) => ({
  items: [],

  agregarItem: (nuevo) =>
    set((state) => {
      // Si el mismo producto (no fantasma) ya existe → incrementar cantidad
      if (!nuevo.esProductoFantasma && nuevo.productoId !== undefined) {
        const idx = state.items.findIndex((i) => i.productoId === nuevo.productoId)
        if (idx >= 0) {
          const items = [...state.items]
          const item = items[idx]
          const cant = item.cantidad + (nuevo.cantidad ?? 1)
          items[idx] = { ...item, cantidad: cant, subtotal: sub(cant, item.precioUnitario, item.descuento) }
          return { items }
        }
      }
      // Nuevo item
      const cant = nuevo.cantidad ?? 1
      const desc = nuevo.descuento ?? 0
      const item: ItemCarrito = { ...nuevo, cantidad: cant, descuento: desc, subtotal: sub(cant, nuevo.precioUnitario, desc) }
      return { items: [...state.items, item] }
    }),

  quitarItem: (index) =>
    set((state) => ({ items: state.items.filter((_, i) => i !== index) })),

  cambiarCantidad: (index, cantidad) =>
    set((state) => {
      if (cantidad < 0.1) return state
      const items = [...state.items]
      const item = items[index]
      items[index] = { ...item, cantidad, subtotal: sub(cantidad, item.precioUnitario, item.descuento) }
      return { items }
    }),

  cambiarPrecio: (index, precio) =>
    set((state) => {
      if (precio < 0) return state
      const items = [...state.items]
      const item = items[index]
      items[index] = { ...item, precioUnitario: precio, subtotal: sub(item.cantidad, precio, item.descuento) }
      return { items }
    }),

  limpiarCarrito: () => set({ items: [] }),
}))

// Selector derivado — usar en componentes para evitar re-renders
export const selectTotal = (s: VentaStore): number =>
  s.items.reduce((acc, item) => acc + item.subtotal, 0)

export const selectConteo = (s: VentaStore): number =>
  s.items.reduce((acc, item) => acc + item.cantidad, 0)
