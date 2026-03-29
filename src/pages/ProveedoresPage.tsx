import { useState } from 'react'
import { Search, Plus, Truck, X } from 'lucide-react'
import { useProveedores, crearProveedor } from '../hooks/useProveedores'
import { CuentaProveedor } from '../components/proveedores/CuentaProveedor'
import { NuevaCompraModal } from '../components/proveedores/NuevaCompraModal'
import { formatCOP } from '../utils/moneda'
import type { Proveedor } from '../db/schema'

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ProveedoresPage() {
  const [query, setQuery] = useState('')

  // Navegación: id del proveedor seleccionado para ver su cuenta
  const [proveedorSeleccionadoId, setProveedorSeleccionadoId] = useState<number | null>(null)

  // Modal de nueva compra
  const [mostrarNuevaCompra, setMostrarNuevaCompra] = useState(false)
  const [proveedorParaCompra, setProveedorParaCompra] = useState<
    { id: number; nombre: string } | undefined
  >()

  // Modal de nuevo proveedor
  const [mostrarNuevoProveedor, setMostrarNuevoProveedor] = useState(false)

  const proveedores = useProveedores(query)

  const abrirNuevaCompra = (pv: { id: number; nombre: string }) => {
    setProveedorParaCompra(pv)
    setMostrarNuevaCompra(true)
  }

  const cerrarNuevaCompra = () => {
    setMostrarNuevaCompra(false)
    setProveedorParaCompra(undefined)
  }

  // ── Vista: detalle de proveedor ────────────────────────────────────────────

  if (proveedorSeleccionadoId !== null) {
    return (
      <>
        <CuentaProveedor
          proveedorId={proveedorSeleccionadoId}
          onBack={() => setProveedorSeleccionadoId(null)}
          onNuevaCompra={abrirNuevaCompra}
        />
        {mostrarNuevaCompra && (
          <NuevaCompraModal
            proveedorInicial={proveedorParaCompra}
            onClose={cerrarNuevaCompra}
          />
        )}
      </>
    )
  }

  // ── Vista: lista de proveedores ────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-fondo overflow-hidden">

      {/* Barra de búsqueda + botón nuevo */}
      <div className="bg-white border-b border-borde px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar proveedor…"
            className="w-full h-10 pl-9 pr-3 border border-borde rounded-xl text-sm text-texto
                       focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario/50"
          />
        </div>
        <button
          type="button"
          onClick={() => setMostrarNuevoProveedor(true)}
          className="w-10 h-10 bg-primario text-white rounded-xl flex items-center justify-center
                     hover:bg-primario-hover transition-colors shrink-0"
          title="Nuevo proveedor"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Listado */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 flex flex-col gap-3">

          {/* Cargando */}
          {!proveedores && (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-primario/30 border-t-primario rounded-full animate-spin" />
            </div>
          )}

          {/* Sin resultados */}
          {proveedores?.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-3 text-suave/50">
              <span className="text-5xl">🚚</span>
              <p className="text-sm font-medium text-center">
                {query ? 'Sin resultados para tu búsqueda' : 'No hay proveedores registrados'}
              </p>
              {!query && (
                <button
                  type="button"
                  onClick={() => setMostrarNuevoProveedor(true)}
                  className="text-primario text-sm font-semibold hover:underline"
                >
                  Agregar el primero
                </button>
              )}
            </div>
          )}

          {/* Tarjetas de proveedor */}
          {proveedores?.map((pv) => (
            <TarjetaProveedor
              key={pv.id}
              proveedor={pv}
              onVerCuenta={() => setProveedorSeleccionadoId(pv.id!)}
              onNuevaCompra={() => abrirNuevaCompra({ id: pv.id!, nombre: pv.nombre })}
            />
          ))}

          <div className="h-4" />
        </div>
      </div>

      {/* Modal nueva compra (desde lista) */}
      {mostrarNuevaCompra && (
        <NuevaCompraModal
          proveedorInicial={proveedorParaCompra}
          onClose={cerrarNuevaCompra}
        />
      )}

      {/* Modal nuevo proveedor */}
      {mostrarNuevoProveedor && (
        <ModalNuevoProveedor onClose={() => setMostrarNuevoProveedor(false)} />
      )}
    </div>
  )
}

// ─── TarjetaProveedor ─────────────────────────────────────────────────────────

function TarjetaProveedor({
  proveedor,
  onVerCuenta,
  onNuevaCompra,
}: {
  proveedor: Proveedor
  onVerCuenta: () => void
  onNuevaCompra: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-borde overflow-hidden">
      {/* Info del proveedor */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-fondo/50 transition-colors"
        onClick={onVerCuenta}
      >
        <div className="w-10 h-10 bg-primario/10 rounded-full flex items-center justify-center shrink-0">
          <Truck size={18} className="text-primario" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-texto text-sm truncate">{proveedor.nombre}</p>
            {proveedor.saldoPendiente > 0 && (
              <span className="px-2 py-0.5 bg-peligro/10 text-peligro text-xs font-bold rounded-full shrink-0">
                Debe {formatCOP(proveedor.saldoPendiente)}
              </span>
            )}
            {proveedor.saldoPendiente === 0 && (
              <span className="px-2 py-0.5 bg-exito/10 text-exito text-xs font-medium rounded-full shrink-0">
                Al día ✓
              </span>
            )}
          </div>
          {(proveedor.contacto || proveedor.diasVisita || proveedor.telefono) && (
            <p className="text-xs text-suave mt-0.5">
              {[proveedor.contacto, proveedor.diasVisita, proveedor.telefono]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="border-t border-borde/50 grid grid-cols-2 divide-x divide-borde/50">
        <button
          type="button"
          onClick={onVerCuenta}
          className="h-10 text-xs font-semibold text-suave hover:text-texto hover:bg-fondo transition-colors"
        >
          Ver cuenta
        </button>
        <button
          type="button"
          onClick={onNuevaCompra}
          className="h-10 text-xs font-semibold text-primario hover:bg-primario/5
                     transition-colors flex items-center justify-center gap-1"
        >
          <Plus size={13} />
          Nueva compra
        </button>
      </div>
    </div>
  )
}

// ─── ModalNuevoProveedor ──────────────────────────────────────────────────────

function ModalNuevoProveedor({ onClose }: { onClose: () => void }) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [contacto, setContacto] = useState('')
  const [diasVisita, setDiasVisita] = useState('')
  const [guardando, setGuardando] = useState(false)

  const handleGuardar = async () => {
    if (!nombre.trim() || guardando) return
    setGuardando(true)
    try {
      await crearProveedor(nombre.trim(), {
        telefono: telefono.trim() || undefined,
        contacto: contacto.trim() || undefined,
        diasVisita: diasVisita.trim() || undefined,
      })
      onClose()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-borde">
          <Truck size={20} className="text-primario" />
          <h2 className="font-display font-bold text-texto flex-1">Nuevo proveedor</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-suave hover:text-texto hover:bg-fondo transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <div className="p-5 flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-suave mb-1 block">Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGuardar() }}
              placeholder="Ej: Lácteos El Campo"
              autoFocus
              className="w-full h-11 px-3 border border-borde rounded-xl text-sm text-texto
                         focus:outline-none focus:ring-2 focus:ring-primario/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-suave mb-1 block">Teléfono</label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="3001234567"
              className="w-full h-11 px-3 border border-borde rounded-xl text-sm text-texto
                         focus:outline-none focus:ring-2 focus:ring-primario/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-suave mb-1 block">Contacto</label>
              <input
                type="text"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                placeholder="Ej: Juan"
                className="w-full h-11 px-3 border border-borde rounded-xl text-sm text-texto
                           focus:outline-none focus:ring-2 focus:ring-primario/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-suave mb-1 block">Días visita</label>
              <input
                type="text"
                value={diasVisita}
                onChange={(e) => setDiasVisita(e.target.value)}
                placeholder="Ej: Lunes"
                className="w-full h-11 px-3 border border-borde rounded-xl text-sm text-texto
                           focus:outline-none focus:ring-2 focus:ring-primario/30"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={!nombre.trim() || guardando}
            className="mt-1 h-12 bg-primario text-white rounded-xl font-display font-bold
                       hover:bg-primario-hover active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {guardando ? 'Guardando…' : 'Crear proveedor'}
          </button>
        </div>
      </div>
    </div>
  )
}
