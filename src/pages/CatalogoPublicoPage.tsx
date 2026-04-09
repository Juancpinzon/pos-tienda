// Catálogo público de la tienda — sin autenticación, sin layout del POS
// Ruta: /catalogo/:slug
// Diseño limpio mobile-first para clientes externos

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { obtenerCatalogoPorSlug } from '../hooks/useDomicilios'
import type { CatalogoPublico, Categoria, Producto } from '../db/schema'
import { formatCOP } from '../utils/moneda'

// ─── Estado ───────────────────────────────────────────────────────────────────

interface EstadoCatalogo {
  config: CatalogoPublico | null
  categorias: Categoria[]
  productos: Producto[]
  cargando: boolean
  noDisponible: boolean
}

// ─── Tarjeta de producto ──────────────────────────────────────────────────────

function TarjetaProducto({ producto }: { producto: Producto }) {
  const etiquetaUnidad: Record<Producto['unidad'], string> = {
    unidad:    'por unidad',
    gramo:     'por gramo',
    mililitro: 'por ml',
    porcion:   'por porción',
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0 pr-3">
        <p className="font-medium text-gray-900 text-sm leading-tight">{producto.nombre}</p>
        <p className="text-xs text-gray-400 mt-0.5">{etiquetaUnidad[producto.unidad]}</p>
      </div>
      <p className="moneda font-bold text-[--color-primario] text-base shrink-0">
        {formatCOP(producto.precio)}
      </p>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CatalogoPublicoPage() {
  const { slug } = useParams<{ slug: string }>()
  const [estado, setEstado] = useState<EstadoCatalogo>({
    config: null,
    categorias: [],
    productos: [],
    cargando: true,
    noDisponible: false,
  })

  useEffect(() => {
    if (!slug) {
      setEstado((s) => ({ ...s, cargando: false, noDisponible: true }))
      return
    }

    obtenerCatalogoPorSlug(slug)
      .then(({ config, categorias, productos }) => {
        if (!config) {
          setEstado({ config: null, categorias: [], productos: [], cargando: false, noDisponible: true })
        } else {
          setEstado({ config, categorias, productos, cargando: false, noDisponible: false })
        }
      })
      .catch(() => {
        setEstado((s) => ({ ...s, cargando: false, noDisponible: true }))
      })
  }, [slug])

  // ── Cargando ──────────────────────────────────────────────────────────────
  if (estado.cargando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[--color-primario]/20 border-t-[--color-primario] rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Cargando catálogo…</p>
        </div>
      </div>
    )
  }

  // ── No disponible ─────────────────────────────────────────────────────────
  if (estado.noDisponible || !estado.config) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 gap-4">
        <div className="text-5xl">🏪</div>
        <h1 className="font-bold text-xl text-gray-800 text-center">Catálogo no disponible</h1>
        <p className="text-gray-500 text-sm text-center max-w-xs">
          Este catálogo no existe o está temporalmente desactivado.
        </p>
      </div>
    )
  }

  const { config, categorias, productos } = estado

  // Agrupar productos por categoría
  const productosPorCategoria = categorias
    .sort((a, b) => a.orden - b.orden)
    .map((cat) => ({
      categoria: cat,
      productos: productos.filter((p) => p.categoriaId === cat.id),
    }))
    .filter((g) => g.productos.length > 0)

  const mensajeWhatsApp = encodeURIComponent(
    `${config.mensajeBienvenida ?? 'Hola! Quiero hacer un pedido:'}\n\n`
  )

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-4 text-white shadow-md"
        style={{ background: 'var(--color-primario, #1e3a5f)' }}
      >
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏪</span>
            <div>
              <h1 className="font-bold text-lg leading-none">Catálogo</h1>
              <p className="text-white/70 text-xs mt-0.5">Precios al {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}</p>
            </div>
          </div>
          {config.mensajeBienvenida && (
            <p className="text-white/85 text-sm mt-2 leading-snug">{config.mensajeBienvenida}</p>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-lg mx-auto px-4 pb-32 pt-4">
        {productosPorCategoria.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">No hay productos disponibles en este catálogo.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {productosPorCategoria.map(({ categoria, productos: prods }) => (
              <section key={categoria.id}>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span>{categoria.emoji}</span>
                  {categoria.nombre}
                </h2>
                <div className="bg-white rounded-2xl border border-gray-100 px-4 shadow-sm">
                  {prods.map((prod) => (
                    <TarjetaProducto key={prod.id} producto={prod} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Botón flotante de WhatsApp */}
      {config.whatsappNumero && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none">
          <div className="max-w-lg mx-auto pointer-events-auto">
            <a
              href={`https://wa.me/57${config.whatsappNumero}?text=${mensajeWhatsApp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full h-14 rounded-2xl font-bold text-base text-white shadow-lg
                         hover:opacity-90 active:scale-95 transition-all"
              style={{ background: '#25D366' }}
            >
              <MessageCircle size={22} />
              📱 Pedir por WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
