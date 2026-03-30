import { useState } from 'react'
import { Search, Users, TrendingUp } from 'lucide-react'
import { useClientes, calcularDiasMora, getBucketMora, type BucketMora } from '../hooks/useFiados'
import { CuentaCliente } from '../components/fiado/CuentaCliente'
import { formatCOP } from '../utils/moneda'
import type { Cliente } from '../db/schema'

// ─── Badge de mora ────────────────────────────────────────────────────────────

function BadgeMora({ cliente }: { cliente: Cliente }) {
  const bucket = getBucketMora(cliente)
  const dias   = calcularDiasMora(cliente)

  if (cliente.totalDeuda <= 0) return null

  const cfg = {
    al_dia:  { dot: 'bg-exito',      text: 'text-exito',      label: 'Al día'        },
    media:   { dot: 'bg-advertencia', text: 'text-advertencia', label: `${dias}d`      },
    alta:    { dot: 'bg-peligro',     text: 'text-peligro',     label: `${dias}d`      },
  }[bucket]

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─── Filtro de mora ───────────────────────────────────────────────────────────

type FiltroCuenta = 'todos' | 'con_mora' | 'al_dia'

const FILTROS: { value: FiltroCuenta; label: string }[] = [
  { value: 'todos',    label: 'Todos'    },
  { value: 'con_mora', label: 'Con mora' },
  { value: 'al_dia',  label: 'Al día'   },
]

function aplicarFiltroMora(clientes: Cliente[], filtro: FiltroCuenta): Cliente[] {
  if (filtro === 'todos') return clientes
  return clientes.filter((c) => {
    const bucket = getBucketMora(c)
    if (filtro === 'con_mora') return bucket === 'media' || bucket === 'alta'
    if (filtro === 'al_dia')   return bucket === 'al_dia'
    return true
  })
}

function ordenarPorMora(clientes: Cliente[]): Cliente[] {
  return [...clientes].sort((a, b) => {
    // Prioridad: alta > media > al_dia; dentro del mismo bucket, más deuda primero
    const orden: Record<BucketMora, number> = { alta: 0, media: 1, al_dia: 2 }
    const ba = orden[getBucketMora(a)]
    const bb = orden[getBucketMora(b)]
    if (ba !== bb) return ba - bb
    return b.totalDeuda - a.totalDeuda
  })
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function FiadosPage() {
  const [query,    setQuery]    = useState('')
  const [filtro,   setFiltro]   = useState<FiltroCuenta>('todos')
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState<number | null>(null)

  const clientesRaw = useClientes(query)

  // Aplicar filtro + orden
  const clientes = clientesRaw
    ? ordenarPorMora(aplicarFiltroMora(clientesRaw, filtro))
    : clientesRaw

  // Resumen de cartera
  const todosConDeuda = (clientesRaw ?? []).filter((c) => c.totalDeuda > 0)
  const totalCartera  = todosConDeuda.reduce((s, c) => s + c.totalDeuda, 0)
  const clientesAlta  = todosConDeuda.filter((c) => getBucketMora(c) === 'alta').length
  const clientesMedia = todosConDeuda.filter((c) => getBucketMora(c) === 'media').length

  return (
    <div className="h-full flex bg-fondo overflow-hidden">

      {/* ── Panel izquierdo: lista de clientes ───────────────────────── */}
      <div className={[
        'flex flex-col border-r border-borde bg-white',
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
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-suave text-xs">
              {todosConDeuda.length} cliente{todosConDeuda.length !== 1 ? 's' : ''} con deuda
            </p>
            {clientesAlta > 0 && (
              <span className="text-[10px] font-semibold text-peligro flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-peligro" />
                {clientesAlta} +30d
              </span>
            )}
            {clientesMedia > 0 && (
              <span className="text-[10px] font-semibold text-advertencia flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-advertencia" />
                {clientesMedia} mora
              </span>
            )}
          </div>
        </div>

        {/* Buscador */}
        <div className="p-3 border-b border-borde flex flex-col gap-2">
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

          {/* Filtros de mora */}
          <div className="flex gap-1.5">
            {FILTROS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFiltro(value)}
                className={[
                  'flex-1 h-7 rounded-lg text-xs font-semibold transition-all',
                  filtro === value
                    ? value === 'con_mora'
                      ? 'bg-peligro/15 text-peligro'
                      : value === 'al_dia'
                        ? 'bg-exito/15 text-exito'
                        : 'bg-fiado/15 text-fiado'
                    : 'text-suave hover:text-texto hover:bg-fondo',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
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
                {query
                  ? `Sin resultados para "${query}"`
                  : filtro === 'con_mora'
                    ? 'No hay clientes en mora'
                    : filtro === 'al_dia'
                      ? 'No hay clientes al día con deuda'
                      : 'No hay clientes registrados aún'}
              </p>
            </div>
          )}

          {clientes && clientes.length > 0 && (
            <div className="divide-y divide-borde/50">
              {clientes.map((cliente) => {
                const deudaPositiva = cliente.totalDeuda > 0
                const activo = clienteSeleccionadoId === cliente.id
                const bucket = getBucketMora(cliente)
                const dias   = calcularDiasMora(cliente)

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
                    {/* Avatar con color según mora */}
                    <div className={[
                      'w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm',
                      !deudaPositiva  ? 'bg-gray-100 text-suave'    :
                      bucket === 'alta'  ? 'bg-red-100 text-peligro'  :
                      bucket === 'media' ? 'bg-yellow-100 text-advertencia' :
                                          'bg-red-100 text-peligro',
                    ].join(' ')}>
                      {cliente.nombre.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-texto truncate">
                          {cliente.nombre}
                        </p>
                        <BadgeMora cliente={cliente} />
                      </div>
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

                    {/* Indicador visual de mora alta */}
                    {bucket === 'alta' && dias > 30 && (
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-peligro font-bold leading-tight">{dias}d</p>
                        <p className="text-[9px] text-peligro/70">mora</p>
                      </div>
                    )}
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
