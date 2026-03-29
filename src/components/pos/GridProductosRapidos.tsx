import { useState, useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../../db/database'
import type { Producto } from '../../db/schema'
import { useVentaStore } from '../../stores/ventaStore'
import { formatCOP } from '../../utils/moneda'

// Productos fijos más vendidos en tienda bogotana — nombre exacto del seed
const PRODUCTOS_RAPIDOS: { nombre: string; emoji: string }[] = [
  { nombre: 'Leche Entera Colanta 1L',    emoji: '🥛' },
  { nombre: 'Mogolla Criolla x1',         emoji: '🍞' },
  { nombre: 'Huevo Rojo AA x1',           emoji: '🥚' },
  { nombre: 'Gaseosa Coca-Cola 400ml',    emoji: '🥤' },
  { nombre: 'Agua Cristal 600ml',         emoji: '💧' },
  { nombre: 'Arroz Diana 1kg',            emoji: '🌾' },
  { nombre: 'Azúcar Blanca 1kg',          emoji: '🧂' },
  { nombre: 'Aceite de Cocina 500ml',     emoji: '🫙' },
  { nombre: 'Café Colcafé x1 bolsita',    emoji: '☕' },
  { nombre: 'Marlboro Rojo x1',           emoji: '🚬' },
  { nombre: 'Pan Tajado Bimbo Blanco',    emoji: '🍞' },
  { nombre: 'Aromática de Manzanilla x1', emoji: '🌿' },
]

interface CardProps {
  producto: Producto
  emoji: string
}

function CardProducto({ producto, emoji }: CardProps) {
  const agregarItem = useVentaStore((s) => s.agregarItem)

  const handleClick = () => {
    agregarItem({
      productoId: producto.id,
      nombreProducto: producto.nombre,
      cantidad: 1,
      precioUnitario: producto.precio,
      descuento: 0,
      esProductoFantasma: false,
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex flex-col items-center justify-center gap-1 p-2
                 bg-white border border-borde rounded-xl
                 hover:border-primario hover:bg-primario/5
                 active:scale-95 active:bg-primario/10
                 transition-all min-h-[80px] text-center"
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="text-xs font-medium text-texto leading-tight line-clamp-2 w-full">
        {producto.nombre.length > 20 ? producto.nombre.slice(0, 18) + '…' : producto.nombre}
      </span>
      <span className="moneda text-primario font-bold text-sm">{formatCOP(producto.precio)}</span>
    </button>
  )
}

// Tipo interno del grid
type GridItem = { producto: Producto; emoji: string }

export function GridProductosRapidos() {
  // undefined = cargando, [] = sin resultados, [...] = datos listos
  const [gridItems, setGridItems] = useState<GridItem[] | undefined>(undefined)

  useEffect(() => {
    // Usamos liveQuery directamente para controlar el ciclo de vida
    // de la suscripción. Esto evita el bug de dexie-react-hooks donde
    // useLiveQuery no re-suscribe correctamente tras desmontar/remontar
    // el componente al navegar con React Router v7 + StrictMode.
    const subscription = liveQuery(async (): Promise<GridItem[]> => {
      // 1. Buscar los 12 productos por nombre exacto del seed
      const found = await Promise.all(
        PRODUCTOS_RAPIDOS.map(({ nombre }) =>
          db.productos.where('nombre').equals(nombre).filter((p) => p.activo).first()
        )
      )

      const nombrados = PRODUCTOS_RAPIDOS.reduce<GridItem[]>((acc, { emoji }, i) => {
        const p = found[i]
        if (p) acc.push({ producto: p, emoji })
        return acc
      }, [])

      // 2. Fallback: si ninguno del listado coincide, mostrar los primeros 12 activos
      if (nombrados.length === 0) {
        const todos = await db.productos
          .filter((p) => p.activo && !p.esFantasma)
          .limit(12)
          .toArray()
        return todos.map((producto) => ({ producto, emoji: '📦' }))
      }

      return nombrados
    }).subscribe({
      next: (resultado) => setGridItems(resultado),
      error: (err) => {
        // Si la query falla no bloqueamos la venta — mostramos vacío
        console.error('[GridProductosRapidos] Error al cargar productos rápidos:', err)
        setGridItems([])
      },
    })

    // Cleanup garantiza que al desmontar (navegación) se cancela la suscripción
    // y al remontar se crea una nueva limpia
    return () => subscription.unsubscribe()
  }, []) // sin deps: la suscripción vive mientras el componente está montado

  // ── Skeleton de carga ────────────────────────────────────────────────────────
  if (gridItems === undefined) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  // ── Sin productos ────────────────────────────────────────────────────────────
  if (gridItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-suave text-sm">
        Sin productos disponibles
      </div>
    )
  }

  // ── Grid ─────────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-3 gap-2">
      {gridItems.map(({ producto, emoji }) => (
        <CardProducto key={producto.id} producto={producto} emoji={emoji} />
      ))}
    </div>
  )
}
