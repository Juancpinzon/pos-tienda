import { useState } from 'react'
import { Search, Users, TrendingUp } from 'lucide-react'
import { useClientes } from '../hooks/useFiados'
import { CuentaCliente } from '../components/fiado/CuentaCliente'
import { formatCOP } from '../utils/moneda'

export default function FiadosPage() {
  const [query, setQuery] = useState('')
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<number | null>(null)

  const clientes = useClientes(query)

  // Total general de cartera
  const totalCartera = (clientes ?? []).reduce((sum, c) => sum + Math.max(0, c.totalDeuda), 0)
  const clientesConDeuda = (clientes ?? []).filter((c) => c.totalDeuda > 0).length

  return (
    <div className="h-full flex bg-fondo overflow-hidden">

      {/* ── Panel izquierdo: lista de clientes ───────────────────────── */}
      <div className={[
        'flex flex-col border-r border-borde bg-white',
        // En móvil: ocupa todo si no hay seleccionado, se oculta si hay uno
        clienteSeleccionadoId
          ? 'hidden sm:flex sm:w-72'
          : 'flex-1 sm:flex sm:w-72',
      ].join(' ')}>

        {/* Resumen de cartera */}
        <div className="p-4 border-b border-borde bg-fiado/10">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-fiado" />
            <span className="text-xs font-semibold text-fiado uppercase tracking-wide">
              Cartera total
            </span>
          </div>
          <p className="moneda font-bold text-precio text-peligro leading-none">
            {formatCOP(totalCartera)}
          </p>
          <p className="text-suave text-xs mt-1">
            {clientesConDeuda} cliente{clientesConDeuda !== 1 ? 's' : ''} con deuda
          </p>
        </div>

        {/* Buscador */}
        <div className="p-3 border-b border-borde">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente…"
              className="w-full h-10 pl-9 pr-3 bg-fondo border border-borde rounded-xl
                         text-sm focus:outline-none focus:ring-2 focus:ring-fiado/40"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {clientes === undefined && (
            <div className="flex flex-col gap-1 p-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {clientes?.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-suave/60">
              <Users size={40} strokeWidth={1} />
              <p className="text-sm text-center">
                {query ? `Sin resultados para "${query}"` : 'No hay clientes registrados aún'}
              </p>
            </div>
          )}

          {clientes && clientes.length > 0 && (
            <div className="divide-y divide-borde/50">
              {clientes.map((cliente) => {
                const deudaPositiva = cliente.totalDeuda > 0
                const activo = clienteSeleccionadoId === cliente.id
                return (
                  <button
                    key={cliente.id}
                    type="button"
                    onClick={() => setClienteSeleccionadoId(cliente.id ?? null)}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                      activo ? 'bg-fiado/10 border-r-2 border-fiado' : 'hover:bg-fondo',
                    ].join(' ')}
                  >
                    {/* Avatar inicial */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm
                                    ${deudaPositiva ? 'bg-red-100 text-peligro' : 'bg-gray-100 text-suave'}`}>
                      {cliente.nombre.charAt(0).toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-texto truncate">
                        {cliente.nombre}
                      </p>
                      <p className={`text-xs moneda font-medium ${
                        deudaPositiva ? 'text-peligro' : cliente.totalDeuda < 0 ? 'text-exito' : 'text-suave'
                      }`}>
                        {deudaPositiva
                          ? formatCOP(cliente.totalDeuda)
                          : cliente.totalDeuda < 0
                            ? `Crédito ${formatCOP(Math.abs(cliente.totalDeuda))}`
                            : 'Sin deuda'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel derecho: cuenta del cliente ───────────────────────── */}
      <div className={[
        'flex-1 overflow-hidden',
        clienteSeleccionadoId ? 'flex flex-col' : 'hidden sm:flex',
      ].join(' ')}>
        {clienteSeleccionadoId ? (
          <CuentaCliente
            clienteId={clienteSeleccionadoId}
            onVolver={() => setClienteSeleccionadoId(null)}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-suave/50">
            <div className="text-5xl">📒</div>
            <p className="text-base font-display font-semibold">Selecciona un cliente</p>
            <p className="text-sm text-center px-8">
              Elige un cliente de la lista para ver su cuenta y registrar pagos
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
