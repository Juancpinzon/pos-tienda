import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Ghost, X, ScanBarcode, PackagePlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../db/database'
import type { Producto } from '../../db/schema'
import { useVentaStore } from '../../stores/ventaStore'
import { formatCOP, parsearEntero } from '../../utils/moneda'
import { EscanerCodigoBarras } from './EscanerCodigoBarras'
import { ModalCantidadProducto } from './ModalCantidadProducto'

/** Unidades que activan el modal de cantidad/valor inverso */
const UNIDADES_PESABLES: Producto['unidad'][] = ['gramo', 'mililitro', 'porcion']

// Resultado de búsqueda por código de barras
type ResultadoScan =
  | { tipo: 'encontrado'; producto: Producto }
  | { tipo: 'no_encontrado'; codigo: string }
  | null

export function BuscadorProducto() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Producto[]>([])
  const [abierto, setAbierto] = useState(false)
  const [mostrarFantasma, setMostrarFantasma] = useState(false)
  const [fantasmaDesc, setFantasmaDesc] = useState('')
  const [fantasmaPrecio, setFantasmaPrecio] = useState('')
  const [mostrarEscaner, setMostrarEscaner] = useState(false)
  const [resultadoScan, setResultadoScan] = useState<ResultadoScan>(null)
  // Producto pesable seleccionado → abre ModalCantidadProducto
  const [productoModal, setProductoModal] = useState<Producto | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const agregarItem = useVentaStore((s) => s.agregarItem)

  // Búsqueda con debounce 300ms
  useEffect(() => {
    if (query.length < 2) {
      setResultados([])
      setAbierto(false)
      return
    }
    const timer = setTimeout(async () => {
      const lower = query.toLowerCase()
      const found = await db.productos
        .filter(
          (p) =>
            p.activo &&
            !p.esFantasma &&
            (p.nombre.toLowerCase().includes(lower) || p.codigoBarras === query)
        )
        .limit(8)
        .toArray()
      setResultados(found)
      setAbierto(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false)
        setMostrarFantasma(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const seleccionarProducto = (producto: Producto) => {
    setQuery('')
    setResultados([])
    setAbierto(false)

    // Productos por peso/volumen/porción → abrir modal de cantidad
    if (UNIDADES_PESABLES.includes(producto.unidad)) {
      setProductoModal(producto)
      return
    }

    // Producto por unidad → agregar directo al carrito (comportamiento original)
    agregarItem({
      productoId: producto.id,
      nombreProducto: producto.nombre,
      cantidad: 1,
      precioUnitario: producto.precio,
      descuento: 0,
      esProductoFantasma: false,
    })
    inputRef.current?.focus()
  }

  const agregarFantasma = () => {
    const precio = parsearEntero(fantasmaPrecio)
    if (precio <= 0) return
    agregarItem({
      productoId: undefined,
      nombreProducto: fantasmaDesc.trim() || 'Producto sin registrar',
      cantidad: 1,
      precioUnitario: precio,
      descuento: 0,
      esProductoFantasma: true,
    })
    setFantasmaDesc('')
    setFantasmaPrecio('')
    setMostrarFantasma(false)
    inputRef.current?.focus()
  }

  // ── Escáner de código de barras ────────────────────────────────────────────

  const handleCodigoDetectado = useCallback(async (codigo: string) => {
    setMostrarEscaner(false)

    // Buscar producto en Dexie por código de barras (exacto)
    const producto = await db.productos
      .where('codigoBarras').equals(codigo)
      .filter((p) => p.activo && !p.esFantasma)
      .first()

    if (producto) {
      setResultadoScan(null)
      // Pesable → abrir modal de cantidad
      if (UNIDADES_PESABLES.includes(producto.unidad)) {
        setProductoModal(producto)
        return
      }
      // Unidad → agregar directo
      agregarItem({
        productoId: producto.id,
        nombreProducto: producto.nombre,
        cantidad: 1,
        precioUnitario: producto.precio,
        descuento: 0,
        esProductoFantasma: false,
      })
    } else {
      // No encontrado → mostrar opciones
      setResultadoScan({ tipo: 'no_encontrado', codigo })
    }
  }, [agregarItem])

  return (
    <>
    {/* Modal para productos pesables */}
    {productoModal && (
      <ModalCantidadProducto
        producto={productoModal}
        onClose={() => { setProductoModal(null); inputRef.current?.focus() }}
      />
    )}
    <div ref={contenedorRef} className="relative w-full">
      {/* Input de búsqueda */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto o código de barras..."
            className="w-full h-12 pl-10 pr-4 bg-white border border-borde rounded-xl
                       text-base text-texto placeholder:text-suave
                       focus:outline-none focus:ring-2 focus:ring-primario/40 focus:border-primario"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResultados([]); setAbierto(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-suave hover:text-texto"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Botón escáner de código de barras */}
        <button
          type="button"
          onClick={() => { setMostrarEscaner(true); setAbierto(false); setResultadoScan(null) }}
          title="Escanear código de barras"
          className="flex items-center justify-center w-12 h-12 border border-borde
                     text-suave hover:border-primario hover:text-primario rounded-xl
                     transition-colors shrink-0"
        >
          <ScanBarcode size={20} />
        </button>

        {/* Botón vender sin registrar */}
        <button
          type="button"
          onClick={() => { setMostrarFantasma((v) => !v); setAbierto(false) }}
          className="flex items-center gap-2 h-12 px-4 border border-dashed border-suave
                     text-suave hover:border-acento hover:text-acento rounded-xl
                     transition-colors text-sm font-medium whitespace-nowrap"
        >
          <Ghost size={16} />
          Sin registrar
        </button>
      </div>

      {/* Resultado de scan: producto no encontrado */}
      {resultadoScan?.tipo === 'no_encontrado' && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1
                        bg-white border border-advertencia/50 rounded-xl shadow-lg p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-sm font-semibold text-advertencia leading-snug">
                Código no registrado
              </p>
              <p className="text-xs text-suave font-mono mt-0.5">{resultadoScan.codigo}</p>
            </div>
            <button
              type="button"
              onClick={() => setResultadoScan(null)}
              className="shrink-0 text-suave hover:text-texto"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {/* Opción 1: vender ahora sin registrar */}
            <button
              type="button"
              onClick={() => {
                setFantasmaDesc(resultadoScan.codigo)
                setResultadoScan(null)
                setMostrarFantasma(true)
              }}
              className="w-full h-11 rounded-xl border border-acento/40 text-acento
                         text-sm font-semibold hover:bg-acento/5 active:scale-95 transition-all
                         flex items-center justify-center gap-2"
            >
              <Ghost size={15} />
              Vender sin registrar
            </button>
            {/* Opción 2: ir a crear producto con el código pre-llenado */}
            <button
              type="button"
              onClick={() => {
                setResultadoScan(null)
                navigate(`/productos?nuevo=1&codigoBarras=${encodeURIComponent(resultadoScan.codigo)}`)
              }}
              className="w-full h-11 rounded-xl border border-primario/30 text-primario
                         text-sm font-semibold hover:bg-primario/5 active:scale-95 transition-all
                         flex items-center justify-center gap-2"
            >
              <PackagePlus size={15} />
              Crear producto con este código
            </button>
          </div>
        </div>
      )}

      {/* Dropdown resultados */}
      {abierto && resultados.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1
                        bg-white border border-borde rounded-xl shadow-lg overflow-hidden">
          {resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => seleccionarProducto(p)}
              className="w-full flex items-center justify-between px-4 py-3
                         hover:bg-fondo text-left transition-colors border-b border-borde/50 last:border-0"
            >
              <span className="text-base text-texto font-medium truncate pr-4">{p.nombre}</span>
              <span className="moneda text-primario font-bold shrink-0">{formatCOP(p.precio)}</span>
            </button>
          ))}
          {/* Sin resultados → ofrecer fantasma */}
          {resultados.length === 0 && (
            <div className="px-4 py-3 text-suave text-sm text-center">
              Sin resultados —{' '}
              <button
                type="button"
                className="text-acento font-medium hover:underline"
                onClick={() => { setAbierto(false); setMostrarFantasma(true) }}
              >
                vender sin registrar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sin resultados con query activo */}
      {abierto && resultados.length === 0 && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1
                        bg-white border border-borde rounded-xl shadow-lg">
          <div className="px-4 py-3 text-suave text-sm text-center">
            No se encontró «{query}» —{' '}
            <button
              type="button"
              className="text-acento font-medium hover:underline"
              onClick={() => {
                setFantasmaDesc(query)
                setAbierto(false)
                setMostrarFantasma(true)
              }}
            >
              vender sin registrar
            </button>
          </div>
        </div>
      )}

      {/* Modal escáner de código de barras */}
      {mostrarEscaner && (
        <EscanerCodigoBarras
          onCodigoDetectado={handleCodigoDetectado}
          onClose={() => setMostrarEscaner(false)}
        />
      )}

      {/* Formulario producto fantasma */}
      {mostrarFantasma && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1
                        bg-white border border-acento/40 rounded-xl shadow-lg p-4">
          <p className="text-sm font-semibold text-acento mb-3 flex items-center gap-2">
            <Ghost size={14} /> Vender sin registrar en sistema
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={fantasmaDesc}
              onChange={(e) => setFantasmaDesc(e.target.value)}
              placeholder="Descripción (opcional)"
              className="flex-1 h-11 px-3 border border-borde rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-acento/40"
            />
            <input
              type="number"
              value={fantasmaPrecio}
              onChange={(e) => setFantasmaPrecio(e.target.value)}
              placeholder="Precio $"
              min={0}
              className="w-32 h-11 px-3 border border-borde rounded-lg text-sm moneda
                         focus:outline-none focus:ring-2 focus:ring-acento/40"
              onKeyDown={(e) => e.key === 'Enter' && agregarFantasma()}
            />
            <button
              type="button"
              onClick={agregarFantasma}
              disabled={parsearEntero(fantasmaPrecio) <= 0}
              className="h-11 px-4 bg-acento text-white rounded-lg text-sm font-semibold
                         disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
            >
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
