import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, Truck, MessageCircle, Package,
  Edit3, Check, X, ChevronRight, RefreshCw, ShoppingCart,
} from 'lucide-react'
import { db } from '../db/database'
import { obtenerConfig } from '../hooks/useConfig'
import { buscarProveedores } from '../hooks/useProveedores'
import { formatCOP } from '../utils/moneda'
import type { Producto, Proveedor } from '../db/schema'

// ─── Tipos internos ───────────────────────────────────────────────────────────

type Urgencia = 'agotado' | 'critico' | 'bajo'

interface SugerenciaProducto {
  producto: Producto & { id: number }
  promedioDaily: number    // unidades promedio vendidas por día (últimos 7 días)
  diasRestantes: number    // stockActual / promedioDaily (Infinity si sin ventas)
  cantidadSugerida: number // para cubrir 7 días
  urgencia: Urgencia
}

interface GrupoProveedor {
  proveedor: Proveedor & { id: number }
  items: SugerenciaProducto[]
}

interface ResultadoPedido {
  grupos: GrupoProveedor[]
  sinProveedor: SugerenciaProducto[]
  totalAgotados: number
  totalCriticos: number      // < 3 días
  inversionEstimada: number  // suma de precioCompra * cantidadSugerida
}

// ─── Algoritmo central ────────────────────────────────────────────────────────

async function calcularPedido(): Promise<ResultadoPedido> {
  const hace7Dias = new Date()
  hace7Dias.setDate(hace7Dias.getDate() - 7)
  hace7Dias.setHours(0, 0, 0, 0)

  // 1. Ventas completadas de los últimos 7 días
  const ventasIds = (await db.ventas
    .where('creadaEn').aboveOrEqual(hace7Dias)
    .filter((v) => v.estado === 'completada')
    .primaryKeys()) as number[]

  // 2. Detalles de esas ventas → cantidad vendida por producto
  const detallesVenta = ventasIds.length > 0
    ? await db.detallesVenta
        .where('ventaId').anyOf(ventasIds)
        .filter((d) => d.productoId !== undefined && !d.esProductoFantasma)
        .toArray()
    : []

  const vendidoPorProducto: Record<number, number> = {}
  for (const d of detallesVenta) {
    vendidoPorProducto[d.productoId!] = (vendidoPorProducto[d.productoId!] ?? 0) + d.cantidad
  }

  // 3. Todos los productos con stock controlado
  const productos = await db.productos
    .filter((p) =>
      p.activo &&
      !p.esFantasma &&
      p.stockActual !== undefined &&
      p.stockActual !== null
    )
    .toArray() as (Producto & { id: number })[]

  // 4. Construir sugerencias (solo para productos que necesitan pedido)
  const sugerencias: SugerenciaProducto[] = []

  for (const p of productos) {
    const totalVendido7Dias = vendidoPorProducto[p.id] ?? 0
    const promedioDaily = totalVendido7Dias / 7
    const stockActual = p.stockActual ?? 0

    const diasRestantes = promedioDaily > 0
      ? stockActual / promedioDaily
      : Infinity

    const bajoPorMinimo = p.stockMinimo !== undefined && p.stockMinimo !== null
      ? stockActual <= p.stockMinimo
      : false

    const necesita = diasRestantes < 7 || bajoPorMinimo

    if (!necesita) continue

    // Cantidad para 7 días de cobertura (al menos el stock mínimo doble si no hay ventas)
    let cantidadSugerida: number
    if (promedioDaily > 0) {
      cantidadSugerida = Math.max(0, Math.ceil(promedioDaily * 7) - stockActual)
    } else {
      // Sin ventas recientes: sugerir llenar hasta 2× el stock mínimo
      cantidadSugerida = Math.max(1, ((p.stockMinimo ?? 5) * 2) - stockActual)
    }

    const urgencia: Urgencia =
      stockActual === 0 ? 'agotado'
      : diasRestantes < 3 ? 'critico'
      : 'bajo'

    sugerencias.push({ producto: p, promedioDaily, diasRestantes, cantidadSugerida, urgencia })
  }

  // Ordenar: agotados primero, luego críticos, luego bajos
  const ordenUrgencia: Record<Urgencia, number> = { agotado: 0, critico: 1, bajo: 2 }
  sugerencias.sort((a, b) => ordenUrgencia[a.urgencia] - ordenUrgencia[b.urgencia])

  // 5. Asociar producto → proveedor (proveedor más reciente del que se compró)
  const todasCompras = await db.comprasProveedor.orderBy('creadaEn').reverse().toArray()
  const comprasMap = new Map(todasCompras.map((c) => [c.id!, c]))

  const todosDetallesCompra = await db.detallesCompra
    .filter((d) => d.productoId !== undefined)
    .toArray()

  // Mapa productoId → {proveedorId, fecha} del compra más reciente
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

  // 6. Agrupar sugerencias por proveedor
  const todosProveedores = await db.proveedores.filter((p) => p.activo).toArray() as (Proveedor & { id: number })[]
  const proveedoresMap = new Map(todosProveedores.map((p) => [p.id, p]))

  const gruposMap: Record<number, GrupoProveedor> = {}
  const sinProveedor: SugerenciaProducto[] = []

  for (const sug of sugerencias) {
    const rel = productoProveedor[sug.producto.id]
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
      // Priorizar grupos con más urgencias agotado/critico
      const urgA = a.items.filter((i) => i.urgencia !== 'bajo').length
      const urgB = b.items.filter((i) => i.urgencia !== 'bajo').length
      return urgB - urgA
    })

  // 7. Totales
  const totalAgotados = sugerencias.filter((s) => s.urgencia === 'agotado').length
  const totalCriticos = sugerencias.filter((s) => s.urgencia === 'critico').length

  let inversionEstimada = 0
  for (const s of sugerencias) {
    if (s.producto.precioCompra && s.producto.precioCompra > 0) {
      inversionEstimada += s.producto.precioCompra * s.cantidadSugerida
    }
  }

  return { grupos, sinProveedor, totalAgotados, totalCriticos, inversionEstimada }
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

function BadgeUrgencia({ urgencia }: { urgencia: Urgencia }) {
  if (urgencia === 'agotado') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-peligro">🔴 Agotado</span>
  )
  if (urgencia === 'critico') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-advertencia">⚠️ &lt;3 días</span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-600">🟡 &lt;7 días</span>
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
  item: SugerenciaProducto
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

  const bg =
    item.urgencia === 'agotado' ? 'bg-peligro/5 border-l-4 border-l-peligro'
    : item.urgencia === 'critico' ? 'bg-advertencia/5 border-l-4 border-l-advertencia'
    : 'bg-white'

  return (
    <div className={`flex items-start gap-3 px-3 py-3 ${bg}`}>
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
        <div className="flex items-center gap-2 flex-wrap">
          <BadgeUrgencia urgencia={item.urgencia} />
          <span className="text-sm font-medium text-texto truncate">
            {item.producto.nombre}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-xs text-suave">
            Stock: <span className={`font-semibold ${item.producto.stockActual === 0 ? 'text-peligro' : 'text-texto'}`}>
              {item.producto.stockActual ?? 0} {item.producto.unidad}
            </span>
          </span>
          {item.promedioDaily > 0 && (
            <span className="text-xs text-suave">
              Vende ~{item.promedioDaily < 1
                ? `${Math.round(item.promedioDaily * 7)}/sem`
                : `${item.promedioDaily.toFixed(1)}/día`
              }
            </span>
          )}
          {item.producto.precioCompra && item.producto.precioCompra > 0 && (
            <span className="text-xs text-suave">
              Costo: {formatCOP(item.producto.precioCompra)}
            </span>
          )}
        </div>
      </div>

      {/* Cantidad editable */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        {editando ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmarEdicion(); if (e.key === 'Escape') { setEditando(false); setInputVal(String(cantidad)) } }}
              autoFocus
              className="w-16 h-7 text-center border border-primario rounded-lg text-sm moneda
                         focus:outline-none focus:ring-1 focus:ring-primario"
            />
            <button type="button" onClick={confirmarEdicion} className="text-exito"><Check size={14} /></button>
            <button type="button" onClick={() => { setEditando(false); setInputVal(String(cantidad)) }} className="text-suave"><X size={14} /></button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setEditando(true); setInputVal(String(cantidad)) }}
            className="flex items-center gap-1 text-sm font-bold text-primario hover:bg-primario/10 px-2 py-1 rounded-lg transition-colors"
          >
            <span className="moneda">{cantidad} {item.producto.unidad}</span>
            <Edit3 size={11} />
          </button>
        )}
        {item.producto.precioCompra && item.producto.precioCompra > 0 && (
          <span className="text-[10px] text-suave moneda">
            ≈ {formatCOP(item.producto.precioCompra * cantidad)}
          </span>
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

  const itemsSeleccionados = items.filter((i) => seleccionados[i.producto.id])

  const handleWhatsApp = () => {
    if (itemsSeleccionados.length === 0) return

    const fecha = new Date().toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    })

    let totalAprox = 0
    const lineasProductos = itemsSeleccionados.map((i) => {
      const cant = cantidades[i.producto.id] ?? i.cantidadSugerida
      const subtotal = (i.producto.precioCompra ?? 0) * cant
      totalAprox += subtotal
      return `• ${i.producto.nombre}: ${cant} ${i.producto.unidad}`
    }).join('\n')

    const texto = [
      `📋 *Pedido ${nombreTienda}*`,
      `📅 ${fecha}`,
      ``,
      lineasProductos,
      ``,
      totalAprox > 0 ? `💰 Total aprox: ${formatCOP(totalAprox)}` : '',
      ``,
      `_Enviado desde POS Tienda_`,
    ].filter(Boolean).join('\n')

    const tel = proveedor.telefono?.replace(/\D/g, '')
    const url = tel
      ? `https://wa.me/57${tel}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`

    window.open(url, '_blank')
  }

  // Total inversión del grupo (solo seleccionados)
  const inversionGrupo = itemsSeleccionados.reduce((s, i) => {
    const cant = cantidades[i.producto.id] ?? i.cantidadSugerida
    return s + ((i.producto.precioCompra ?? 0) * cant)
  }, 0)

  const agotadosGrupo = items.filter((i) => i.urgencia === 'agotado').length

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
              {proveedor.contacto && (
                <span className="text-[10px] text-suave">👤 {proveedor.contacto}</span>
              )}
              {agotadosGrupo > 0 && (
                <span className="text-[10px] font-bold text-peligro">
                  🔴 {agotadosGrupo} agotado{agotadosGrupo !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {inversionGrupo > 0 && (
            <span className="text-xs text-suave moneda">≈ {formatCOP(inversionGrupo)}</span>
          )}
          <button
            type="button"
            onClick={handleWhatsApp}
            disabled={itemsSeleccionados.length === 0}
            className="flex items-center gap-1.5 h-7 px-3 bg-[#25D366] text-white rounded-lg
                       text-xs font-semibold hover:bg-[#20BA5A] active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MessageCircle size={12} />
            Pedir
          </button>
        </div>
      </div>

      {/* Lista de productos */}
      <div className="divide-y divide-borde/30">
        {items.map((item) => (
          <FilaProducto
            key={item.producto.id}
            item={item}
            seleccionado={seleccionados[item.producto.id] ?? true}
            cantidad={cantidades[item.producto.id] ?? item.cantidadSugerida}
            onToggle={() => onToggle(item.producto.id)}
            onCantidad={(v) => onCantidad(item.producto.id, v)}
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
  const [resultado, setResultado] = useState<ResultadoPedido | undefined>(undefined)
  const [cargando, setCargando] = useState(true)
  const [seleccionados, setSeleccionados] = useState<Record<number, boolean>>({})
  const [cantidades, setCantidades] = useState<Record<number, number>>({})
  const [nombreTienda, setNombreTienda] = useState('Mi Tienda')
  const [productoAsignar, setProductoAsignar] = useState<(Producto & { id: number }) | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [res, config] = await Promise.all([calcularPedido(), obtenerConfig()])
      setResultado(res)
      setNombreTienda(config.nombreTienda)

      // Inicializar seleccionados y cantidades (todos seleccionados por defecto)
      const sel: Record<number, boolean> = {}
      const cant: Record<number, number> = {}
      const todasSugs = [
        ...res.grupos.flatMap((g) => g.items),
        ...res.sinProveedor,
      ]
      for (const s of todasSugs) {
        sel[s.producto.id] = true
        cant[s.producto.id] = s.cantidadSugerida
      }
      setSeleccionados(sel)
      setCantidades(cant)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const toggleSeleccionado = (id: number) => {
    setSeleccionados((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const setCantidad = (id: number, v: number) => {
    setCantidades((prev) => ({ ...prev, [id]: v }))
  }

  // ── Resumen ejecutivo ─────────────────────────────────────────────────────

  const totalItems = resultado
    ? resultado.grupos.reduce((s, g) => s + g.items.length, 0) + resultado.sinProveedor.length
    : 0

  const inversionTotal = resultado
    ? [...resultado.grupos.flatMap((g) => g.items), ...resultado.sinProveedor]
        .filter((i) => seleccionados[i.producto.id])
        .reduce((s, i) => {
          const cant = cantidades[i.producto.id] ?? i.cantidadSugerida
          return s + ((i.producto.precioCompra ?? 0) * cant)
        }, 0)
    : 0

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-fondo overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">

          {/* Header con recalcular */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-lg text-texto">Lista de pedido</h2>
              <p className="text-xs text-suave">Basado en ventas de los últimos 7 días</p>
            </div>
            <button
              type="button"
              onClick={cargar}
              disabled={cargando}
              className="flex items-center gap-2 h-9 px-3 border border-borde bg-white rounded-xl
                         text-sm text-suave font-medium hover:text-texto hover:border-gray-300
                         active:scale-95 transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
              Recalcular
            </button>
          </div>

          {cargando ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-primario/30 border-t-primario rounded-full animate-spin" />
            </div>
          ) : !resultado || totalItems === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="text-5xl">✅</div>
              <p className="font-display font-bold text-lg text-texto">¡Todo el stock está bien!</p>
              <p className="text-sm text-suave max-w-xs">
                Ningún producto con stock controlado necesita pedido en este momento.
              </p>
              <button
                type="button"
                onClick={cargar}
                className="flex items-center gap-2 h-9 px-4 border border-borde bg-white rounded-xl text-sm text-suave hover:text-texto transition-colors"
              >
                <RefreshCw size={14} />
                Recalcular
              </button>
            </div>
          ) : (
            <>
              {/* Resumen ejecutivo */}
              <div className="grid grid-cols-3 gap-3">
                <div className={[
                  'rounded-xl border p-3 flex flex-col gap-1',
                  resultado.totalAgotados > 0 ? 'bg-peligro/5 border-peligro/30' : 'bg-white border-borde',
                ].join(' ')}>
                  <p className="text-[10px] font-semibold text-suave uppercase tracking-wide">Agotados</p>
                  <p className={`font-bold text-2xl ${resultado.totalAgotados > 0 ? 'text-peligro' : 'text-texto/30'}`}>
                    {resultado.totalAgotados}
                  </p>
                  <p className="text-[10px] text-suave">productos</p>
                </div>

                <div className={[
                  'rounded-xl border p-3 flex flex-col gap-1',
                  resultado.totalCriticos > 0 ? 'bg-advertencia/5 border-advertencia/30' : 'bg-white border-borde',
                ].join(' ')}>
                  <p className="text-[10px] font-semibold text-suave uppercase tracking-wide">&lt; 3 días</p>
                  <p className={`font-bold text-2xl ${resultado.totalCriticos > 0 ? 'text-advertencia' : 'text-texto/30'}`}>
                    {resultado.totalCriticos}
                  </p>
                  <p className="text-[10px] text-suave">productos</p>
                </div>

                <div className={[
                  'rounded-xl border p-3 flex flex-col gap-1',
                  inversionTotal > 0 ? 'bg-primario/5 border-primario/20' : 'bg-white border-borde',
                ].join(' ')}>
                  <p className="text-[10px] font-semibold text-suave uppercase tracking-wide">Inversión est.</p>
                  <p className={`font-bold text-base leading-tight ${inversionTotal > 0 ? 'text-primario' : 'text-texto/30'}`}>
                    {inversionTotal > 0 ? formatCOP(inversionTotal) : '$—'}
                  </p>
                  <p className="text-[10px] text-suave">seleccionados</p>
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
                  <div className="px-4 py-3 border-b border-borde/50 flex items-center gap-2">
                    <Package size={16} className="text-suave" />
                    <span className="text-sm font-bold text-texto flex-1">Sin proveedor definido</span>
                    <span className="text-xs text-suave">{resultado.sinProveedor.length} producto{resultado.sinProveedor.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="divide-y divide-borde/30">
                    {resultado.sinProveedor.map((item) => (
                      <div key={item.producto.id}>
                        <FilaProducto
                          item={item}
                          seleccionado={seleccionados[item.producto.id] ?? true}
                          cantidad={cantidades[item.producto.id] ?? item.cantidadSugerida}
                          onToggle={() => toggleSeleccionado(item.producto.id)}
                          onCantidad={(v) => setCantidad(item.producto.id, v)}
                        />
                        {/* Botón asignar proveedor */}
                        <div className="px-11 pb-2">
                          <button
                            type="button"
                            onClick={() => setProductoAsignar(item.producto)}
                            className="flex items-center gap-1.5 text-[10px] text-primario font-semibold
                                       hover:underline transition-all"
                          >
                            <ChevronRight size={10} />
                            ¿Cómo asignar proveedor?
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* WhatsApp genérico para sin proveedor */}
                  {resultado.sinProveedor.some((i) => seleccionados[i.producto.id]) && (
                    <div className="px-4 py-3 border-t border-borde/50">
                      <button
                        type="button"
                        onClick={() => {
                          const selItems = resultado.sinProveedor.filter((i) => seleccionados[i.producto.id])
                          const fecha = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
                          const lineas = selItems.map((i) => {
                            const cant = cantidades[i.producto.id] ?? i.cantidadSugerida
                            return `• ${i.producto.nombre}: ${cant} ${i.producto.unidad}`
                          }).join('\n')
                          const texto = `📋 *Pedido ${nombreTienda}*\n📅 ${fecha}\n\n${lineas}\n\n_Enviado desde POS Tienda_`
                          window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
                        }}
                        className="w-full flex items-center justify-center gap-2 h-9 bg-[#25D366] text-white
                                   rounded-xl text-sm font-semibold hover:bg-[#20BA5A] active:scale-95 transition-all"
                      >
                        <MessageCircle size={14} />
                        Enviar lista por WhatsApp
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Nota al pie */}
              <div className="flex items-start gap-2 p-3 bg-fondo border border-borde/50 rounded-xl">
                <AlertTriangle size={14} className="text-suave shrink-0 mt-0.5" />
                <p className="text-xs text-suave leading-relaxed">
                  Las cantidades se basan en el promedio de los últimos 7 días.
                  Edita las cantidades antes de enviar si tienes pedidos especiales.
                  <span className="block mt-1">
                    <ShoppingCart size={10} className="inline mr-1" />
                    Para agregar una compra al sistema ve a <strong>Proveedores</strong>.
                  </span>
                </p>
              </div>

              <div className="h-4" />
            </>
          )}
        </div>
      </div>

      {productoAsignar && (
        <ModalAsignarProveedor
          producto={productoAsignar}
          onClose={() => setProductoAsignar(null)}
          onAsignado={() => setProductoAsignar(null)}
        />
      )}
    </div>
  )
}
