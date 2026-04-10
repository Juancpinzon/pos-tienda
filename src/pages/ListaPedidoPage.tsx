import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, Truck, MessageCircle, Package,
  Edit3, Check, X, ChevronRight, RefreshCw, ShoppingCart,
} from 'lucide-react'
import { db } from '../db/database'
import { obtenerConfig } from '../hooks/useConfig'
import { buscarProveedores } from '../hooks/useProveedores'
import { generarSugeridoCompra, type SugeridoCompra } from '../hooks/useStock'
import { formatCOP } from '../utils/moneda'
import type { Producto, Proveedor } from '../db/schema'

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface GrupoProveedor {
  proveedor: Proveedor & { id: number }
  items: SugeridoCompra[]
}

interface ResultadoPedido {
  grupos: GrupoProveedor[]
  sinProveedor: SugeridoCompra[]
  totalUrgentes: number
  totalPronto: number
  inversionEstimada: number
}

type FiltroPrioridad = 'todos' | 'urgente' | 'pronto' | 'planificar'

// ─── Algoritmo de Agrupación ──────────────────────────────────────────────────

async function agruparSugeridos(sugeridos: SugeridoCompra[]): Promise<ResultadoPedido> {
  // 1. Asociar producto → proveedor (proveedor más reciente del que se compró)
  const todasCompras = await db.comprasProveedor.orderBy('creadaEn').reverse().toArray()
  const comprasMap = new Map(todasCompras.map((c) => [c.id!, c]))

  const todosDetallesCompra = await db.detallesCompra
    .filter((d) => d.productoId !== undefined)
    .toArray()

  // Mapa productoId → {proveedorId, fecha} de la compra más reciente
  const productoProveedor: Record<number, { proveedorId: number; fecha: Date }> = {}
  for (const dc of todosDetallesCompra) {
    if (!dc.productoId) continue
    const compra = comprasMap.get(dc.compraId)
    if (!compra) continue
    const existing = productoProveedor[dc.productoId]
    if (!existing || compra.creadaEn > existing.fecha) {
      productoProveedor[dc.productoId] = { proveedorId: compra.proveedorId, fecha: compra.creadaEn }
    }
  }

  // 2. Agrupar sugerencias por proveedor
  const todosProveedores = await db.proveedores.filter((p) => p.activo).toArray() as (Proveedor & { id: number })[]
  const proveedoresMap = new Map(todosProveedores.map((p) => [p.id, p]))

  const gruposMap: Record<number, GrupoProveedor> = {}
  const sinProveedor: SugeridoCompra[] = []

  for (const sug of sugeridos) {
    const rel = productoProveedor[sug.productoId]
    if (rel) {
      const proveedor = proveedoresMap.get(rel.proveedorId)
      if (proveedor) {
        if (!gruposMap[proveedor.id]) {
          gruposMap[proveedor.id] = { proveedor, items: [] }
        }
        gruposMap[proveedor.id].items.push(sug)
        continue
      }
    }
    sinProveedor.push(sug)
  }

  const grupos = Object.values(gruposMap)
    .sort((a, b) => {
      // Priorizar grupos con más urgencias
      const urgA = a.items.filter((i) => i.prioridad === 'urgente').length
      const urgB = b.items.filter((i) => i.prioridad === 'urgente').length
      return urgB - urgA
    })

  // 3. Totales
  const totalUrgentes = sugeridos.filter((s) => s.prioridad === 'urgente').length
  const totalPronto = sugeridos.filter((s) => s.prioridad === 'pronto').length

  let inversionEstimada = 0
  for (const s of sugeridos) {
    // Necesitamos el producto para el precioCompra
    const p = await db.productos.get(s.productoId)
    if (p?.precioCompra && p.precioCompra > 0) {
      inversionEstimada += p.precioCompra * s.cantidadSugerida
    }
  }

  return { grupos, sinProveedor, totalUrgentes, totalPronto, inversionEstimada }
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

function BadgePrioridad({ prioridad }: { prioridad: SugeridoCompra['prioridad'] }) {
  if (prioridad === 'urgente') return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-peligro text-white">Urgente</span>
  )
  if (prioridad === 'pronto') return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-advertencia text-white">Pronto</span>
  )
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-exito text-white">Planificar</span>
  )
}

// ─── Fila de producto editable ────────────────────────────────────────────────

function FilaProducto({
  item,
  seleccionado,
  cantidad,
  onToggle,
  onCantidad,
}: {
  item: SugeridoCompra
  seleccionado: boolean
  cantidad: number
  onToggle: () => void
  onCantidad: (v: number) => void
}) {
  const [editando, setEditando] = useState(false)
  const [inputVal, setInputVal] = useState(String(cantidad))

  const confirmarEdicion = () => {
    const n = parseInt(inputVal, 10)
    if (!isNaN(n) && n >= 0) onCantidad(n)
    else setInputVal(String(cantidad))
    setEditando(false)
  }

  const colorPrioridad =
    item.prioridad === 'urgente' ? 'border-l-4 border-l-peligro bg-peligro/5'
    : item.prioridad === 'pronto' ? 'border-l-4 border-l-advertencia bg-advertencia/5'
    : 'border-l-4 border-l-exito bg-exito/5'

  const labelDias = item.diasRestantes < 1
    ? `Le quedan: ~${Math.round(item.diasRestantes * 24)} horas`
    : `Le quedan: ${Math.round(item.diasRestantes)} días`

  return (
    <div className={`flex items-start gap-3 px-3 py-3 ${colorPrioridad}`}>
      {/* Checkbox */}
      <button
        type="button"
        onClick={onToggle}
        className={[
          'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors',
          seleccionado ? 'bg-primario border-primario' : 'border-gray-300',
        ].join(' ')}
      >
        {seleccionado && <Check size={11} className="text-white" />}
      </button>

      {/* Info del producto */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <BadgePrioridad prioridad={item.prioridad} />
          <span className="text-sm font-bold text-texto truncate">
            {item.nombreProducto}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-suave">
              Stock: <span className="font-bold text-texto">{item.stockActual} {item.unidad}</span>
            </span>
            <span className="text-xs text-suave">
              | Vende: <span className="font-bold text-texto">{item.velocidadDiaria.toFixed(1)}/día</span>
            </span>
          </div>
          <p className={`text-xs font-semibold ${item.prioridad === 'urgente' ? 'text-peligro' : 'text-suave'}`}>
            {labelDias}
          </p>
        </div>
      </div>

      {/* Cantidad sugerida / editable */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        <p className="text-[10px] text-suave uppercase font-bold tracking-tight">Pedir</p>
        {editando ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmarEdicion(); if (e.key === 'Escape') { setEditando(false); setInputVal(String(cantidad)) } }}
              autoFocus
              className="w-16 h-8 text-center border border-primario rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-primario/30"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setEditando(true); setInputVal(String(cantidad)) }}
            className={`px-3 py-1 rounded-lg text-sm font-black transition-colors ${
              item.cantidadSugerida > 0 ? 'bg-primario text-white' : 'bg-gray-100 text-suave'
            }`}
          >
            {cantidad} {item.unidad}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Sección de proveedor ─────────────────────────────────────────────────────

function SeccionProveedor({
  grupo,
  seleccionados,
  cantidades,
  onToggle,
  onCantidad,
  nombreTienda,
}: {
  grupo: GrupoProveedor
  seleccionados: Record<number, boolean>
  cantidades: Record<number, number>
  onToggle: (id: number) => void
  onCantidad: (id: number, v: number) => void
  nombreTienda: string
}) {
  const { proveedor, items } = grupo

  const itemsSeleccionados = items.filter((i) => seleccionados[i.productoId])

  const handleWhatsApp = () => {
    if (itemsSeleccionados.length === 0) return

    const fecha = new Date().toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    })

    let totalAprox = 0
    const lineasProductos = itemsSeleccionados.map((i) => {
      const cant = cantidades[i.productoId] ?? i.cantidadSugerida
      // Nota: El SugeridoCompra no trae precioCompra, lo buscamos si es necesario o simplificamos el mensaje.
      // Para mantener el requerimiento "velocidad de venta (15 días cobertura)", omitimos el total si no lo tenemos a mano fácilmente en el item.
      return `• ${i.nombreProducto}: ${cant} ${i.unidad}`
    }).join('\n')

    const texto = [
      `📋 *Sugerido de Compra ${nombreTienda}*`,
      `📅 ${fecha}`,
      `_Basado en velocidad de venta (15 días cobertura)_`,
      ``,
      lineasProductos,
      ``,
      `_Enviado desde POS Tienda_`,
    ].join('\n')

    const tel = proveedor.telefono?.replace(/\D/g, '')
    const url = tel
      ? `https://wa.me/57${tel}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`

    window.open(url, '_blank')
  }

  const urgentesGrupo = items.filter((i) => i.prioridad === 'urgente').length

  return (
    <div className="bg-white rounded-xl border border-borde overflow-hidden">
      {/* Header del proveedor */}
      <div className="px-4 py-3 border-b border-borde/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-acento" />
          <div>
            <p className="text-sm font-bold text-texto">{proveedor.nombre}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {proveedor.diasVisita && (
                <span className="text-[10px] text-suave">📅 {proveedor.diasVisita}</span>
              )}
              {urgentesGrupo > 0 && (
                <span className="text-[10px] font-black text-peligro">
                  🔥 {urgentesGrupo} URGENTES
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleWhatsApp}
          disabled={itemsSeleccionados.length === 0}
          className="flex items-center gap-1.5 h-8 px-3 bg-[#25D366] text-white rounded-lg
                     text-xs font-bold hover:bg-[#20BA5A] active:scale-95 transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          <MessageCircle size={14} />
          WhatsApp
        </button>
      </div>

      {/* Lista de productos */}
      <div className="divide-y divide-borde/30">
        {items.map((item) => (
          <FilaProducto
            key={item.productoId}
            item={item}
            seleccionado={seleccionados[item.productoId] ?? true}
            cantidad={cantidades[item.productoId] ?? item.cantidadSugerida}
            onToggle={() => onToggle(item.productoId)}
            onCantidad={(v) => onCantidad(item.productoId, v)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Modal para asignar proveedor ─────────────────────────────────────────────

function ModalAsignarProveedor({
  producto,
  onClose,
  onAsignado,
}: {
  producto: Producto & { id: number }
  onClose: () => void
  onAsignado: () => void
}) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Proveedor[]>([])
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await buscarProveedores(query)
      setResultados(res)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  // "Asignar" = crear una DetalleCompra ficticia no hace sentido.
  // La asignación real se hace registrando una compra.
  // Aquí simplemente guiamos al usuario.
  void guardando; void setGuardando

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex items-center justify-between p-4 border-b border-borde">
          <p className="font-display font-bold text-base text-texto">Asignar proveedor</p>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-suave hover:text-texto hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <p className="text-sm text-suave">
            Para asignar un proveedor a <span className="font-semibold text-texto">{producto.nombre}</span>,
            ve a <strong>Proveedores → Nueva compra</strong> e incluye este producto.
            El sistema lo asociará automáticamente.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 border border-borde text-suave rounded-xl text-sm font-semibold hover:text-texto transition-colors"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => { onAsignado(); onClose() }}
              className="flex-1 h-10 bg-primario text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Entendido
            </button>
          </div>
        </div>
        {/* Mostrar proveedores disponibles como referencia */}
        {resultados.length > 0 || query.length === 0 ? null : (
          <div className="px-4 pb-4">
            <p className="text-xs text-suave">Proveedores registrados:</p>
            {resultados.map((p) => (
              <p key={p.id} className="text-sm text-texto py-1">{p.nombre}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ListaPedidoPage() {
  const [sugeridosOrigin, setSugeridosOrigin] = useState<SugeridoCompra[]>([])
  const [resultado, setResultado] = useState<ResultadoPedido | undefined>(undefined)
  const [cargando, setCargando] = useState(true)
  const [seleccionados, setSeleccionados] = useState<Record<number, boolean>>({})
  const [cantidades, setCantidades] = useState<Record<number, number>>({})
  const [nombreTienda, setNombreTienda] = useState('Mi Tienda')
  const [filtro, setFiltro] = useState<FiltroPrioridad>('todos')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const sugs = await generarSugeridoCompra()
      const [res, config] = await Promise.all([agruparSugeridos(sugs), obtenerConfig()])
      
      setSugeridosOrigin(sugs)
      setResultado(res)
      setNombreTienda(config.nombreTienda)

      // Inicializar seleccionados y cantidades
      const sel: Record<number, boolean> = {}
      const cant: Record<number, number> = {}
      for (const s of sugs) {
        sel[s.productoId] = true
        cant[s.productoId] = s.cantidadSugerida
      }
      setSeleccionados(sel)
      setCantidades(cant)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  // Aplicar filtro de prioridad
  useEffect(() => {
    if (!sugeridosOrigin) return
    let filtrados = sugeridosOrigin
    if (filtro !== 'todos') {
      filtrados = sugeridosOrigin.filter((s) => s.prioridad === filtro)
    }
    agruparSugeridos(filtrados).then(setResultado)
  }, [filtro, sugeridosOrigin])

  const toggleSeleccionado = (id: number) => {
    setSeleccionados((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const setCantidad = (id: number, v: number) => {
    setCantidades((prev) => ({ ...prev, [id]: v }))
  }

  const totalItems = sugeridosOrigin.length

  const inversionTotal = resultado
    ? [...resultado.grupos.flatMap((g) => g.items), ...resultado.sinProveedor]
        .filter((i) => seleccionados[i.productoId])
        .reduce((sum, i) => sum + (cantidades[i.productoId] ?? i.cantidadSugerida), 0) // Just a metric placeholder for now complex with priceCompra
    : 0

  return (
    <div className="h-full flex flex-col bg-fondo overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">

          {/* Header */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-xl text-texto">Sugerido de Compra</h2>
                <p className="text-xs text-suave">Análisis predictivo últimos 30 días</p>
              </div>
              <button
                type="button"
                onClick={cargar}
                disabled={cargando}
                className="w-10 h-10 flex items-center justify-center bg-white border border-borde rounded-xl text-suave hover:text-texto transition-all active:scale-95"
              >
                <RefreshCw size={18} className={cargando ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Filtros */}
            <div className="flex gap-2 p-1 bg-white border border-borde rounded-xl overflow-x-auto no-scrollbar">
              {(['todos', 'urgente', 'pronto', 'planificar'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltro(f)}
                  className={`flex-1 h-9 px-3 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${
                    filtro === f ? 'bg-primario text-white shadow-sm' : 'text-suave'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {cargando ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-primario/30 border-t-primario rounded-full animate-spin" />
            </div>
          ) : !resultado || totalItems === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="text-5xl">✅</div>
              <p className="font-display font-bold text-lg text-texto">¡Stock al día!</p>
              <p className="text-sm text-suave">No hay productos en riesgo de agotarse pronto.</p>
            </div>
          ) : (
            <>
              {/* Resumen ejecutivo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-borde rounded-xl p-3 flex flex-col gap-1">
                  <p className="text-[10px] font-bold text-suave uppercase">Urgentes</p>
                  <p className="text-2xl font-black text-peligro">{resultado.totalUrgentes}</p>
                </div>
                <div className="bg-white border border-borde rounded-xl p-3 flex flex-col gap-1">
                  <p className="text-[10px] font-bold text-suave uppercase">En riesgo</p>
                  <p className="text-2xl font-black text-advertencia">{resultado.totalPronto}</p>
                </div>
              </div>

              {/* Grupos por proveedor */}
              {resultado.grupos.map((grupo) => (
                <SeccionProveedor
                  key={grupo.proveedor.id}
                  grupo={grupo}
                  seleccionados={seleccionados}
                  cantidades={cantidades}
                  onToggle={toggleSeleccionado}
                  onCantidad={setCantidad}
                  nombreTienda={nombreTienda}
                />
              ))}

              {/* Sin proveedor */}
              {resultado.sinProveedor.length > 0 && (
                <div className="bg-white rounded-xl border border-borde overflow-hidden">
                  <div className="px-4 py-3 border-b border-borde/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-suave" />
                      <span className="text-sm font-bold text-texto">Sin proveedor</span>
                    </div>
                    <span className="text-xs text-suave font-bold">{resultado.sinProveedor.length} items</span>
                  </div>
                  <div className="divide-y divide-borde/30">
                    {resultado.sinProveedor.map((item) => (
                      <FilaProducto
                        key={item.productoId}
                        item={item}
                        seleccionado={seleccionados[item.productoId] ?? true}
                        cantidad={cantidades[item.productoId] ?? item.cantidadSugerida}
                        onToggle={() => toggleSeleccionado(item.productoId)}
                        onCantidad={(v) => setCantidad(item.productoId, v)}
                      />
                    ))}
                  </div>

                  {/* WhatsApp genérico para sin proveedor */}
                  {resultado.sinProveedor.some((i) => seleccionados[i.productoId]) && (
                    <div className="px-4 py-3 border-t border-borde/50">
                      <button
                        type="button"
                        onClick={() => {
                          const selItems = resultado.sinProveedor.filter((i) => seleccionados[i.productoId])
                          const fecha = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
                          const lineas = selItems.map((i) => `• ${i.nombreProducto}: ${cantidades[i.productoId] ?? i.cantidadSugerida} ${i.unidad}`).join('\n')
                          const texto = `📋 *Lista General Sugerida*\n📅 ${fecha}\n\n${lineas}`
                          window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
                        }}
                        className="w-full flex items-center justify-center gap-2 h-10 bg-[#25D366] text-white
                                   rounded-xl text-sm font-bold hover:bg-[#20BA5A] active:scale-95 transition-all shadow-sm"
                      >
                        <MessageCircle size={16} />
                        Compartir Lista
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="h-8" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
