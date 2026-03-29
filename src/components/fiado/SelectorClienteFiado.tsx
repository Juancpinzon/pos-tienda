// Selector de cliente para el módulo de fiados.
// Flujo: buscar → seleccionar existente ó crear nuevo en 1 toque.
// Principio: máximo 2 toques, solo nombre obligatorio.

import { useState, useEffect, useRef } from 'react'
import { Search, UserPlus, UserCheck, X, AlertTriangle } from 'lucide-react'
import { buscarClientes, crearCliente } from '../../hooks/useFiados'
import { formatCOP } from '../../utils/moneda'
import type { Cliente } from '../../db/schema'

export interface ClienteFiado {
  id?: number
  nombre: string
  totalDeuda: number
  limiteCredito?: number
}

interface SelectorClienteFiadoProps {
  value: ClienteFiado | null
  onChange: (v: ClienteFiado | null) => void
}

export function SelectorClienteFiado({ value, onChange }: SelectorClienteFiadoProps) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Cliente[]>([])
  const [creando, setCreando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)

  // Si ya hay un cliente seleccionado, no mostrar el buscador de nuevo
  const clienteActivo = value

  // Búsqueda con debounce 250ms
  useEffect(() => {
    if (clienteActivo || query.length < 1) {
      setResultados([])
      return
    }
    const t = setTimeout(async () => {
      const found = await buscarClientes(query)
      setResultados(found)
    }, 250)
    return () => clearTimeout(t)
  }, [query, clienteActivo])

  // Cerrar dropdown al clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setResultados([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const seleccionarCliente = (c: Cliente) => {
    onChange({ id: c.id, nombre: c.nombre, totalDeuda: c.totalDeuda, limiteCredito: c.limiteCredito })
    setQuery('')
    setResultados([])
  }

  const handleCrearCliente = async () => {
    const nombre = query.trim()
    if (nombre.length < 2) return
    setCreando(true)
    try {
      const id = await crearCliente(nombre)
      onChange({ id, nombre, totalDeuda: 0 })
      setQuery('')
      setResultados([])
    } finally {
      setCreando(false)
    }
  }

  const limpiar = () => {
    onChange(null)
    setQuery('')
    setResultados([])
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // ── Cliente ya seleccionado → mostrar tarjeta ─────────────────────────────
  if (clienteActivo) {
    const sobreLimite =
      clienteActivo.limiteCredito !== undefined &&
      clienteActivo.limiteCredito > 0 &&
      clienteActivo.totalDeuda >= clienteActivo.limiteCredito

    return (
      <div className="flex flex-col gap-2">
        {/* Tarjeta del cliente */}
        <div className={[
          'flex items-center justify-between rounded-xl p-3 border',
          sobreLimite ? 'bg-orange-50 border-orange-300' : 'bg-fiado/10 border-fiado/30',
        ].join(' ')}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center
                            ${sobreLimite ? 'bg-orange-200' : 'bg-fiado/20'}`}>
              <UserCheck size={18} className={sobreLimite ? 'text-orange-600' : 'text-fiado'} />
            </div>
            <div>
              <p className="font-semibold text-texto text-sm">{clienteActivo.nombre}</p>
              <p className={`text-xs moneda ${clienteActivo.totalDeuda > 0 ? 'text-peligro' : 'text-exito'}`}>
                {clienteActivo.totalDeuda > 0
                  ? `Deuda actual: ${formatCOP(clienteActivo.totalDeuda)}`
                  : clienteActivo.id ? 'Sin deuda' : 'Cliente nuevo'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={limpiar}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-suave hover:text-texto hover:bg-black/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Advertencia de límite de crédito (no bloquea) */}
        {sobreLimite && (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200
                          rounded-xl p-2 text-xs text-orange-700">
            <AlertTriangle size={14} className="shrink-0" />
            <span>
              Supera el límite de crédito ({formatCOP(clienteActivo.limiteCredito!)}).
              El tendero decide si fiará.
            </span>
          </div>
        )}
      </div>
    )
  }

  // ── Formulario de búsqueda / creación ─────────────────────────────────────
  const puedeCrear = query.trim().length >= 2 && resultados.length === 0

  return (
    <div ref={contenedorRef} className="relative flex flex-col gap-2">
      {/* Input de búsqueda */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre del cliente (Don Carlos, La vecina…)"
          autoFocus
          className="w-full h-12 pl-9 pr-4 border border-borde rounded-xl text-base
                     focus:outline-none focus:ring-2 focus:ring-fiado/40 focus:border-fiado"
        />
      </div>

      {/* Dropdown resultados existentes */}
      {resultados.length > 0 && (
        <div className="absolute top-14 left-0 right-0 z-10
                        bg-white border border-borde rounded-xl shadow-lg overflow-hidden">
          {resultados.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => seleccionarCliente(c)}
              className="w-full flex items-center justify-between px-4 py-3
                         hover:bg-fondo transition-colors border-b border-borde/50 last:border-0"
            >
              <span className="text-sm font-medium text-texto">{c.nombre}</span>
              <span className={`moneda text-xs font-bold ${c.totalDeuda > 0 ? 'text-peligro' : 'text-exito'}`}>
                {c.totalDeuda > 0 ? formatCOP(c.totalDeuda) : 'Sin deuda'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Botón crear nuevo cliente — aparece cuando no hay coincidencias */}
      {puedeCrear && (
        <button
          type="button"
          onClick={handleCrearCliente}
          disabled={creando}
          className="flex items-center justify-center gap-2 h-12
                     bg-fiado/10 border border-fiado/40 text-fiado
                     rounded-xl font-semibold text-sm
                     hover:bg-fiado/20 active:scale-95 transition-all
                     disabled:opacity-50"
        >
          <UserPlus size={16} />
          {creando ? 'Creando…' : `Crear cliente "${query.trim()}"`}
        </button>
      )}

      {/* Ayuda: escribir para buscar o crear */}
      {query.length < 2 && (
        <p className="text-xs text-suave text-center px-2">
          Escribe el nombre para buscar o crear un cliente nuevo
        </p>
      )}
    </div>
  )
}
