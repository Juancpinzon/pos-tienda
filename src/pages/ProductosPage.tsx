import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Plus, Ghost, Pencil, Power, ChevronDown, ChevronRight, Link2, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { listarMapeos, eliminarMapeo, actualizarMapeo } from '../lib/mapeoSKU'
import type { MapeoSKU } from '../db/schema'
import {
  useProductos,
  useCategorias,
  useProductosFantasma,
  toggleActivo,
} from '../hooks/useProductos'
import { FormProducto } from '../components/productos/FormProducto'
import { AlertasStock } from '../components/stock/AlertasStock'
import { formatCOP } from '../utils/moneda'
import type { Producto } from '../db/schema'

// ─── Sección de mapeos SKU ────────────────────────────────────────────────────

function SeccionMapeosSKU() {
  const [abierto, setAbierto]       = useState(false)
  const [mapeos, setMapeos]         = useState<MapeoSKU[]>([])
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [nuevoNombre, setNuevoNombre] = useState('')

  // Recargar cuando se abre la sección o cambia la DB
  const mapeosBD = useLiveQuery(() => db.mapeosSKU.orderBy('vecesUsado').reverse().toArray(), [])

  useEffect(() => {
    if (mapeosBD) setMapeos(mapeosBD)
  }, [mapeosBD])

  const handleEliminar = async (id: number) => {
    await eliminarMapeo(id)
  }

  const handleGuardarEdicion = async (mapeo: MapeoSKU) => {
    if (!mapeo.id || !nuevoNombre.trim()) return
    await actualizarMapeo(mapeo.id, { nombreProveedor: nuevoNombre.trim() })
    setEditandoId(null)
    setNuevoNombre('')
  }

  if (mapeos.length === 0 && !abierto) return null

  return (
    <div className="mx-3 mb-2">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-white rounded-xl border border-borde
                   hover:bg-fondo transition-colors text-left"
      >
        <Link2 size={16} className="text-primario shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-texto">Nombres de proveedores</p>
          <p className="text-xs text-suave">
            {mapeos.length} asociación{mapeos.length !== 1 ? 'es' : ''} aprendida{mapeos.length !== 1 ? 's' : ''}
          </p>
        </div>
        {abierto ? <ChevronDown size={16} className="text-suave" /> : <ChevronRight size={16} className="text-suave" />}
      </button>

      {abierto && (
        <div className="mt-1 bg-white rounded-xl border border-borde overflow-hidden">
          {mapeos.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Link2 size={28} className="text-suave/40 mx-auto mb-2" />
              <p className="text-sm text-suave">
                Aún no hay mapeos. Se crean cuando usted escanea facturas
                y asocia los productos.
              </p>
            </div>
          ) : (
            <>
              {/* Cabecera */}
              <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-4 py-2 border-b border-borde/50">
                <span className="text-[11px] font-semibold text-suave uppercase">En factura</span>
                <span className="text-[11px] font-semibold text-suave uppercase">En catálogo</span>
                <span className="text-[11px] font-semibold text-suave uppercase text-right">Usos</span>
                <span />
              </div>

              {mapeos.map((m) => (
                <div key={m.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center
                                           px-4 py-3 border-b last:border-0 border-borde/30">
                  {/* Nombre proveedor — editable */}
                  {editandoId === m.id ? (
                    <input
                      autoFocus
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleGuardarEdicion(m)
                        if (e.key === 'Escape') { setEditandoId(null); setNuevoNombre('') }
                      }}
                      className="h-7 px-2 border border-primario rounded-lg text-xs text-texto
                                 focus:outline-none focus:ring-1 focus:ring-primario/40"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setEditandoId(m.id!); setNuevoNombre(m.nombreProveedor) }}
                      className="text-xs text-texto font-mono text-left hover:text-primario transition-colors truncate"
                      title="Clic para editar"
                    >
                      {m.nombreProveedor}
                    </button>
                  )}

                  {/* Nombre interno */}
                  <span className="text-xs text-suave truncate">{m.nombreProducto}</span>

                  {/* Veces usado */}
                  <span className="text-xs font-bold text-primario text-right tabular-nums">{m.vecesUsado}×</span>

                  {/* Eliminar */}
                  <button
                    type="button"
                    onClick={() => m.id && handleEliminar(m.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg
                               text-suave hover:text-peligro hover:bg-peligro/5 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ProductosPage() {
  const [query, setQuery] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<number | null>(null)
  const [mostrarInactivos, setMostrarInactivos] = useState(false)

  // Modal de creación/edición
  const [mostrarForm, setMostrarForm] = useState(false)
  const [productoEditar, setProductoEditar] = useState<Producto | null | undefined>(undefined)
  const [nombrePreset, setNombrePreset] = useState<string | undefined>()
  const [codigoBarrasPreset, setCodigoBarrasPreset] = useState<string | undefined>()

  // Fantasmas expandido
  const [fantasmasAbierto, setFantasmasAbierto] = useState(true)

  // Auto-abrir formulario de nuevo producto si viene del escáner (?nuevo=1&codigoBarras=XXX)
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('nuevo') === '1') {
      const cb = searchParams.get('codigoBarras') ?? undefined
      setProductoEditar(null)
      setNombrePreset(undefined)
      setCodigoBarrasPreset(cb)
      setMostrarForm(true)
      // Limpiar los query params para que no se re-abra al navegar
      setSearchParams({}, { replace: true })
    }
  }, []) // solo al montar

  // Ref para hacer scroll al panel de productos en móvil al cambiar categoría
  const productosPanelRef = useRef<HTMLDivElement>(null)

  // ── Datos ──────────────────────────────────────────────────────────────────
  const categorias = useCategorias()
  const productos = useProductos({
    categoriaId: categoriaFiltro ?? undefined,
    query,
    soloActivos: !mostrarInactivos,
  })
  const fantasmas = useProductosFantasma()

  // Conteo por categoría sin filtro de texto (para el sidebar — siempre muestra totales reales)
  const conteoPorCatTotal = useLiveQuery(async () => {
    const all = await db.productos.filter((p) => (mostrarInactivos ? true : p.activo)).toArray()
    const c: Record<number, number> = {}
    let total = 0
    all.forEach((p) => {
      c[p.categoriaId] = (c[p.categoriaId] ?? 0) + 1
      total++
    })
    return { porCat: c, total }
  }, [mostrarInactivos])

  // Mapa categoriaId → categoría para lookup rápido
  const catMap = useMemo(() => {
    const m: Record<number, { emoji: string; nombre: string }> = {}
    categorias?.forEach((c) => {
      if (c.id !== undefined) m[c.id] = { emoji: c.emoji, nombre: c.nombre }
    })
    return m
  }, [categorias])

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

  const seleccionarCategoria = (id: number | null) => {
    setCategoriaFiltro(id)
    // En móvil, hacer scroll al panel de productos automáticamente
    if (window.innerWidth < 768) {
      setTimeout(() => {
        productosPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }
  }

  const abrirNuevo = (presetNombre?: string, presetCodigo?: string) => {
    setProductoEditar(null)
    setNombrePreset(presetNombre)
    setCodigoBarrasPreset(presetCodigo)
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
    setCodigoBarrasPreset(undefined)
  }

  // ── Fila de producto ───────────────────────────────────────────────────────

  const FilaProducto = ({ p }: { p: Producto }) => {
    const cat = p.categoriaId ? catMap[p.categoriaId] : null
    const bajStock = p.stockActual !== undefined && p.stockMinimo !== undefined && p.stockActual <= p.stockMinimo

    return (
      <div className={[
        'flex items-start gap-3 px-4 py-3 min-h-[56px] border-b border-borde/50 last:border-0',
        !p.activo ? 'opacity-50' : '',
      ].join(' ')}>

        {/* Emoji categoría */}
        <span className="text-xl shrink-0 w-8 text-center">{cat?.emoji ?? '📦'}</span>

        {/* Nombre + badges */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-texto break-words">{p.nombre}</p>
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
        <span className="moneda font-bold text-sm text-primario shrink-0 pt-[1px]">
          {formatCOP(p.precio)}
        </span>

        {/* Acciones */}
        <div className="flex items-center gap-1 shrink-0 -mt-1">
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

      {/* ── Barra superior: buscador + toggle inactivos ────────────────── */}
      <div className="bg-white border-b border-borde shrink-0">
        <div className="flex items-center gap-2 px-4 pt-3 pb-3">
          {/* Buscador */}
          <div className="relative flex-1">
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
          {/* Toggle inactivos */}
          <button
            type="button"
            onClick={() => setMostrarInactivos((v) => !v)}
            className={`shrink-0 text-xs font-medium px-3 py-2 rounded-xl border transition-colors ${
              mostrarInactivos
                ? 'text-primario bg-primario/10 border-primario/30'
                : 'text-suave border-borde hover:text-texto hover:bg-fondo'
            }`}
          >
            {mostrarInactivos ? 'Con inactivos' : 'Ver inactivos'}
          </button>
        </div>
      </div>

      {/* ── Body: sidebar de categorías + panel de productos ───────────── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* ── Sidebar vertical de categorías ─────────────────────────── */}
        <aside className="
          shrink-0 bg-white border-b md:border-b-0 md:border-r border-borde
          overflow-y-auto
          max-h-[42vw] md:max-h-none md:w-[200px]
        ">
          {/* Fila "Todos" */}
          <button
            type="button"
            onClick={() => seleccionarCategoria(null)}
            className={[
              'w-full flex items-center gap-2.5 px-3 py-0 min-h-[56px] text-left transition-colors',
              categoriaFiltro === null
                ? 'bg-primario text-white'
                : 'text-texto hover:bg-gray-50',
            ].join(' ')}
          >
            <span className="text-lg w-6 text-center shrink-0">📦</span>
            <span className="flex-1 text-[15px] font-medium truncate">Todos</span>
            <span className={`text-xs tabular-nums shrink-0 ${
              categoriaFiltro === null ? 'text-white/70' : 'text-suave'
            }`}>
              {conteoPorCatTotal?.total ?? ''}
            </span>
          </button>

          {/* Fila por cada categoría */}
          {categorias?.map((c) => {
            const activa = categoriaFiltro === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => seleccionarCategoria(c.id!)}
                className={[
                  'w-full flex items-center gap-2.5 px-3 py-0 min-h-[56px] text-left transition-colors',
                  'border-t border-borde/40',
                  activa
                    ? 'bg-primario text-white'
                    : 'text-texto hover:bg-gray-50',
                ].join(' ')}
              >
                <span className="text-lg w-6 text-center shrink-0">{c.emoji}</span>
                <span className="flex-1 text-[15px] font-medium truncate leading-tight">{c.nombre}</span>
                <span className={`text-xs tabular-nums shrink-0 ${
                  activa ? 'text-white/70' : 'text-suave'
                }`}>
                  {conteoPorCatTotal?.porCat[c.id!] ?? 0}
                </span>
              </button>
            )
          })}
        </aside>

        {/* ── Panel de productos ─────────────────────────────────────── */}
        <div ref={productosPanelRef} className="flex-1 overflow-y-auto">

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
          <div className="h-4" />

          {/* ── Sección Nombres de Proveedores ────────────────────── */}
          <SeccionMapeosSKU />

          <div className="h-24" />
        </div>
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
          codigoBarrasPreset={codigoBarrasPreset}
          onClose={cerrarForm}
        />
      )}
    </div>
  )
}
