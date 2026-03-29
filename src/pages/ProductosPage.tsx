import { useState, useMemo } from 'react'
import { Search, Plus, Ghost, Pencil, Power, ChevronDown, ChevronRight } from 'lucide-react'
import {
  useProductos,
  useCategorias,
  useProductosFantasma,
  toggleActivo,
} from '../hooks/useProductos'
import { CategoriaChip } from '../components/productos/CategoriaChip'
import { FormProducto } from '../components/productos/FormProducto'
import { AlertasStock } from '../components/stock/AlertasStock'
import { formatCOP } from '../utils/moneda'
import type { Producto } from '../db/schema'

export default function ProductosPage() {
  const [query, setQuery] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<number | null>(null)
  const [mostrarInactivos, setMostrarInactivos] = useState(false)

  // Modal de creación/edición
  const [mostrarForm, setMostrarForm] = useState(false)
  const [productoEditar, setProductoEditar] = useState<Producto | null | undefined>(undefined)
  const [nombrePreset, setNombrePreset] = useState<string | undefined>()

  // Fantasmas expandido
  const [fantasmasAbierto, setFantasmasAbierto] = useState(true)

  // ── Datos ──────────────────────────────────────────────────────────────────
  const categorias = useCategorias()
  const productos = useProductos({
    categoriaId: categoriaFiltro ?? undefined,
    query,
    soloActivos: !mostrarInactivos,
  })
  const fantasmas = useProductosFantasma()

  // Mapa categoriaId → categoría para lookup rápido
  const catMap = useMemo(() => {
    const m: Record<number, { emoji: string; nombre: string }> = {}
    categorias?.forEach((c) => {
      if (c.id !== undefined) m[c.id] = { emoji: c.emoji, nombre: c.nombre }
    })
    return m
  }, [categorias])

  // Conteo de productos por categoría (para los chips)
  const conteoPorCat = useMemo(() => {
    const c: Record<number, number> = {}
    productos?.forEach((p) => {
      c[p.categoriaId] = (c[p.categoriaId] ?? 0) + 1
    })
    return c
  }, [productos])

  // Productos agrupados por categoría (cuando no hay filtro ni búsqueda activa)
  const mostrarAgrupado = !categoriaFiltro && !query
  const productosAgrupados = useMemo(() => {
    if (!mostrarAgrupado || !productos) return null
    const grupos: Record<number, Producto[]> = {}
    for (const p of productos) {
      if (!grupos[p.categoriaId]) grupos[p.categoriaId] = []
      grupos[p.categoriaId].push(p)
    }
    return grupos
  }, [productos, mostrarAgrupado])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const abrirNuevo = (presetNombre?: string) => {
    setProductoEditar(null)
    setNombrePreset(presetNombre)
    setMostrarForm(true)
  }

  const abrirEdicion = (p: Producto) => {
    setProductoEditar(p)
    setNombrePreset(undefined)
    setMostrarForm(true)
  }

  const cerrarForm = () => {
    setMostrarForm(false)
    setProductoEditar(undefined)
    setNombrePreset(undefined)
  }

  // ── Fila de producto ───────────────────────────────────────────────────────

  const FilaProducto = ({ p }: { p: Producto }) => {
    const cat = p.categoriaId ? catMap[p.categoriaId] : null
    const bajStock = p.stockActual !== undefined && p.stockMinimo !== undefined && p.stockActual <= p.stockMinimo

    return (
      <div className={[
        'flex items-center gap-3 px-4 py-3 border-b border-borde/50 last:border-0',
        !p.activo ? 'opacity-50' : '',
      ].join(' ')}>

        {/* Emoji categoría */}
        <span className="text-xl shrink-0 w-8 text-center">{cat?.emoji ?? '📦'}</span>

        {/* Nombre + badges */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-texto truncate">{p.nombre}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {p.unidad !== 'unidad' && (
              <span className="text-xs text-suave capitalize">{p.unidad}</span>
            )}
            {p.stockActual !== undefined && (
              <span className={`text-xs font-medium ${bajStock ? 'text-advertencia' : 'text-suave'}`}>
                {bajStock ? '⚠️ ' : ''}Stock: {p.stockActual}
              </span>
            )}
            {!p.activo && (
              <span className="text-xs text-suave bg-gray-100 px-1.5 rounded">Inactivo</span>
            )}
          </div>
        </div>

        {/* Precio */}
        <span className="moneda font-bold text-sm text-primario shrink-0">
          {formatCOP(p.precio)}
        </span>

        {/* Acciones */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => abrirEdicion(p)}
            className="w-9 h-9 flex items-center justify-center rounded-lg
                       text-suave hover:text-primario hover:bg-primario/10 transition-colors"
            title="Editar"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => p.id !== undefined && toggleActivo(p.id)}
            className="w-9 h-9 flex items-center justify-center rounded-lg
                       text-suave hover:text-texto hover:bg-gray-100 transition-colors"
            title={p.activo ? 'Desactivar' : 'Activar'}
          >
            <Power size={15} />
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-fondo overflow-hidden">

      {/* ── Barra superior ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-borde shrink-0">
        {/* Buscador */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto…"
              className="w-full h-10 pl-9 pr-4 bg-fondo border border-borde rounded-xl
                         text-sm focus:outline-none focus:ring-2 focus:ring-primario/40"
            />
          </div>
        </div>

        {/* Chips de categoría — scroll horizontal */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          <CategoriaChip
            emoji="🏪"
            nombre="Todos"
            count={productos?.length}
            selected={categoriaFiltro === null}
            onClick={() => setCategoriaFiltro(null)}
          />
          {categorias?.map((c) => (
            <CategoriaChip
              key={c.id}
              emoji={c.emoji}
              nombre={c.nombre}
              count={conteoPorCat[c.id!]}
              selected={categoriaFiltro === c.id}
              onClick={() => setCategoriaFiltro(c.id === categoriaFiltro ? null : c.id!)}
            />
          ))}
        </div>

        {/* Toggle inactivos */}
        <div className="flex items-center justify-end px-4 pb-2">
          <button
            type="button"
            onClick={() => setMostrarInactivos((v) => !v)}
            className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
              mostrarInactivos ? 'text-primario bg-primario/10' : 'text-suave hover:text-texto'
            }`}
          >
            {mostrarInactivos ? 'Ocultando activos' : 'Ver inactivos'}
          </button>
        </div>
      </div>

      {/* ── Cuerpo scrollable ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Sección: Alertas de stock bajo mínimo */}
        {!query && !categoriaFiltro && <AlertasStock />}

        {/* Sección: Fantasmas pendientes */}
        {fantasmas && fantasmas.length > 0 && !query && !categoriaFiltro && (
          <div className="mx-4 mt-4 border border-acento/40 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setFantasmasAbierto((v) => !v)}
              className="w-full flex items-center gap-2 px-4 py-3 bg-orange-50 hover:bg-orange-100 transition-colors"
            >
              <Ghost size={16} className="text-acento" />
              <span className="text-sm font-semibold text-acento flex-1 text-left">
                {fantasmas.length} producto{fantasmas.length !== 1 ? 's' : ''} vendido{fantasmas.length !== 1 ? 's' : ''} sin registrar
              </span>
              {fantasmasAbierto ? (
                <ChevronDown size={16} className="text-acento" />
              ) : (
                <ChevronRight size={16} className="text-acento" />
              )}
            </button>

            {fantasmasAbierto && (
              <div className="divide-y divide-borde/50 bg-white">
                {fantasmas.map((f) => (
                  <div key={f.nombreProducto} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-xl">👻</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-texto truncate">
                        {f.nombreProducto === 'Producto sin registrar' ? '(sin descripción)' : f.nombreProducto}
                      </p>
                      <p className="text-xs text-suave">
                        Vendido {f.conteo}x · Último precio: {formatCOP(f.precioUltimo)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => abrirNuevo(f.nombreProducto === 'Producto sin registrar' ? '' : f.nombreProducto)}
                      className="shrink-0 h-8 px-3 bg-acento/10 text-acento border border-acento/30
                                 rounded-lg text-xs font-semibold hover:bg-acento/20 transition-colors"
                    >
                      Registrar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lista de productos */}
        <div className="mx-4 my-4 bg-white rounded-xl border border-borde overflow-hidden">

          {/* Sin resultados */}
          {productos?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-suave/60">
              <span className="text-4xl">📦</span>
              <p className="text-sm text-center">
                {query
                  ? `Sin resultados para "${query}"`
                  : categoriaFiltro
                    ? 'No hay productos en esta categoría'
                    : 'No hay productos registrados'}
              </p>
            </div>
          )}

          {/* Lista agrupada por categoría (cuando no hay filtro/búsqueda) */}
          {mostrarAgrupado && productosAgrupados && categorias &&
            categorias
              .filter((c) => productosAgrupados[c.id!]?.length > 0)
              .map((c) => (
                <div key={c.id}>
                  <div className="flex items-center gap-2 px-4 py-2 bg-fondo sticky top-0 z-10
                                  border-b border-borde/50">
                    <span>{c.emoji}</span>
                    <span className="text-xs font-semibold text-suave uppercase tracking-wide">
                      {c.nombre}
                    </span>
                    <span className="text-xs text-suave ml-auto">
                      {productosAgrupados[c.id!].length}
                    </span>
                  </div>
                  {productosAgrupados[c.id!].map((p) => (
                    <FilaProducto key={p.id} p={p} />
                  ))}
                </div>
              ))
          }

          {/* Lista plana (cuando hay filtro o búsqueda activa) */}
          {!mostrarAgrupado && productos?.map((p) => (
            <FilaProducto key={p.id} p={p} />
          ))}
        </div>

        {/* Espacio para el FAB */}
        <div className="h-24" />
      </div>

      {/* ── FAB: Agregar producto ────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => abrirNuevo()}
        className="fixed bottom-6 right-6 w-16 h-16 bg-primario text-white
                   rounded-full shadow-xl flex items-center justify-center
                   hover:bg-primario-hover active:scale-90 transition-all z-20
                   shadow-primario/40"
        aria-label="Agregar producto"
      >
        <Plus size={28} />
      </button>

      {/* ── Modal formulario ─────────────────────────────────────────────── */}
      {mostrarForm && (
        <FormProducto
          producto={productoEditar}
          nombrePreset={nombrePreset}
          onClose={cerrarForm}
        />
      )}
    </div>
  )
}
