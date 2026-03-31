import { useState, useEffect, useMemo } from 'react'
import { liveQuery } from 'dexie'
import { TrendingUp, ShoppingBag, BarChart2, Users, Truck, Clock } from 'lucide-react'
import { db } from '../db/database'
import { formatCOP } from '../utils/moneda'
import { getBucketMora } from '../hooks/useFiados'
import { DashboardUtilidadNeta } from '../components/reportes/DashboardUtilidadNeta'
import type { Cliente } from '../db/schema'

// ─── Tipos de período ─────────────────────────────────────────────────────────

type Periodo = 'hoy' | 'semana' | 'mes'

function inicioDePerido(periodo: Periodo): Date {
  const ahora = new Date()
  if (periodo === 'hoy') {
    return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  }
  if (periodo === 'semana') {
    const d = new Date(ahora)
    d.setDate(d.getDate() - 6)
    d.setHours(0, 0, 0, 0)
    return d
  }
  // mes
  return new Date(ahora.getFullYear(), ahora.getMonth(), 1)
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ReportesPage() {
  const [periodo, setPeriodo] = useState<Periodo>('hoy')

  const inicio = useMemo(() => inicioDePerido(periodo), [periodo])

  // Tipos locales para los estados de reporte
  type DatosPeriodo = {
    ventas: Awaited<ReturnType<typeof db.ventas.toArray>>
    totalVendido: number
    cantidadVentas: number
    ticketPromedio: number
    totalEfectivo: number
    totalTransferencia: number
    totalNequi: number
    totalDaviplata: number
    totalDale: number
    totalFiado: number
    // Anuladas
    totalAnulado: number
    cantidadAnuladas: number
  }
  type TopProducto = { nombre: string; cantidad: number; monto: number }
  type MargenPeriodo = { margen: number; conConoce: number; sinConoce: number } | null

  // Ventas del período
  const [datos, setDatos] = useState<DatosPeriodo | undefined>(undefined)

  useEffect(() => {
    setDatos(undefined)
    const sub = liveQuery(async (): Promise<DatosPeriodo> => {
      const ventas = await db.ventas
        .where('creadaEn').aboveOrEqual(inicio)
        .filter((v) => v.estado === 'completada')
        .toArray()

      // Anuladas del mismo período
      const anuladas = await db.ventas
        .where('creadaEn').aboveOrEqual(inicio)
        .filter((v) => v.estado === 'anulada')
        .toArray()

      const totalAnulado    = anuladas.reduce((s, v) => s + v.total, 0)
      const cantidadAnuladas = anuladas.length

      if (ventas.length === 0) {
        return { ventas: [], totalVendido: 0, cantidadVentas: 0, ticketPromedio: 0, totalEfectivo: 0, totalTransferencia: 0, totalNequi: 0, totalDaviplata: 0, totalDale: 0, totalFiado: 0, totalAnulado, cantidadAnuladas }
      }

      const totalVendido       = ventas.reduce((s, v) => s + v.total, 0)
      const totalEfectivo      = ventas.filter((v) => v.tipoPago === 'efectivo').reduce((s, v) => s + v.total, 0)
      const transVentas        = ventas.filter((v) => v.tipoPago === 'transferencia')
      const totalTransferencia = transVentas.reduce((s, v) => s + v.total, 0)
      const totalNequi         = transVentas.filter((v) => v.notas === 'Nequi').reduce((s, v) => s + v.total, 0)
      const totalDaviplata     = transVentas.filter((v) => v.notas === 'Daviplata').reduce((s, v) => s + v.total, 0)
      const totalDale          = transVentas.filter((v) => v.notas === 'Dale').reduce((s, v) => s + v.total, 0)
      const totalFiado         = ventas.filter((v) => v.tipoPago === 'fiado').reduce((s, v) => s + v.total, 0)
      const ticketPromedio     = Math.round(totalVendido / ventas.length)

      return { ventas, totalVendido, cantidadVentas: ventas.length, ticketPromedio, totalEfectivo, totalTransferencia, totalNequi, totalDaviplata, totalDale, totalFiado, totalAnulado, cantidadAnuladas }
    }).subscribe({
      next: setDatos,
      error: (err) => {
        console.error('[ReportesPage:datos]', err)
        setDatos({ ventas: [], totalVendido: 0, cantidadVentas: 0, ticketPromedio: 0, totalEfectivo: 0, totalTransferencia: 0, totalNequi: 0, totalDaviplata: 0, totalDale: 0, totalFiado: 0, totalAnulado: 0, cantidadAnuladas: 0 })
      },
    })
    return () => sub.unsubscribe()
  }, [inicio])

  // Top 10 productos más vendidos (por monto) + margen promedio
  const [topProductos, setTopProductos] = useState<TopProducto[] | undefined>(undefined)
  const [margenPeriodo, setMargenPeriodo] = useState<MargenPeriodo | undefined>(undefined)

  useEffect(() => {
    setTopProductos(undefined)
    setMargenPeriodo(undefined)
    const sub = liveQuery(async (): Promise<{ top: TopProducto[]; margen: MargenPeriodo }> => {
      const ventasIds = await db.ventas
        .where('creadaEn').aboveOrEqual(inicio)
        .filter((v) => v.estado === 'completada')
        .primaryKeys()

      if (ventasIds.length === 0) return { top: [], margen: null }

      const detalles = await db.detallesVenta
        .where('ventaId').anyOf(ventasIds as number[])
        .toArray()

      const acum: Record<string, TopProducto> = {}
      let totalConCosto = 0
      let totalCosto = 0

      for (const d of detalles) {
        const key = d.productoId ? String(d.productoId) : `fantasma_${d.nombreProducto}`
        if (!acum[key]) acum[key] = { nombre: d.nombreProducto, cantidad: 0, monto: 0 }
        acum[key].cantidad += d.cantidad
        acum[key].monto += d.subtotal

        // Calcular margen si hay snapshot de costo
        if (d.precioCompraSnapshot !== undefined && d.precioCompraSnapshot > 0) {
          totalConCosto += d.subtotal
          totalCosto += d.precioCompraSnapshot * d.cantidad
        }
      }

      const top = Object.values(acum)
        .sort((a, b) => b.monto - a.monto)
        .slice(0, 10)

      const margen: MargenPeriodo = totalConCosto > 0
        ? {
            margen: Math.round(((totalConCosto - totalCosto) / totalConCosto) * 100),
            conConoce: totalConCosto,
            sinConoce: detalles.reduce((s, d) => s + d.subtotal, 0) - totalConCosto,
          }
        : null

      return { top, margen }
    }).subscribe({
      next: ({ top, margen }) => { setTopProductos(top); setMargenPeriodo(margen) },
      error: (err) => {
        console.error('[ReportesPage:topProductos]', err)
        setTopProductos([])
        setMargenPeriodo(null)
      },
    })
    return () => sub.unsubscribe()
  }, [inicio])

  // Top 5 clientes con más deuda (no depende del período)
  const [topDeudores, setTopDeudores] = useState<Cliente[] | undefined>(undefined)

  useEffect(() => {
    const sub = liveQuery(async () => {
      const clientes = await db.clientes
        .filter((c) => c.activo && c.totalDeuda > 0)
        .toArray()
      return clientes.sort((a, b) => b.totalDeuda - a.totalDeuda).slice(0, 5)
    }).subscribe({
      next: setTopDeudores,
      error: (err) => {
        console.error('[ReportesPage:topDeudores]', err)
        setTopDeudores([])
      },
    })
    return () => sub.unsubscribe()
  }, [])

  // Compras del período (para margen bruto)
  const [totalCompras, setTotalCompras] = useState<number | undefined>(undefined)

  useEffect(() => {
    setTotalCompras(undefined)
    const sub = liveQuery(async (): Promise<number> => {
      const compras = await db.comprasProveedor
        .where('creadaEn').aboveOrEqual(inicio)
        .toArray()
      return compras.reduce((s, c) => s + c.total, 0)
    }).subscribe({
      next: setTotalCompras,
      error: (err) => {
        console.error('[ReportesPage:totalCompras]', err)
        setTotalCompras(0)
      },
    })
    return () => sub.unsubscribe()
  }, [inicio])

  // Cartera por antigüedad (no depende del período — es snapshot actual)
  type BucketCartera = { monto: number; clientes: number }
  type CarteraAntiguedad = { al_dia: BucketCartera; media: BucketCartera; alta: BucketCartera }
  const [carteraAntiguedad, setCarteraAntiguedad] = useState<CarteraAntiguedad | undefined>(undefined)

  useEffect(() => {
    const sub = liveQuery(async (): Promise<CarteraAntiguedad> => {
      const todos = await db.clientes.filter((c) => c.activo && c.totalDeuda > 0).toArray()
      const result: CarteraAntiguedad = {
        al_dia: { monto: 0, clientes: 0 },
        media:  { monto: 0, clientes: 0 },
        alta:   { monto: 0, clientes: 0 },
      }
      for (const c of todos) {
        const bucket = getBucketMora(c)
        result[bucket].monto   += c.totalDeuda
        result[bucket].clientes += 1
      }
      return result
    }).subscribe({
      next: setCarteraAntiguedad,
      error: (err) => { console.error('[ReportesPage:cartera]', err) },
    })
    return () => sub.unsubscribe()
  }, [])

  const maxMonto = topProductos && topProductos.length > 0 ? topProductos[0].monto : 1

  return (
    <div className="h-full flex flex-col bg-fondo overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">

          {/* Selector de período */}
          <div className="flex gap-2 bg-white rounded-xl border border-borde p-1.5">
            {(['hoy', 'semana', 'mes'] as Periodo[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodo(p)}
                className={[
                  'flex-1 h-9 rounded-lg text-sm font-semibold transition-all capitalize',
                  periodo === p
                    ? 'bg-primario text-white shadow-sm'
                    : 'text-suave hover:text-texto',
                ].join(' ')}
              >
                {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Últimos 7 días' : 'Este mes'}
              </button>
            ))}
          </div>

          {/* Dashboard de Utilidad Neta — solo para dueño */}
          <DashboardUtilidadNeta inicio={inicio} />

          {/* Métricas principales */}
          {datos ? (
            <div className="grid grid-cols-2 gap-3">

              {/* ── Total vendido + desglose por método (ancho completo) ── */}
              <div className="col-span-2 bg-white rounded-xl border border-borde p-4 flex flex-col gap-3">
                {/* Encabezado */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primario/10 text-primario rounded-lg flex items-center justify-center shrink-0">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-suave">Ventas netas</p>
                    <p className="moneda font-bold text-xl text-primario leading-tight">
                      {formatCOP(datos.totalVendido)}
                    </p>
                  </div>
                  <p className="ml-auto text-xs text-suave self-start">
                    {datos.cantidadVentas} venta{datos.cantidadVentas !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Ventas anuladas — solo si hay alguna */}
                {datos.cantidadAnuladas > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 bg-peligro/5 border border-peligro/20 rounded-xl">
                    <div>
                      <p className="text-xs font-medium text-peligro">
                        ❌ {datos.cantidadAnuladas} venta{datos.cantidadAnuladas !== 1 ? 's' : ''} anulada{datos.cantidadAnuladas !== 1 ? 's' : ''}
                      </p>
                      <p className="text-[10px] text-suave mt-0.5">
                        Ventas brutas: {formatCOP(datos.totalVendido + datos.totalAnulado)} · Netas: {formatCOP(datos.totalVendido)}
                      </p>
                    </div>
                    <span className="moneda font-bold text-sm text-peligro">-{formatCOP(datos.totalAnulado)}</span>
                  </div>
                )}

                {/* Desglose por método de pago */}
                <div className="grid grid-cols-3 gap-0 border-t border-borde/60 pt-3 divide-x divide-borde/50">
                  <SubMetrica emoji="💵" label="Efectivo"       valor={datos.totalEfectivo}      color="text-exito"   />
                  <SubMetricaTransferencia
                    total={datos.totalTransferencia}
                    nequi={datos.totalNequi}
                    daviplata={datos.totalDaviplata}
                    dale={datos.totalDale}
                  />
                  <SubMetrica emoji="📒" label="Fiado"          valor={datos.totalFiado}         color="text-fiado"   />
                </div>
              </div>

              {/* ── Ticket promedio y ventas ── */}
              <TarjetaMetrica
                icon={<BarChart2 size={18} />}
                label="Ticket promedio"
                valor={formatCOP(datos.ticketPromedio)}
                color="text-exito"
                bg="bg-exito/10"
              />
              <TarjetaMetrica
                icon={<ShoppingBag size={18} />}
                label="Cant. de ventas"
                valor={String(datos.cantidadVentas)}
                color="text-acento"
                bg="bg-acento/10"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 h-32 bg-white rounded-xl border border-borde animate-pulse" />
              <div className="h-24 bg-white rounded-xl border border-borde animate-pulse" />
              <div className="h-24 bg-white rounded-xl border border-borde animate-pulse" />
            </div>
          )}

          {/* Margen promedio del período */}
          {margenPeriodo !== undefined && margenPeriodo !== null && (
            <div className={[
              'rounded-xl border p-4 flex items-center gap-4',
              margenPeriodo.margen >= 25
                ? 'bg-exito/5 border-exito/25'
                : margenPeriodo.margen >= 15
                  ? 'bg-advertencia/5 border-advertencia/25'
                  : 'bg-peligro/5 border-peligro/25',
            ].join(' ')}>
              <div className={[
                'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-xl font-black',
                margenPeriodo.margen >= 25
                  ? 'bg-exito/15 text-exito'
                  : margenPeriodo.margen >= 15
                    ? 'bg-advertencia/15 text-advertencia'
                    : 'bg-peligro/15 text-peligro',
              ].join(' ')}>
                {margenPeriodo.margen}%
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-texto">Margen promedio del período</p>
                <p className="text-xs text-suave mt-0.5">
                  {margenPeriodo.margen >= 25
                    ? 'Excelente margen — sigue así'
                    : margenPeriodo.margen >= 15
                      ? 'Margen aceptable — puedes mejorar'
                      : 'Margen bajo — revisa precios de venta'}
                </p>
                {margenPeriodo.sinConoce > 0 && (
                  <p className="text-[10px] text-suave/70 mt-1">
                    Calculado sobre {formatCOP(margenPeriodo.conConoce)} de ventas con costo conocido
                  </p>
                )}
              </div>
            </div>
          )}
          {margenPeriodo !== undefined && margenPeriodo === null && topProductos && topProductos.length > 0 && (
            <div className="bg-fondo rounded-xl border border-borde p-3 flex items-center gap-3">
              <span className="text-xl">📊</span>
              <p className="text-xs text-suave">
                Registra el precio de compra en los productos para ver el margen promedio aquí.
              </p>
            </div>
          )}

          {/* Top 10 productos */}
          <div className="bg-white rounded-xl border border-borde overflow-hidden">
            <div className="px-4 py-3 border-b border-borde/50 flex items-center gap-2">
              <BarChart2 size={16} className="text-primario" />
              <span className="text-sm font-semibold text-texto">Productos más vendidos</span>
            </div>

            {!topProductos ? (
              <div className="p-6 flex justify-center">
                <div className="w-5 h-5 border-2 border-primario/30 border-t-primario rounded-full animate-spin" />
              </div>
            ) : topProductos.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-suave/50">
                <span className="text-3xl">📊</span>
                <p className="text-sm">Sin ventas en este período</p>
              </div>
            ) : (
              <div className="divide-y divide-borde/30">
                {topProductos.map((p, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-suave w-5 shrink-0">#{i + 1}</span>
                        <span className="text-sm font-medium text-texto truncate">{p.nombre}</span>
                      </div>
                      <span className="moneda text-sm font-bold text-primario shrink-0 ml-2">
                        {formatCOP(p.monto)}
                      </span>
                    </div>
                    {/* Barra de progreso */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primario rounded-full transition-all"
                          style={{ width: `${(p.monto / maxMonto) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-suave shrink-0">
                        {p.cantidad % 1 === 0 ? p.cantidad : p.cantidad.toFixed(1)}x
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compras del período y margen bruto */}
          {(totalCompras !== undefined || datos) && (
            <div className="bg-white rounded-xl border border-borde overflow-hidden">
              <div className="px-4 py-3 border-b border-borde/50 flex items-center gap-2">
                <Truck size={16} className="text-acento" />
                <span className="text-sm font-semibold text-texto">
                  Compras a proveedores
                </span>
              </div>

              {totalCompras === undefined ? (
                <div className="p-6 flex justify-center">
                  <div className="w-5 h-5 border-2 border-acento/30 border-t-acento rounded-full animate-spin" />
                </div>
              ) : (
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="w-8 h-8 bg-acento/10 text-acento rounded-lg flex items-center justify-center mb-1">
                      <Truck size={16} />
                    </div>
                    <p className="text-xs text-suave">Compras del período</p>
                    <p className="moneda font-bold text-lg text-acento leading-tight">
                      {formatCOP(totalCompras)}
                    </p>
                  </div>
                  {datos && (
                    <div className="flex flex-col gap-1">
                      <div className={[
                        'w-8 h-8 rounded-lg flex items-center justify-center mb-1',
                        datos.totalVendido - totalCompras >= 0
                          ? 'bg-exito/10 text-exito'
                          : 'bg-peligro/10 text-peligro',
                      ].join(' ')}>
                        <TrendingUp size={16} />
                      </div>
                      <p className="text-xs text-suave">Margen bruto aprox.</p>
                      <p className={[
                        'moneda font-bold text-lg leading-tight',
                        datos.totalVendido - totalCompras >= 0 ? 'text-exito' : 'text-peligro',
                      ].join(' ')}>
                        {formatCOP(datos.totalVendido - totalCompras)}
                      </p>
                      {totalCompras > 0 && datos.totalVendido > 0 && (
                        <p className="text-xs text-suave">
                          {Math.round(((datos.totalVendido - totalCompras) / datos.totalVendido) * 100)}% margen
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Cartera por antigüedad */}
          <div className="bg-white rounded-xl border border-borde overflow-hidden">
            <div className="px-4 py-3 border-b border-borde/50 flex items-center gap-2">
              <Clock size={16} className="text-fiado" />
              <span className="text-sm font-semibold text-texto">Cartera por antigüedad</span>
            </div>
            {!carteraAntiguedad ? (
              <div className="p-6 flex justify-center">
                <div className="w-5 h-5 border-2 border-fiado/30 border-t-fiado rounded-full animate-spin" />
              </div>
            ) : (
              <div className="divide-y divide-borde/30">
                {([
                  { key: 'al_dia', emoji: '🟢', label: 'Al día (≤ 7 días)',  color: 'text-exito',      bg: 'bg-exito/8' },
                  { key: 'media',  emoji: '🟡', label: '8-30 días de mora',  color: 'text-advertencia', bg: 'bg-advertencia/8' },
                  { key: 'alta',   emoji: '🔴', label: '+30 días de mora',   color: 'text-peligro',    bg: 'bg-peligro/8' },
                ] as const).map(({ key, emoji, label, color, bg }) => {
                  const b = carteraAntiguedad[key]
                  return (
                    <div key={key} className={`flex items-center gap-3 px-4 py-3 ${b.clientes > 0 ? bg : ''}`}>
                      <span className="text-base shrink-0">{emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-texto">{label}</p>
                        <p className="text-xs text-suave">
                          {b.clientes} cliente{b.clientes !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className={`moneda font-bold text-sm ${b.monto > 0 ? color : 'text-suave/40'}`}>
                        {formatCOP(b.monto)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Top deudores */}
          <div className="bg-white rounded-xl border border-borde overflow-hidden">
            <div className="px-4 py-3 border-b border-borde/50 flex items-center gap-2">
              <Users size={16} className="text-fiado" />
              <span className="text-sm font-semibold text-texto">Clientes con mayor deuda</span>
            </div>

            {!topDeudores ? (
              <div className="p-6 flex justify-center">
                <div className="w-5 h-5 border-2 border-fiado/30 border-t-fiado rounded-full animate-spin" />
              </div>
            ) : topDeudores.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2 text-suave/50">
                <span className="text-3xl">🎉</span>
                <p className="text-sm">Sin deudas pendientes</p>
              </div>
            ) : (
              <div className="divide-y divide-borde/30">
                {topDeudores.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0
                                    font-bold text-sm text-peligro">
                      {c.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-texto truncate">{c.nombre}</p>
                      {c.limiteCredito && (
                        <p className="text-xs text-suave">
                          Límite: {formatCOP(c.limiteCredito)}
                        </p>
                      )}
                    </div>
                    <span className="moneda font-bold text-sm text-peligro shrink-0">
                      {formatCOP(c.totalDeuda)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="h-8" />
        </div>
      </div>
    </div>
  )
}

// ─── Componente auxiliar ──────────────────────────────────────────────────────

// ─── Sub-métrica de transferencias con desglose por plataforma ───────────────

function SubMetricaTransferencia({
  total,
  nequi,
  daviplata,
  dale,
}: {
  total: number
  nequi: number
  daviplata: number
  dale: number
}) {
  const tieneDesglose = nequi > 0 || daviplata > 0 || dale > 0
  return (
    <div className="flex flex-col gap-1 px-3">
      <p className="text-xs text-suave">📱 Transferencias</p>
      <p className={`moneda font-bold text-sm leading-tight ${total > 0 ? 'text-primario' : 'text-suave/40'}`}>
        {formatCOP(total)}
      </p>
      {tieneDesglose && (
        <div className="flex flex-col gap-0.5 mt-0.5 border-t border-borde/40 pt-1">
          {nequi > 0 && (
            <p className="text-[10px] text-suave leading-tight">🟣 Nequi: <span className="moneda">{formatCOP(nequi)}</span></p>
          )}
          {daviplata > 0 && (
            <p className="text-[10px] text-suave leading-tight">🔵 Daviplata: <span className="moneda">{formatCOP(daviplata)}</span></p>
          )}
          {dale > 0 && (
            <p className="text-[10px] text-suave leading-tight">🟡 Dale: <span className="moneda">{formatCOP(dale)}</span></p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-métrica dentro del card "Total vendido" ─────────────────────────────

function SubMetrica({
  emoji,
  label,
  valor,
  color,
}: {
  emoji: string
  label: string
  valor: number
  color: string
}) {
  return (
    <div className="flex flex-col gap-1 px-3 first:pl-0 last:pr-0">
      <p className="text-xs text-suave truncate">
        {emoji} {label}
      </p>
      <p className={`moneda font-bold text-sm leading-tight ${valor > 0 ? color : 'text-suave/40'}`}>
        {formatCOP(valor)}
      </p>
    </div>
  )
}

// ─── Tarjeta de métrica ───────────────────────────────────────────────────────

function TarjetaMetrica({
  icon,
  label,
  valor,
  color,
  bg,
}: {
  icon: React.ReactNode
  label: string
  valor: string
  color: string
  bg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-borde p-4 flex flex-col gap-2">
      <div className={`w-9 h-9 ${bg} ${color} rounded-lg flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-suave">{label}</p>
        <p className={`moneda font-bold text-lg ${color} leading-tight`}>{valor}</p>
      </div>
    </div>
  )
}
