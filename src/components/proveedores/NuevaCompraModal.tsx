import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Search, CheckCircle2, Truck } from 'lucide-react'
import {
  registrarCompra,
  buscarProveedores,
  crearProveedor,
  type ItemCompra,
} from '../../hooks/useProveedores'
import { obtenerProductos } from '../../hooks/useProductos'
import { useSesionActual } from '../../hooks/useCaja'
import { formatCOP } from '../../utils/moneda'
import type { CompraProveedor, Producto, Proveedor } from '../../db/schema'

// ─── Props ────────────────────────────────────────────────────────────────────

interface NuevaCompraModalProps {
  proveedorInicial?: { id: number; nombre: string }
  onClose: () => void
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function NuevaCompraModal({ proveedorInicial, onClose }: NuevaCompraModalProps) {
  const sesion = useSesionActual()

  // ── Estado: proveedor ─────────────────────────────────────────────────────
  const [provSeleccionado, setProvSeleccionado] = useState<
    { id: number; nombre: string } | null
  >(proveedorInicial ?? null)
  const [provQuery, setProvQuery] = useState('')
  const [provSugerencias, setProvSugerencias] = useState<Proveedor[]>([])
  const [_provCreandoNuevo, setProvCreandoNuevo] = useState(false)

  // ── Estado: items ─────────────────────────────────────────────────────────
  const [items, setItems] = useState<ItemCompra[]>([])

  // Form para agregar un ítem
  const [iNombre, setINombre] = useState('')
  const [iProductoId, setIProductoId] = useState<number | undefined>()
  const [iQty, setIQty] = useState('1')
  const [iPrecio, setIPrecio] = useState('')
  const [iSugerencias, setISugerencias] = useState<Producto[]>([])
  const nombreInputRef = useRef<HTMLInputElement>(null)

  // ── Estado: pago ──────────────────────────────────────────────────────────
  const [tipoPago, setTipoPago] = useState<CompraProveedor['tipoPago']>('contado')
  const [montoPagadoStr, setMontoPagadoStr] = useState('')
  const [notas, setNotas] = useState('')

  // ── Estado: envío ─────────────────────────────────────────────────────────
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Efectos: autocompletar proveedor ──────────────────────────────────────
  useEffect(() => {
    if (provSeleccionado) { setProvSugerencias([]); return }
    const t = setTimeout(async () => {
      if (provQuery.trim().length < 1) { setProvSugerencias([]); return }
      const res = await buscarProveedores(provQuery)
      setProvSugerencias(res)
    }, 220)
    return () => clearTimeout(t)
  }, [provQuery, provSeleccionado])

  // ── Efectos: autocompletar producto ───────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(async () => {
      if (iNombre.trim().length < 2) { setISugerencias([]); return }
      const res = await obtenerProductos({ query: iNombre, soloActivos: true })
      setISugerencias(res.slice(0, 6))
    }, 220)
    return () => clearTimeout(t)
  }, [iNombre])

  // ── Handlers: proveedor ───────────────────────────────────────────────────
  const seleccionarProveedor = (pv: Proveedor) => {
    setProvSeleccionado({ id: pv.id!, nombre: pv.nombre })
    setProvQuery('')
    setProvSugerencias([])
  }

  const limpiarProveedor = () => {
    setProvSeleccionado(null)
    setProvQuery('')
    setProvCreandoNuevo(false)
  }

  // ── Handlers: ítem ────────────────────────────────────────────────────────
  const seleccionarProducto = (p: Producto) => {
    setINombre(p.nombre)
    setIProductoId(p.id)
    setIPrecio(p.precioCompra ? String(p.precioCompra) : '')
    setISugerencias([])
  }

  const agregarItem = () => {
    const nombre = iNombre.trim()
    const qty = parseFloat(iQty || '1')
    const precio = parseInt(iPrecio || '0', 10)
    if (!nombre || qty <= 0 || precio <= 0) return

    const nuevoItem: ItemCompra = {
      productoId: iProductoId,
      nombreProducto: nombre,
      cantidad: qty,
      precioUnitario: precio,
      subtotal: Math.round(qty * precio),
    }
    setItems((prev) => [...prev, nuevoItem])
    // Reset form
    setINombre('')
    setIProductoId(undefined)
    setIQty('1')
    setIPrecio('')
    setISugerencias([])
    nombreInputRef.current?.focus()
  }

  const eliminarItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const totalCompra = items.reduce((s, i) => s + i.subtotal, 0)

  const pagadoFinal = (() => {
    if (tipoPago === 'contado') return totalCompra
    if (tipoPago === 'credito') return 0
    return parseInt(montoPagadoStr || '0', 10)
  })()

  const saldoFinal = totalCompra - pagadoFinal

  // ── Handler: guardar ──────────────────────────────────────────────────────
  const handleGuardar = async () => {
    setError(null)
    if (!provSeleccionado && !provQuery.trim()) {
      setError('Selecciona o ingresa el nombre del proveedor.')
      return
    }
    if (items.length === 0) {
      setError('Agrega al menos un producto a la compra.')
      return
    }
    if (tipoPago === 'mixto' && pagadoFinal <= 0) {
      setError('Ingresa el monto a pagar ahora.')
      return
    }
    if (tipoPago === 'mixto' && pagadoFinal > totalCompra) {
      setError('El monto pagado no puede superar el total.')
      return
    }

    setGuardando(true)
    try {
      let provId = provSeleccionado?.id

      // Crear proveedor nuevo si no estaba seleccionado
      if (!provId) {
        const nombre = provQuery.trim() || provSeleccionado?.nombre
        if (!nombre) throw new Error('Nombre de proveedor requerido')
        provId = await crearProveedor(nombre)
      }

      await registrarCompra(
        provId,
        items,
        tipoPago,
        pagadoFinal,
        notas.trim() || undefined,
        sesion?.id,
      )

      setExito(true)
      setTimeout(onClose, 1200)
    } catch (err) {
      console.error('[NuevaCompraModal]', err)
      setError('Error al guardar la compra. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  // ── Vista: éxito ──────────────────────────────────────────────────────────
  if (exito) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="flex flex-col items-center gap-3 bg-white rounded-2xl p-8 shadow-xl">
          <CheckCircle2 size={48} className="text-exito" />
          <p className="font-display font-bold text-lg text-texto">¡Compra registrada!</p>
          {saldoFinal > 0 && (
            <p className="text-sm text-suave">Saldo pendiente: {formatCOP(saldoFinal)}</p>
          )}
        </div>
      </div>
    )
  }

  // ── Vista: modal ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-fondo">

      {/* Header */}
      <div className="bg-white border-b border-borde px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-suave
                     hover:text-texto hover:bg-fondo transition-colors"
        >
          <X size={20} />
        </button>
        <h2 className="font-display font-bold text-texto flex-1">Nueva compra</h2>
        {totalCompra > 0 && (
          <span className="moneda font-bold text-primario">{formatCOP(totalCompra)}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 flex flex-col gap-5">

          {/* ── Sección: Proveedor ───────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-borde overflow-hidden">
            <div className="px-4 py-2.5 border-b border-borde/50 flex items-center gap-2">
              <Truck size={15} className="text-primario" />
              <span className="text-sm font-semibold text-texto">Proveedor</span>
            </div>
            <div className="p-3">
              {provSeleccionado ? (
                /* Proveedor seleccionado */
                <div className="flex items-center gap-2 px-3 py-2.5 bg-primario/5 border border-primario/20 rounded-xl">
                  <Truck size={16} className="text-primario shrink-0" />
                  <span className="font-semibold text-texto flex-1 text-sm">
                    {provSeleccionado.nombre}
                  </span>
                  {!proveedorInicial && (
                    <button
                      type="button"
                      onClick={limpiarProveedor}
                      className="text-suave hover:text-peligro transition-colors"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              ) : (
                /* Búsqueda / creación de proveedor */
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
                  <input
                    type="text"
                    value={provQuery}
                    onChange={(e) => { setProvQuery(e.target.value); setProvCreandoNuevo(false) }}
                    placeholder="Buscar o escribir nombre del proveedor…"
                    className="w-full h-10 pl-9 pr-3 border border-borde rounded-xl text-sm text-texto
                               focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario/50"
                  />
                  {/* Sugerencias */}
                  {provSugerencias.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-borde rounded-xl shadow-lg overflow-hidden">
                      {provSugerencias.map((pv) => (
                        <button
                          key={pv.id}
                          type="button"
                          onClick={() => seleccionarProveedor(pv)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-fondo transition-colors text-left"
                        >
                          <Truck size={14} className="text-suave shrink-0" />
                          <span className="text-sm text-texto flex-1 truncate">{pv.nombre}</span>
                          {pv.saldoPendiente > 0 && (
                            <span className="text-xs text-peligro font-medium shrink-0">
                              Debe {formatCOP(pv.saldoPendiente)}
                            </span>
                          )}
                        </button>
                      ))}
                      {provQuery.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setProvSeleccionado(null)
                            setProvCreandoNuevo(true)
                            setProvSugerencias([])
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-primario/5 transition-colors text-left border-t border-borde/50"
                        >
                          <Plus size={14} className="text-primario shrink-0" />
                          <span className="text-sm text-primario font-medium">
                            Crear "{provQuery.trim()}"
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                  {/* Opción crear nuevo visible si no hay sugerencias */}
                  {provQuery.trim().length >= 1 && provSugerencias.length === 0 && (
                    <p className="text-xs text-suave mt-1.5 px-1">
                      <span className="text-primario font-medium">Enter</span> para usar este nombre como proveedor nuevo
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── Sección: Productos ───────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-borde overflow-hidden">
            <div className="px-4 py-2.5 border-b border-borde/50 flex items-center gap-2">
              <span className="text-sm font-semibold text-texto flex-1">
                Productos ({items.length})
              </span>
              {items.length > 0 && (
                <span className="moneda text-xs text-suave">
                  Total {formatCOP(totalCompra)}
                </span>
              )}
            </div>

            {/* Lista de ítems agregados */}
            {items.length > 0 && (
              <div className="divide-y divide-borde/30">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-texto truncate">
                        {item.nombreProducto}
                      </p>
                      <p className="text-xs text-suave">
                        {item.cantidad % 1 === 0 ? item.cantidad : item.cantidad.toFixed(2)} ×{' '}
                        {formatCOP(item.precioUnitario)}
                      </p>
                    </div>
                    <span className="moneda font-bold text-sm text-texto shrink-0">
                      {formatCOP(item.subtotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => eliminarItem(idx)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg
                                 text-suave hover:text-peligro hover:bg-peligro/5 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulario agregar ítem */}
            <div className="p-3 border-t border-borde/30 bg-fondo/50 flex flex-col gap-2">
              <p className="text-xs font-medium text-suave">Agregar producto</p>

              {/* Nombre producto con autocompletar */}
              <div className="relative">
                <input
                  ref={nombreInputRef}
                  type="text"
                  value={iNombre}
                  onChange={(e) => { setINombre(e.target.value); setIProductoId(undefined) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') agregarItem() }}
                  placeholder="Nombre del producto…"
                  className="w-full h-10 px-3 border border-borde rounded-xl text-sm text-texto
                             focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario/50"
                />
                {iSugerencias.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-borde rounded-xl shadow-lg overflow-hidden">
                    {iSugerencias.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => seleccionarProducto(p)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-fondo transition-colors text-left"
                      >
                        <span className="text-sm text-texto flex-1 truncate">{p.nombre}</span>
                        {p.precioCompra && (
                          <span className="text-xs text-suave shrink-0">
                            Costo {formatCOP(p.precioCompra)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Cantidad y precio */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-suave mb-1 block">Cantidad</label>
                  <input
                    type="number"
                    value={iQty}
                    onChange={(e) => setIQty(e.target.value)}
                    min={0.01}
                    step={0.01}
                    className="w-full h-10 px-3 border border-borde rounded-xl text-sm moneda text-texto
                               focus:outline-none focus:ring-2 focus:ring-primario/30"
                  />
                </div>
                <div>
                  <label className="text-xs text-suave mb-1 block">Precio costo ($)</label>
                  <input
                    type="number"
                    value={iPrecio}
                    onChange={(e) => setIPrecio(e.target.value)}
                    min={1}
                    placeholder="0"
                    className="w-full h-10 px-3 border border-borde rounded-xl text-sm moneda text-texto
                               focus:outline-none focus:ring-2 focus:ring-primario/30"
                  />
                </div>
              </div>

              {/* Preview subtotal + botón agregar */}
              <button
                type="button"
                onClick={agregarItem}
                disabled={!iNombre.trim() || !iPrecio || parseInt(iPrecio, 10) <= 0}
                className="h-10 bg-primario/10 text-primario border border-primario/30 rounded-xl
                           text-sm font-semibold flex items-center justify-center gap-1.5
                           hover:bg-primario/20 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={15} />
                Agregar
                {iNombre && iPrecio && parseInt(iPrecio, 10) > 0 && (
                  <span className="moneda ml-1 opacity-70">
                    {formatCOP(Math.round(parseFloat(iQty || '1') * parseInt(iPrecio, 10)))}
                  </span>
                )}
              </button>
            </div>
          </section>

          {/* ── Sección: Tipo de pago ─────────────────────────────────────── */}
          {items.length > 0 && (
            <section className="bg-white rounded-xl border border-borde overflow-hidden">
              <div className="px-4 py-2.5 border-b border-borde/50">
                <span className="text-sm font-semibold text-texto">Forma de pago</span>
              </div>
              <div className="p-3 flex flex-col gap-3">

                {/* Selector tipo pago */}
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'contado', label: 'Contado', emoji: '💵', desc: 'Pago total ahora' },
                      { value: 'credito', label: 'Crédito', emoji: '📅', desc: 'Pagar después' },
                      { value: 'mixto', label: 'Mixto', emoji: '💰', desc: 'Pago parcial' },
                    ] as { value: CompraProveedor['tipoPago']; label: string; emoji: string; desc: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setTipoPago(opt.value); setMontoPagadoStr('') }}
                      className={[
                        'flex flex-col items-center gap-0.5 py-2.5 rounded-xl border text-xs font-medium transition-all',
                        tipoPago === opt.value
                          ? 'bg-primario/10 text-primario border-primario/40'
                          : 'text-suave border-borde hover:border-gray-300 hover:text-texto',
                      ].join(' ')}
                    >
                      <span className="text-xl">{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>

                {/* Campo monto si es mixto */}
                {tipoPago === 'mixto' && (
                  <div>
                    <label className="text-xs text-suave mb-1 block">
                      ¿Cuánto pagas ahora?
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suave font-medium text-sm">
                        $
                      </span>
                      <input
                        type="number"
                        value={montoPagadoStr}
                        onChange={(e) => setMontoPagadoStr(e.target.value)}
                        placeholder="0"
                        min={1}
                        max={totalCompra}
                        className="w-full h-11 pl-7 pr-3 border border-borde rounded-xl text-sm moneda text-texto
                                   focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario/50"
                      />
                    </div>
                  </div>
                )}

                {/* Resumen de pago */}
                <div className={[
                  'rounded-xl p-3 flex flex-col gap-1',
                  saldoFinal > 0 ? 'bg-red-50 border border-red-100' : 'bg-exito/5 border border-exito/20',
                ].join(' ')}>
                  <div className="flex justify-between text-sm">
                    <span className="text-suave">Total compra</span>
                    <span className="moneda font-bold text-texto">{formatCOP(totalCompra)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-suave">Pagas ahora</span>
                    <span className="moneda font-medium text-exito">{formatCOP(pagadoFinal)}</span>
                  </div>
                  {saldoFinal > 0 && (
                    <div className="flex justify-between text-sm border-t border-red-100 pt-1 mt-0.5">
                      <span className="font-semibold text-peligro">Queda pendiente</span>
                      <span className="moneda font-bold text-peligro">{formatCOP(saldoFinal)}</span>
                    </div>
                  )}
                </div>

                {/* Nota sesión de caja */}
                {tipoPago !== 'credito' && !sesion && (
                  <p className="text-xs text-advertencia bg-advertencia/5 border border-advertencia/20 rounded-lg px-3 py-2">
                    ⚠️ No hay caja abierta — el pago no se descontará del efectivo del día.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* ── Sección: Notas ───────────────────────────────────────────── */}
          {items.length > 0 && (
            <section>
              <input
                type="text"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Notas opcionales (Factura #1234, Remisión…)"
                className="w-full h-11 px-3 border border-borde rounded-xl text-sm text-texto
                           focus:outline-none focus:ring-2 focus:ring-primario/30 bg-white"
              />
            </section>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-peligro bg-peligro/5 border border-peligro/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="h-4" />
        </div>
      </div>

      {/* Botón registrar */}
      <div className="bg-white border-t border-borde p-4 shrink-0">
        <button
          type="button"
          onClick={handleGuardar}
          disabled={
            guardando ||
            items.length === 0 ||
            (!provSeleccionado && !provQuery.trim())
          }
          className="w-full h-14 bg-primario text-white rounded-xl font-display font-bold text-base
                     hover:bg-primario-hover active:scale-[0.98] transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {guardando ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Guardando…
            </>
          ) : (
            <>
              <CheckCircle2 size={20} />
              {items.length > 0
                ? `Registrar compra · ${formatCOP(totalCompra)}`
                : 'Registrar compra'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
