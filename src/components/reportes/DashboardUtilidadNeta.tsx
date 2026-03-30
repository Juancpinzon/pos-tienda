// DashboardUtilidadNeta.tsx
// Cascada de utilidad neta para ReportesPage y CajaPage.
//
// Fórmula:
//   Ventas
//   - COGS (precioCompraSnapshot × cantidad por DetalleVenta)
//   = Utilidad bruta
//   - Gastos operativos (gastosCaja del período)
//   = Utilidad neta
//
// Solo visible para el dueño. El empleado no ve márgenes.

import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Package, Wrench, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react'
import { db } from '../../db/database'
import { formatCOP } from '../../utils/moneda'
import { useAuthStore } from '../../stores/authStore'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DatosUtilidadNeta {
  totalVentas:       number
  cogs:              number   // Costo de ventas calculado desde snapshots
  utilidadBruta:     number
  pctBruta:          number   // % sobre ventas
  gastos:            number
  utilidadNeta:      number
  pctNeta:           number   // % sobre ventas
  // Cobertura de costo
  itemsConCosto:     number   // Líneas de detalle con precioCompraSnapshot
  itemsSinCosto:     number   // Sin snapshot — COGS subestimado
  pctSinCosto:       number   // Proporción de ventas sin costo conocido
}

// ─── Hook que calcula utilidad neta ──────────────────────────────────────────

export function useDatosUtilidadNeta(inicio: Date): DatosUtilidadNeta | null | undefined {
  const [datos, setDatos] = useState<DatosUtilidadNeta | null | undefined>(undefined)

  useEffect(() => {
    setDatos(undefined)
    const sub = liveQuery(async (): Promise<DatosUtilidadNeta | null> => {

      // Ventas completadas del período
      const ventas = await db.ventas
        .where('creadaEn').aboveOrEqual(inicio)
        .filter((v) => v.estado === 'completada')
        .toArray()

      if (ventas.length === 0) return null

      const totalVentas = ventas.reduce((s, v) => s + v.total, 0)
      const ventaIds    = ventas.map((v) => v.id as number)

      // Detalles de venta para calcular COGS
      const detalles = await db.detallesVenta
        .where('ventaId').anyOf(ventaIds)
        .toArray()

      let cogs           = 0
      let itemsConCosto  = 0
      let itemsSinCosto  = 0
      let ventasSinCosto = 0

      for (const d of detalles) {
        if (d.precioCompraSnapshot !== undefined && d.precioCompraSnapshot > 0) {
          cogs          += d.precioCompraSnapshot * d.cantidad
          itemsConCosto += 1
        } else {
          itemsSinCosto  += 1
          ventasSinCosto += d.subtotal
        }
      }

      // Gastos operativos del período (solo de sesiones activas en el rango)
      const sesionesIds = [...new Set(ventas.map((v) => v.sesionCajaId))]
      const gastosBD = await db.gastosCaja
        .where('sesionCajaId').anyOf(sesionesIds)
        .toArray()
      const gastos = gastosBD.reduce((s, g) => s + g.monto, 0)

      // Cascada
      const utilidadBruta = totalVentas - cogs
      const utilidadNeta  = utilidadBruta - gastos
      const pctBruta  = totalVentas > 0 ? Math.round((utilidadBruta / totalVentas) * 100) : 0
      const pctNeta   = totalVentas > 0 ? Math.round((utilidadNeta  / totalVentas) * 100) : 0
      const pctSinCosto = totalVentas > 0 ? Math.round((ventasSinCosto / totalVentas) * 100) : 0

      return {
        totalVentas, cogs, utilidadBruta, pctBruta,
        gastos, utilidadNeta, pctNeta,
        itemsConCosto, itemsSinCosto, pctSinCosto,
      }
    }).subscribe({
      next:  setDatos,
      error: (e) => { console.error('[DashboardUtilidadNeta]', e); setDatos(null) },
    })
    return () => sub.unsubscribe()
  }, [inicio])

  return datos
}

// ─── Color según % utilidad neta ─────────────────────────────────────────────

function colorUtilidadNeta(pct: number) {
  if (pct >= 20) return { texto: 'text-blue-700',   fondo: 'bg-blue-50',   borde: 'border-blue-200' }
  if (pct >= 10) return { texto: 'text-acento',     fondo: 'bg-acento/5',  borde: 'border-acento/25' }
  return              { texto: 'text-red-800',     fondo: 'bg-red-50',    borde: 'border-red-200' }
}

// ─── Fila de cascada ─────────────────────────────────────────────────────────

function FilaCascada({
  icono, label, valor, color = 'text-texto', negativo = false, separador = false, grande = false,
}: {
  icono: string
  label: string
  valor: number
  color?: string
  negativo?: boolean
  separador?: boolean
  grande?: boolean
}) {
  return (
    <>
      {separador && <div className="border-t border-borde/60 my-1" />}
      <div className={['flex items-center justify-between gap-2 py-1.5', grande ? 'py-2' : ''].join(' ')}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none shrink-0">{icono}</span>
          <span className={['text-sm truncate', grande ? 'font-bold text-texto' : 'text-suave'].join(' ')}>
            {label}
          </span>
        </div>
        <span className={[
          'moneda font-bold shrink-0',
          grande ? 'text-lg' : 'text-sm',
          color,
        ].join(' ')}>
          {negativo && valor > 0 ? '−' : ''}{formatCOP(valor)}
        </span>
      </div>
    </>
  )
}

// ─── Dashboard principal ──────────────────────────────────────────────────────

interface DashboardUtilidadNetaProps {
  inicio: Date
  compacto?: boolean   // Para CajaPage — solo muestra utilidad neta en 1 línea
}

export function DashboardUtilidadNeta({ inicio, compacto = false }: DashboardUtilidadNetaProps) {
  const usuario = useAuthStore((s) => s.usuario)
  const navigate = useNavigate()
  const datos = useDatosUtilidadNeta(inicio)

  // Solo el dueño ve esto
  if (usuario?.rol === 'empleado') return null

  // Cargando
  if (datos === undefined) {
    return <div className="h-28 bg-white rounded-xl border border-borde animate-pulse" />
  }

  // Sin ventas
  if (datos === null) return null

  const col = colorUtilidadNeta(datos.pctNeta)
  const advertirSinCosto = datos.pctSinCosto >= 30

  // ── Vista compacta (CajaPage) ────────────────────────────────────────────
  if (compacto) {
    return (
      <button
        type="button"
        onClick={() => navigate('/reportes')}
        className={[
          'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
          'hover:opacity-80 active:scale-[0.98]',
          col.fondo, col.borde,
        ].join(' ')}
      >
        <div className="flex flex-col items-start">
          <span className="text-xs text-suave font-medium">Utilidad estimada del día</span>
          <span className={['moneda font-bold text-xl', col.texto].join(' ')}>
            {formatCOP(datos.utilidadNeta)}
          </span>
          <span className="text-xs text-suave">{datos.pctNeta}% sobre ventas · toca para ver detalle</span>
        </div>
        <ChevronRight size={18} className={col.texto} />
      </button>
    )
  }

  // ── Vista completa (ReportesPage) ────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">

      {/* Banner advertencia sin costo */}
      {advertirSinCosto && (
        <div className="flex items-start gap-3 bg-advertencia/8 border border-advertencia/30
                        rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-advertencia shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-texto leading-snug">
              Para ver la utilidad real, registre el precio de compra en los productos más vendidos
            </p>
            <p className="text-xs text-suave mt-0.5">
              {datos.pctSinCosto}% de las ventas no tienen precio de compra registrado — el margen real puede ser mayor
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/productos')}
            className="text-xs text-primario font-semibold shrink-0 whitespace-nowrap
                       hover:underline transition-colors"
          >
            Ver productos
          </button>
        </div>
      )}

      {/* Card cascada */}
      <div className="bg-white rounded-xl border border-borde overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 border-b border-borde/50 flex items-center gap-2">
          <TrendingUp size={16} className="text-primario" />
          <span className="text-sm font-semibold text-texto flex-1">Utilidad neta del período</span>
        </div>

        {/* Cascada */}
        <div className="px-4 py-3 flex flex-col gap-0.5">

          {/* Ventas */}
          <FilaCascada icono="💰" label="Ventas" valor={datos.totalVentas} color="text-primario" />

          {/* COGS */}
          <FilaCascada
            icono="📦"
            label={datos.itemsSinCosto > 0
              ? `Costo de ventas (${datos.itemsConCosto} de ${datos.itemsConCosto + datos.itemsSinCosto} con costo)`
              : 'Costo de ventas'}
            valor={datos.cogs}
            color="text-peligro"
            negativo
          />

          {/* Utilidad bruta */}
          <FilaCascada
            icono="📊"
            label={`Utilidad bruta (${datos.pctBruta}%)`}
            valor={datos.utilidadBruta}
            color={datos.utilidadBruta >= 0 ? 'text-exito' : 'text-peligro'}
            separador
            grande
          />

          {/* Gastos */}
          {datos.gastos > 0 && (
            <FilaCascada
              icono="🔧"
              label="Gastos operativos"
              valor={datos.gastos}
              color="text-peligro"
              negativo
            />
          )}

          {/* Utilidad neta */}
          <div className={[
            'flex items-center justify-between gap-2 mt-2 rounded-xl px-3 py-3',
            col.fondo, col.borde, 'border',
          ].join(' ')}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className={col.texto} />
              <span className={['text-sm font-bold', col.texto].join(' ')}>
                Utilidad neta ({datos.pctNeta}%)
              </span>
            </div>
            <span className={['moneda font-black text-xl', col.texto].join(' ')}>
              {formatCOP(datos.utilidadNeta)}
            </span>
          </div>

          {/* Nota de cobertura */}
          {datos.itemsSinCosto > 0 && (
            <p className="text-[11px] text-suave/70 mt-2 text-center leading-snug">
              {datos.itemsSinCosto} línea{datos.itemsSinCosto > 1 ? 's' : ''} vendida{datos.itemsSinCosto > 1 ? 's' : ''} sin precio de compra registrado — el margen real puede ser mayor
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
