import { useState } from 'react'
import { Search, Plus, RotateCcw, ChevronDown, X, Share2, Trash2 } from 'lucide-react'
import {
  useProductosConStock,
  useMovimientosStock,
  registrarEntrada,
  registrarAjuste,
} from '../hooks/useStock'
import { obtenerConfig } from '../hooks/useConfig'
import { compartirPorWhatsApp } from '../utils/impresion'
import { formatCOP } from '../utils/moneda'
import type { Producto, MovimientoStock } from '../db/schema'
import { ModalRegistrarMerma } from '../components/inventario/ModalRegistrarMerma'
import { useMermas } from '../hooks/useMermas'
import { AlertasCaducidad } from '../components/inventario/AlertasCaducidad'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estadoStock(p: Producto): 'rojo' | 'amarillo' | 'verde' {
  if (p.stockActual === undefined || p.stockActual === null) return 'verde'
  if (p.stockMinimo === undefined) return 'verde'
  if (p.stockActual < p.stockMinimo) return 'rojo'
  if (p.stockActual === p.stockMinimo) return 'amarillo'
  return 'verde'
}

const ESTADO_COLOR = {
  rojo:     { bg: 'bg-red-100',    text: 'text-peligro',    dot: 'bg-peligro'    },
  amarillo: { bg: 'bg-yellow-50',  text: 'text-advertencia', dot: 'bg-advertencia' },
  verde:    { bg: 'bg-exito/10',   text: 'text-exito',       dot: 'bg-exito'      },
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function InventarioPage() {
  const [query, setQuery] = useState('')
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(false)
  const [productoExpandido, setProductoExpandido] = useState<number | null>(null)
  const [productoEntrada, setProductoEntrada] = useState<Producto | null>(null)
  const [productoAjuste, setProductoAjuste] = useState<Producto | null>(null)
  const [exportando, setExportando] = useState(false)
  const [mostrarModalMerma, setMostrarModalMerma] = useState(false)

  const productos = useProductosConStock(query)
  const { costoTotalMermasMes, mermas } = useMermas()

  // Filtro adicional: solo bajo mínimo
  const productosFiltrados = soloBajoMinimo
    ? productos?.filter((p) => estadoStock(p) !== 'verde')
    : productos

  const totalBajoMinimo = productos?.filter((p) => estadoStock(p) === 'rojo').length ?? 0

  const handleExportar = async () => {
    if (exportando) return
    setExportando(true)
    try {
      const config = await obtenerConfig()
      const bajos = productos?.filter((p) => estadoStock(p) !== 'verde') ?? []
      if (bajos.length === 0) {
        alert('✅ No hay productos bajo el mínimo.')
        return
      }
      const texto = [
        `🏪 ${config.nombreTienda} — Inventario bajo mínimo`,
        `📅 ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}`,
        '',
        '⚠️ PRODUCTOS A PEDIR:',
        ...bajos.map((p) => {
          const estado = estadoStock(p)
          const icono = estado === 'rojo' ? '🔴' : '🟡'
          const faltante =
            p.stockMinimo !== undefined && p.stockActual !== undefined
              ? ` (faltan ${p.stockMinimo - p.stockActual})`
              : ''
          return `${icono} ${p.nombre}: ${p.stockActual ?? 0} / mín ${p.stockMinimo ?? '—'}${faltante}`
        }),
        '',
        `Total: ${bajos.length} producto${bajos.length !== 1 ? 's' : ''} bajo mínimo`,
      ].join('\n')
      compartirPorWhatsApp(texto)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-fondo overflow-hidden">

      {/* Barra superior */}
      <div className="bg-white border-b border-borde px-4 py-3 flex items-center gap-2 shrink-0">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto con stock…"
            className="w-full h-10 pl-9 pr-3 border border-borde rounded-xl text-sm text-texto
                       focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario/50"
          />
        </div>
        {/* Botón registrar merma */}
        <button
          id="btn-registrar-merma-inventario"
          type="button"
          onClick={() => setMostrarModalMerma(true)}
          className="h-10 px-3 rounded-xl text-xs font-semibold border transition-colors shrink-0
                     whitespace-nowrap bg-peligro/10 text-peligro border-peligro/30
                     hover:bg-peligro/20 flex items-center gap-1.5"
        >
          <Trash2 size={13} />
          Merma
        </button>
        <button
          type="button"
          onClick={() => setSoloBajoMinimo((v) => !v)}
          className={[
            'h-10 px-3 rounded-xl text-xs font-semibold border transition-colors shrink-0 whitespace-nowrap',
            soloBajoMinimo
              ? 'bg-peligro/10 text-peligro border-peligro/30'
              : 'bg-white text-suave border-borde hover:text-texto',
          ].join(' ')}
        >
          {soloBajoMinimo ? '⚠️ Bajo mínimo' : 'Ver todos'}
        </button>
      </div>

      {/* Resumen rápido */}
      {totalBajoMinimo > 0 && (
        <div className="mx-4 mt-3 px-4 py-2.5 bg-red-50 border border-peligro/20 rounded-xl
                        flex items-center justify-between">
          <span className="text-sm font-medium text-peligro">
            🔴 {totalBajoMinimo} producto{totalBajoMinimo !== 1 ? 's' : ''} bajo mínimo
          </span>
          <button
            type="button"
            onClick={handleExportar}
            disabled={exportando}
            className="h-7 px-3 bg-[#25D366] text-white rounded-lg text-xs font-semibold
                       flex items-center gap-1 hover:opacity-90 transition-opacity
                       disabled:opacity-50"
          >
            <Share2 size={12} />
            WhatsApp
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 flex flex-col gap-3">
          
          {/* Alertas de Caducidad (Proactivas) */}
          {!soloBajoMinimo && !query && <AlertasCaducidad />}

          {/* Cargando */}
          {!productosFiltrados && (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-primario/30 border-t-primario rounded-full animate-spin" />
            </div>
          )}

          {/* Sin resultados */}
          {productosFiltrados?.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-3 text-suave/50">
              <span className="text-5xl">📦</span>
              <p className="text-sm font-medium text-center">
                {soloBajoMinimo
                  ? '✅ Todos los productos están sobre el mínimo'
                  : query
                  ? 'Sin resultados'
                  : 'No hay productos con stock controlado'}
              </p>
              {!query && !soloBajoMinimo && (
                <p className="text-xs text-center max-w-xs">
                  Edita un producto y define su "Stock actual" para empezar a controlarlo
                </p>
              )}
            </div>
          )}

          {/* Tarjetas de producto */}
          {productosFiltrados?.map((p) => (
            <TarjetaProductoStock
              key={p.id}
              producto={p}
              expandida={productoExpandido === p.id}
              onToggleExpand={() =>
                setProductoExpandido((v) => (v === p.id ? null : p.id!))
              }
              onEntrada={() => setProductoEntrada(p)}
              onAjuste={() => setProductoAjuste(p)}
            />
          ))}

          {/* ── Sección mermas del mes ──────────────────────────────────────────── */}
          <div className="mt-2 bg-white rounded-xl border border-peligro/20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-peligro/10">
              <div className="flex items-center gap-2">
                <Trash2 size={15} className="text-peligro" />
                <span className="text-sm font-semibold text-texto">Mermas del mes</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-suave">Costo total</p>
                <p className="moneda font-bold text-sm text-peligro">
                  {formatCOP(costoTotalMermasMes)}
                </p>
              </div>
            </div>

            {/* Botón ver detalle / registrar */}
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-xs text-suave">
                {mermas.length === 0
                  ? 'No hay mermas registradas este mes'
                  : `${mermas.filter((m) => {
                    const now = new Date()
                    return m.creadoEn >= new Date(now.getFullYear(), now.getMonth(), 1)
                  }).length} merma(s) registradas este mes`}
              </p>
              <button
                type="button"
                onClick={() => setMostrarModalMerma(true)}
                className="h-9 px-4 bg-peligro/10 text-peligro border border-peligro/30
                           rounded-xl text-xs font-semibold hover:bg-peligro/20 transition-colors
                           whitespace-nowrap flex items-center gap-1.5 shrink-0"
              >
                <Trash2 size={12} />
                Registrar merma
              </button>
            </div>
          </div>

          <div className="h-4" />
        </div>
      </div>

      {/* Modales */}
      {mostrarModalMerma && (
        <ModalRegistrarMerma onClose={() => setMostrarModalMerma(false)} />
      )}
      {productoEntrada && (
        <ModalEntradaStock
          producto={productoEntrada}
          onClose={() => setProductoEntrada(null)}
        />
      )}
      {productoAjuste && (
        <ModalAjusteStock
          producto={productoAjuste}
          onClose={() => setProductoAjuste(null)}
        />
      )}
    </div>
  )
}

// ─── TarjetaProductoStock ─────────────────────────────────────────────────────

function TarjetaProductoStock({
  producto,
  expandida,
  onToggleExpand,
  onEntrada,
  onAjuste,
}: {
  producto: Producto
  expandida: boolean
  onToggleExpand: () => void
  onEntrada: () => void
  onAjuste: () => void
}) {
  const estado = estadoStock(producto)
  const colores = ESTADO_COLOR[estado]
  const stockActual = producto.stockActual ?? 0

  return (
    <div className="bg-white rounded-xl border border-borde overflow-hidden">
      {/* Fila principal */}
      <div className="flex items-center gap-3 p-4">
        {/* Indicador de estado */}
        <div className={`w-3 h-3 rounded-full shrink-0 ${colores.dot}`} />

        {/* Info del producto */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-texto truncate">{producto.nombre}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-xs font-bold ${colores.text}`}>
              Stock: {stockActual}
            </span>
            {producto.stockMinimo !== undefined && (
              <span className="text-xs text-suave">
                / mín: {producto.stockMinimo}
              </span>
            )}
            {producto.precioCompra && (
              <span className="text-xs text-suave">
                · Costo: {formatCOP(producto.precioCompra)}
              </span>
            )}
            {estado === 'rojo' && producto.stockMinimo !== undefined && (
              <span className="text-xs text-peligro font-medium">
                · Faltan {producto.stockMinimo - stockActual}
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEntrada}
            className="h-8 px-2.5 bg-primario/10 text-primario border border-primario/20
                       rounded-lg text-xs font-semibold hover:bg-primario/20 transition-colors
                       flex items-center gap-1"
            title="Registrar entrada"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">Entrada</span>
          </button>
          <button
            type="button"
            onClick={onAjuste}
            className="h-8 px-2 text-suave hover:text-texto hover:bg-fondo
                       rounded-lg transition-colors flex items-center"
            title="Ajustar inventario"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={onToggleExpand}
            className="h-8 px-2 text-suave hover:text-texto hover:bg-fondo
                       rounded-lg transition-colors flex items-center"
            title="Ver historial"
          >
            <ChevronDown
              size={14}
              className={`transition-transform ${expandida ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Historial expandible */}
      {expandida && (
        <HistorialMovimientos productoId={producto.id} />
      )}
    </div>
  )
}

// ─── HistorialMovimientos ─────────────────────────────────────────────────────

function HistorialMovimientos({ productoId }: { productoId?: number }) {
  const movimientos = useMovimientosStock(productoId)

  if (!movimientos) {
    return (
      <div className="border-t border-borde/30 px-4 py-3 flex justify-center">
        <div className="w-4 h-4 border-2 border-primario/30 border-t-primario rounded-full animate-spin" />
      </div>
    )
  }

  if (movimientos.length === 0) {
    return (
      <div className="border-t border-borde/30 px-4 py-3 text-center text-xs text-suave">
        Sin movimientos registrados
      </div>
    )
  }

  return (
    <div className="border-t border-borde/30">
      <div className="px-4 py-2 text-xs font-medium text-suave bg-fondo/50">
        Últimos {movimientos.length} movimientos
      </div>
      <div className="divide-y divide-borde/20 max-h-48 overflow-y-auto">
        {movimientos.map((m) => (
          <FilaMovimiento key={m.id} movimiento={m} />
        ))}
      </div>
    </div>
  )
}

function FilaMovimiento({ movimiento: m }: { movimiento: MovimientoStock }) {
  const esEntrada = m.tipo === 'entrada'
  const esSalida = m.tipo === 'salida' || m.tipo === 'venta'

  const icono = esEntrada ? '↑' : esSalida ? '↓' : '⇄'
  const colorCantidad = esEntrada ? 'text-exito' : esSalida ? 'text-peligro' : 'text-texto'
  const signo = esEntrada ? '+' : esSalida ? '-' : ''

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className={`text-sm font-bold w-4 shrink-0 ${colorCantidad}`}>{icono}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-texto capitalize">
          {m.tipo === 'venta' ? 'Venta' : m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'salida' ? 'Salida' : 'Ajuste'}
          {m.nota && <span className="text-suave"> · {m.nota}</span>}
        </p>
        <p className="text-xs text-suave">
          {m.creadoEn.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
          {' '}
          {m.stockAnterior} → {m.stockNuevo}
        </p>
      </div>
      <span className={`moneda text-xs font-bold shrink-0 ${colorCantidad}`}>
        {signo}{m.cantidad}
      </span>
    </div>
  )
}

// ─── ModalEntradaStock ────────────────────────────────────────────────────────

function ModalEntradaStock({
  producto,
  onClose,
}: {
  producto: Producto
  onClose: () => void
}) {
  const [cantidad, setCantidad] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cantidadNum = parseFloat(cantidad || '0')

  const handleGuardar = async () => {
    if (cantidadNum <= 0 || guardando) return
    setGuardando(true)
    try {
      await registrarEntrada(
        producto.id!,
        cantidadNum,
        producto.precioCompra,
        nota.trim() || 'Entrada manual',
      )
      onClose()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-borde">
          <div className="flex-1">
            <p className="font-display font-bold text-texto">Registrar entrada</p>
            <p className="text-xs text-suave truncate">{producto.nombre}</p>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-suave hover:text-texto hover:bg-fondo">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between p-3 bg-fondo rounded-xl">
            <span className="text-sm text-suave">Stock actual</span>
            <span className="moneda font-bold text-texto">
              {producto.stockActual ?? 0}
              {producto.stockMinimo !== undefined && (
                <span className="text-xs text-suave font-normal ml-1">
                  (mín: {producto.stockMinimo})
                </span>
              )}
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-suave mb-1 block">Cantidad *</label>
            <input
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGuardar() }}
              placeholder="0"
              min={0.01}
              step={0.01}
              autoFocus
              className="w-full h-11 px-3 border border-borde rounded-xl text-sm moneda text-texto
                         focus:outline-none focus:ring-2 focus:ring-primario/30"
            />
            {cantidadNum > 0 && (
              <p className="text-xs text-exito mt-1 ml-1">
                Nuevo stock: {(producto.stockActual ?? 0) + cantidadNum}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-suave mb-1 block">Nota (opcional)</label>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: Pedido del lunes, factura #123"
              className="w-full h-11 px-3 border border-borde rounded-xl text-sm text-texto
                         focus:outline-none focus:ring-2 focus:ring-primario/30"
            />
          </div>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={cantidadNum <= 0 || guardando}
            className="h-12 bg-primario text-white rounded-xl font-display font-bold
                       hover:bg-primario-hover active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {guardando ? 'Guardando…' : 'Registrar entrada'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ModalAjusteStock ─────────────────────────────────────────────────────────

function ModalAjusteStock({
  producto,
  onClose,
}: {
  producto: Producto
  onClose: () => void
}) {
  const stockActual = producto.stockActual ?? 0
  const [conteoFisico, setConteoFisico] = useState(String(stockActual))
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  const conteoNum = parseFloat(conteoFisico || '0')
  const diferencia = conteoNum - stockActual

  const handleGuardar = async () => {
    if (guardando) return
    setGuardando(true)
    try {
      await registrarAjuste(
        producto.id!,
        conteoNum,
        nota.trim() || `Ajuste de inventario: ${stockActual} → ${conteoNum}`,
      )
      onClose()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-borde">
          <div className="flex-1">
            <p className="font-display font-bold text-texto">Ajuste de inventario</p>
            <p className="text-xs text-suave truncate">{producto.nombre}</p>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-suave hover:text-texto hover:bg-fondo">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between p-3 bg-fondo rounded-xl">
            <span className="text-sm text-suave">Stock en sistema</span>
            <span className="moneda font-bold text-texto">{stockActual}</span>
          </div>

          <div>
            <label className="text-xs font-medium text-suave mb-1 block">
              Conteo físico real *
            </label>
            <input
              type="number"
              value={conteoFisico}
              onChange={(e) => setConteoFisico(e.target.value)}
              min={0}
              step={0.01}
              autoFocus
              className="w-full h-11 px-3 border border-borde rounded-xl text-sm moneda text-texto
                         focus:outline-none focus:ring-2 focus:ring-primario/30"
            />
            {conteoFisico !== '' && diferencia !== 0 && (
              <p className={`text-xs mt-1 ml-1 font-medium ${diferencia > 0 ? 'text-exito' : 'text-peligro'}`}>
                Diferencia: {diferencia > 0 ? '+' : ''}{diferencia}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-suave mb-1 block">Motivo (opcional)</label>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: Conteo semanal, merma, robo"
              className="w-full h-11 px-3 border border-borde rounded-xl text-sm text-texto
                         focus:outline-none focus:ring-2 focus:ring-primario/30"
            />
          </div>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando || conteoFisico === '' || conteoNum < 0}
            className="h-12 bg-acento text-white rounded-xl font-display font-bold
                       hover:bg-acento/90 active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {guardando ? 'Guardando…' : 'Aplicar ajuste'}
          </button>
        </div>
      </div>
    </div>
  )
}
