// Panel de auditoría de anulaciones — solo visible para el dueño en ReportesPage
// Muestra quién anuló cada venta, cuándo y por qué.
// Alerta automática cuando un usuario supera 3 anulaciones en efectivo en el mismo día.

import { useState, useEffect, useMemo } from 'react'
import { liveQuery } from 'dexie'
import { AlertTriangle, Shield, Search } from 'lucide-react'
import { db } from '../../db/database'
import { formatCOP } from '../../utils/moneda'
import type { AuditoriaAnulacion } from '../../db/schema'

type Periodo = 'hoy' | 'semana' | 'mes'

function inicioPeriodo(p: Periodo): Date {
  const ahora = new Date()
  if (p === 'hoy') return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  if (p === 'semana') {
    const d = new Date(ahora)
    d.setDate(d.getDate() - 6)
    d.setHours(0, 0, 0, 0)
    return d
  }
  return new Date(ahora.getFullYear(), ahora.getMonth(), 1)
}

function etiquetaTipo(tipo: string): string {
  const mapa: Record<string, string> = {
    efectivo: 'Efectivo',
    fiado: 'Fiado',
    transferencia: 'Transferencia',
    tarjeta: 'Tarjeta',
    mixto: 'Mixto',
  }
  return mapa[tipo] ?? tipo
}

function colorTipo(tipo: string): string {
  if (tipo === 'efectivo') return 'bg-exito/10 text-exito'
  if (tipo === 'fiado') return 'bg-fiado/10 text-fiado'
  return 'bg-primario/10 text-primario'
}

export function LogAnulaciones() {
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [busqueda, setBusqueda] = useState('')
  const [registros, setRegistros] = useState<AuditoriaAnulacion[] | undefined>(undefined)

  const inicio = useMemo(() => inicioPeriodo(periodo), [periodo])

  useEffect(() => {
    setRegistros(undefined)
    const sub = liveQuery(async (): Promise<AuditoriaAnulacion[]> => {
      return db.auditoriaAnulaciones
        .where('creadoEn')
        .aboveOrEqual(inicio)
        .reverse()
        .toArray()
    }).subscribe({
      next: setRegistros,
      error: (err) => {
        console.error('[LogAnulaciones]', err)
        setRegistros([])
      },
    })
    return () => sub.unsubscribe()
  }, [inicio])

  // Actividad inusual: más de 3 anulaciones en efectivo del mismo usuario HOY
  const alertasInusuales = useMemo(() => {
    if (!registros) return []
    const hoyStr = new Date().toDateString()
    const conteos: Record<string, number> = {}
    for (const r of registros) {
      if (
        r.ventaTipoPago === 'efectivo' &&
        new Date(r.creadoEn).toDateString() === hoyStr
      ) {
        conteos[r.usuarioNombre] = (conteos[r.usuarioNombre] ?? 0) + 1
      }
    }
    return Object.entries(conteos)
      .filter(([, n]) => n > 3)
      .map(([nombre, count]) => ({ nombre, count }))
  }, [registros])

  // Filtrar por búsqueda libre (usuario, motivo, # venta)
  const registrosFiltrados = useMemo(() => {
    if (!registros) return undefined
    if (!busqueda.trim()) return registros
    const lower = busqueda.toLowerCase()
    return registros.filter(
      (r) =>
        r.usuarioNombre.toLowerCase().includes(lower) ||
        r.motivo.toLowerCase().includes(lower) ||
        String(r.ventaId).includes(lower),
    )
  }, [registros, busqueda])

  return (
    <div className="bg-white rounded-xl border border-borde overflow-hidden">
      {/* Encabezado */}
      <div className="px-4 py-3 border-b border-borde/50 flex items-center gap-2">
        <Shield size={16} className="text-primario" />
        <span className="text-sm font-semibold text-texto">Auditoría de anulaciones</span>
        {registros !== undefined && registros.length > 0 && (
          <span className="ml-auto text-xs text-suave">
            {registros.length} registro{registros.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3">

        {/* Alertas de actividad inusual */}
        {alertasInusuales.map(({ nombre, count }) => (
          <div
            key={nombre}
            className="flex items-start gap-3 p-3 bg-peligro/8 border border-peligro/25 rounded-xl"
          >
            <AlertTriangle size={18} className="text-peligro shrink-0 mt-0.5" />
            <p className="text-sm text-peligro font-medium leading-snug">
              <span className="font-bold">Actividad inusual:</span>{' '}
              <span className="font-bold">{nombre}</span> ha anulado{' '}
              <span className="font-bold">{count}</span> ventas en efectivo hoy.
            </p>
          </div>
        ))}

        {/* Filtros de período */}
        <div className="flex gap-1.5 bg-fondo rounded-xl border border-borde p-1">
          {(['hoy', 'semana', 'mes'] as Periodo[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              className={[
                'flex-1 h-8 rounded-lg text-xs font-semibold transition-all',
                periodo === p
                  ? 'bg-primario text-white shadow-sm'
                  : 'text-suave hover:text-texto',
              ].join(' ')}
            >
              {p === 'hoy' ? 'Hoy' : p === 'semana' ? '7 días' : 'Este mes'}
            </button>
          ))}
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-suave pointer-events-none"
          />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cajero, motivo o # venta…"
            className="w-full h-10 pl-8 pr-3 border border-borde rounded-xl text-sm text-texto
                       placeholder:text-suave focus:outline-none focus:ring-2
                       focus:ring-primario/30 focus:border-primario/50 bg-white"
          />
        </div>

        {/* Lista de registros */}
        {!registrosFiltrados ? (
          <div className="flex justify-center p-6">
            <div className="w-5 h-5 border-2 border-primario/30 border-t-primario rounded-full animate-spin" />
          </div>
        ) : registrosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-suave/50">
            <Shield size={28} />
            <p className="text-sm">
              {busqueda
                ? 'Sin resultados para esa búsqueda'
                : 'Sin anulaciones en este período'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {registrosFiltrados.map((r) => (
              <div
                key={r.id}
                className="border border-borde/70 rounded-xl p-3 flex flex-col gap-1.5"
              >
                {/* Fila 1: # venta + tipo de pago + total */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-suave">
                      #{r.ventaId}
                    </span>
                    <span
                      className={[
                        'text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                        colorTipo(r.ventaTipoPago),
                      ].join(' ')}
                    >
                      {etiquetaTipo(r.ventaTipoPago)}
                    </span>
                  </div>
                  <span className="moneda font-bold text-sm text-peligro shrink-0">
                    -{formatCOP(r.ventaTotal)}
                  </span>
                </div>

                {/* Fila 2: quién anuló + cuándo */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs text-suave font-medium truncate">
                      {r.usuarioNombre}
                    </span>
                    <span className="text-[10px] text-suave/60 bg-fondo px-1.5 py-0.5 rounded-full shrink-0 capitalize">
                      {r.usuarioRol}
                    </span>
                  </div>
                  <span className="text-xs text-suave shrink-0">
                    {new Date(r.creadoEn).toLocaleDateString('es-CO', {
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    {new Date(r.creadoEn).toLocaleTimeString('es-CO', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Fila 3: motivo */}
                <p className="text-xs text-suave leading-snug line-clamp-2 italic">
                  "{r.motivo}"
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
