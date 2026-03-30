import { useState, useEffect, useMemo } from 'react'
import {
  Plus, Wallet, ShoppingBag, TrendingDown,
  Smartphone, Banknote, BookOpen, Lock, ChevronDown, Truck,
} from 'lucide-react'
import { TecladoNumerico } from '../components/shared/TecladoNumerico'
import { CerrarCaja } from '../components/caja/CerrarCaja'
import {
  useSesionActual,
  useResumenCaja,
  useDesglosePlatformasSesion,
  abrirCaja,
  registrarGasto,
  obtenerUltimaCajaCerrada,
} from '../hooks/useCaja'
import { usePagosProveedoresSesion } from '../hooks/useProveedores'
import { DashboardUtilidadNeta } from '../components/reportes/DashboardUtilidadNeta'
import { formatCOP } from '../utils/moneda'
import type { GastoCaja } from '../db/schema'

// ─── Tipos de gasto ───────────────────────────────────────────────────────────

const TIPOS_GASTO: { value: GastoCaja['tipo']; label: string; emoji: string }[] = [
  { value: 'hormiga', label: 'Hormiga', emoji: '🐜' },
  { value: 'proveedor', label: 'Proveedor', emoji: '🚚' },
  { value: 'servicio', label: 'Servicio', emoji: '💡' },
  { value: 'otro', label: 'Otro', emoji: '📋' },
]

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CajaPage() {
  const sesion = useSesionActual()
  const resumen = useResumenCaja(sesion?.id)
  const pagosProveedores = usePagosProveedoresSesion(sesion?.id)
  const desglosePlatformas = useDesglosePlatformasSesion(sesion?.id)

  // Inicio del día actual para el dashboard de utilidad
  const inicioHoy = useMemo(() => {
    const ahora = new Date()
    return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  }, [])

  // Estado apertura de caja
  const [montoApertura, setMontoApertura] = useState('')
  const [abriendo, setAbriendo] = useState(false)

  // Sugerencia: monto de cierre de la última caja
  const [montoCierreSugerido, setMontoCierreSugerido] = useState<number | null>(null)
  const [sugerenciaDismissed, setSugerenciaDismissed] = useState(false)

  useEffect(() => {
    // Solo actuar cuando la pantalla "Abrir caja" está visible (sesion === null)
    if (sesion !== null) return
    setSugerenciaDismissed(false)
    obtenerUltimaCajaCerrada().then((ultima) => {
      setMontoCierreSugerido(ultima?.montoCierre ?? null)
    })
  }, [sesion])

  // Estado modal cierre
  const [mostrarCierre, setMostrarCierre] = useState(false)

  // Estado formulario de gasto
  const [gastosAbierto, setGastosAbierto] = useState(false)
  const [gastoDesc, setGastoDesc] = useState('')
  const [gastoMonto, setGastoMonto] = useState('')
  const [gastoTipo, setGastoTipo] = useState<GastoCaja['tipo']>('hormiga')
  const [guardandoGasto, setGuardandoGasto] = useState(false)

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAbrirCaja = async () => {
    if (abriendo) return
    setAbriendo(true)
    try {
      await abrirCaja(parseInt(montoApertura || '0', 10))
      setMontoApertura('')
    } finally {
      setAbriendo(false)
    }
  }

  const handleRegistrarGasto = async () => {
    if (!gastoDesc.trim() || !gastoMonto || guardandoGasto || !sesion?.id) return
    setGuardandoGasto(true)
    try {
      await registrarGasto(sesion.id, gastoDesc.trim(), parseInt(gastoMonto, 10), gastoTipo)
      setGastoDesc('')
      setGastoMonto('')
      setGastoTipo('hormiga')
    } finally {
      setGuardandoGasto(false)
    }
  }

  // ── Vista: cargando ────────────────────────────────────────────────────────

  if (sesion === undefined) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primario/30 border-t-primario rounded-full animate-spin" />
      </div>
    )
  }

  // ── Vista: sin sesión abierta ──────────────────────────────────────────────

  if (!sesion) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 p-6 bg-fondo">
        <div className="text-6xl">💰</div>
        <div className="text-center">
          <h2 className="font-display font-bold text-xl text-texto mb-1">Abrir caja del día</h2>
          <p className="text-sm text-suave">Ingresa el efectivo con que arrancas hoy</p>
        </div>

        {/* Sugerencia basada en el cierre de la última caja */}
        {montoCierreSugerido !== null && montoCierreSugerido > 0 && !sugerenciaDismissed && (
          <div className="w-full max-w-xs bg-exito/8 border border-exito/25 rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-sm text-texto text-center leading-snug">
              La última caja cerró con{' '}
              <span className="moneda font-bold text-exito">{formatCOP(montoCierreSugerido)}</span>
              {' '}en efectivo. ¿Arranca con ese mismo monto?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMontoApertura(String(montoCierreSugerido))
                  setSugerenciaDismissed(true)
                }}
                className="flex-1 h-11 bg-exito text-white rounded-xl font-semibold text-sm
                           hover:bg-exito/90 active:scale-95 transition-all"
              >
                Sí, usar {formatCOP(montoCierreSugerido)}
              </button>
              <button
                type="button"
                onClick={() => setSugerenciaDismissed(true)}
                className="h-11 px-3 border border-borde text-suave rounded-xl text-sm
                           hover:border-gray-300 hover:text-texto active:scale-95 transition-all"
              >
                No
              </button>
            </div>
          </div>
        )}

        <div className="w-full max-w-xs bg-white rounded-2xl border border-borde p-5 flex flex-col gap-4">
          <div className="text-center">
            <p className="text-xs text-suave mb-1">Efectivo inicial</p>
            <p className="moneda font-bold text-3xl text-texto">
              {montoApertura ? formatCOP(parseInt(montoApertura, 10)) : '$0'}
            </p>
          </div>

          <TecladoNumerico valor={montoApertura} onChange={setMontoApertura} />

          <button
            type="button"
            onClick={handleAbrirCaja}
            disabled={abriendo}
            className="h-14 bg-primario text-white rounded-xl font-display font-bold text-lg
                       hover:bg-primario-hover active:scale-95 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {abriendo ? 'Abriendo…' : '🏪 Abrir caja'}
          </button>
        </div>
      </div>
    )
  }

  // ── Vista: caja abierta ────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-fondo overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">

          {/* Resumen del día */}
          <div className="bg-white rounded-xl border border-borde overflow-hidden">
            <div className="px-4 py-3 border-b border-borde/50 flex items-center gap-2">
              <Wallet size={16} className="text-primario" />
              <span className="text-sm font-semibold text-texto">Resumen del día</span>
              <span className="ml-auto text-xs text-suave">
                Abierta {sesion.abiertaEn.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {resumen ? (
              <>
                {/* Total grande */}
                <div className="px-4 py-4 border-b border-borde/50">
                  <p className="text-xs text-suave mb-0.5">Total vendido</p>
                  <p className="moneda font-bold text-3xl text-primario">
                    {formatCOP(resumen.totalVentas)}
                  </p>
                  <p className="text-xs text-suave mt-1">
                    {resumen.cantidadVentas} venta{resumen.cantidadVentas !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Desglose por método de pago — siempre visible para el tendero */}
                <div className="divide-y divide-borde/30">
                  <FilaDesglose
                    icon={<Banknote size={14} />}
                    label="💵 Efectivo"
                    valor={resumen.totalEfectivo}
                    color="text-exito"
                    siempre
                  />
                  <FilaDesglose
                    icon={<Smartphone size={14} />}
                    label="📱 Transferencias"
                    valor={resumen.totalTransferencia}
                    color="text-primario"
                    siempre
                  />
                  {/* Sub-filas por plataforma — solo si hay ventas con plataforma registrada */}
                  {desglosePlatformas && resumen.totalTransferencia > 0 && (
                    <>
                      {desglosePlatformas.nequi > 0 && (
                        <div className="flex items-center justify-between px-4 py-1.5 pl-12 bg-fondo/60">
                          <span className="text-xs text-suave">🟣 Nequi</span>
                          <span className="moneda text-xs text-suave font-medium">{formatCOP(desglosePlatformas.nequi)}</span>
                        </div>
                      )}
                      {desglosePlatformas.daviplata > 0 && (
                        <div className="flex items-center justify-between px-4 py-1.5 pl-12 bg-fondo/60">
                          <span className="text-xs text-suave">🔵 Daviplata</span>
                          <span className="moneda text-xs text-suave font-medium">{formatCOP(desglosePlatformas.daviplata)}</span>
                        </div>
                      )}
                      {desglosePlatformas.dale > 0 && (
                        <div className="flex items-center justify-between px-4 py-1.5 pl-12 bg-fondo/60">
                          <span className="text-xs text-suave">🟡 Dale</span>
                          <span className="moneda text-xs text-suave font-medium">{formatCOP(desglosePlatformas.dale)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <FilaDesglose
                    icon={<BookOpen size={14} />}
                    label="📒 Fiado"
                    valor={resumen.totalFiado}
                    color="text-fiado"
                    siempre
                  />
                  <FilaDesglose
                    icon={<TrendingDown size={14} />}
                    label="Gastos del día"
                    valor={resumen.totalGastos}
                    color="text-peligro"
                    negativo
                  />
                </div>

                {/* Efectivo esperado en caja (solo efectivo físico, sin transferencias) */}
                <div className="px-4 py-3 bg-exito/5 border-t border-exito/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-texto">Efectivo esperado en caja</span>
                      <p className="text-xs text-suave mt-0.5">
                        Apertura {formatCOP(sesion.montoApertura)} + ventas efectivo
                        {resumen.totalGastos > 0 && ` − gastos ${formatCOP(resumen.totalGastos)}`}
                      </p>
                    </div>
                    <span className="moneda font-bold text-xl text-exito shrink-0 ml-3">
                      {formatCOP(resumen.efectivoEsperado)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 flex justify-center">
                <div className="w-6 h-6 border-2 border-primario/30 border-t-primario rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Utilidad estimada del día — solo para dueño */}
          <DashboardUtilidadNeta inicio={inicioHoy} compacto />

          {/* Últimas ventas */}
          {resumen && resumen.ultimasVentas.length > 0 && (
            <div className="bg-white rounded-xl border border-borde overflow-hidden">
              <div className="px-4 py-3 border-b border-borde/50 flex items-center gap-2">
                <ShoppingBag size={16} className="text-primario" />
                <span className="text-sm font-semibold text-texto">Últimas ventas</span>
              </div>
              <div className="divide-y divide-borde/30">
                {resumen.ultimasVentas.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-primario/10 flex items-center justify-center shrink-0">
                      <ShoppingBag size={14} className="text-primario" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-texto">
                        {v.itemCount} producto{v.itemCount !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-suave capitalize">
                        {v.tipoPago} · {v.creadaEn.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className="moneda font-bold text-sm text-texto shrink-0">
                      {formatCOP(v.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagos a proveedores del día */}
          {pagosProveedores && pagosProveedores.length > 0 && (
            <div className="bg-white rounded-xl border border-borde overflow-hidden">
              <div className="px-4 py-3 border-b border-borde/50 flex items-center gap-2">
                <Truck size={16} className="text-acento" />
                <span className="text-sm font-semibold text-texto flex-1">
                  Pagos a proveedores
                </span>
                <span className="moneda text-xs text-peligro font-medium">
                  -{formatCOP(pagosProveedores.reduce((s, p) => s + p.pago.monto, 0))}
                </span>
              </div>
              <div className="divide-y divide-borde/30">
                {pagosProveedores.map((p) => (
                  <div key={p.pago.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-acento/10 flex items-center justify-center shrink-0">
                      <Truck size={14} className="text-acento" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-texto truncate">
                        {p.nombreProveedor}
                      </p>
                      <p className="text-xs text-suave">
                        {p.pago.creadoEn.toLocaleTimeString('es-CO', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                        {p.pago.notas ? ` · ${p.pago.notas}` : ''}
                      </p>
                    </div>
                    <span className="moneda font-bold text-sm text-peligro shrink-0">
                      -{formatCOP(p.pago.monto)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gastos */}
          <div className="bg-white rounded-xl border border-borde overflow-hidden">
            <button
              type="button"
              onClick={() => setGastosAbierto((v) => !v)}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-fondo transition-colors"
            >
              <TrendingDown size={16} className="text-peligro" />
              <span className="text-sm font-semibold text-texto flex-1 text-left">
                Registrar gasto
              </span>
              {resumen && resumen.totalGastos > 0 && (
                <span className="moneda text-xs text-peligro font-medium">
                  -{formatCOP(resumen.totalGastos)}
                </span>
              )}
              <ChevronDown
                size={16}
                className={`text-suave transition-transform ${gastosAbierto ? 'rotate-180' : ''}`}
              />
            </button>

            {gastosAbierto && (
              <div className="border-t border-borde/50 p-4 flex flex-col gap-3">
                {/* Tipo de gasto */}
                <div className="grid grid-cols-4 gap-2">
                  {TIPOS_GASTO.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setGastoTipo(t.value)}
                      className={[
                        'flex flex-col items-center gap-0.5 h-14 rounded-xl border text-xs font-medium transition-all',
                        gastoTipo === t.value
                          ? 'bg-peligro/10 text-peligro border-peligro/40'
                          : 'bg-white text-suave border-borde hover:border-gray-300',
                      ].join(' ')}
                    >
                      <span className="text-base">{t.emoji}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>

                {/* Descripción */}
                <input
                  type="text"
                  value={gastoDesc}
                  onChange={(e) => setGastoDesc(e.target.value)}
                  placeholder="Descripción del gasto…"
                  className="w-full h-11 px-3 border border-borde rounded-xl text-sm text-texto
                             focus:outline-none focus:ring-2 focus:ring-peligro/30 focus:border-peligro/50"
                />

                {/* Monto */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suave text-sm font-medium">$</span>
                  <input
                    type="number"
                    value={gastoMonto}
                    onChange={(e) => setGastoMonto(e.target.value)}
                    placeholder="0"
                    min={0}
                    className="w-full h-11 pl-7 pr-3 border border-borde rounded-xl text-sm text-texto moneda
                               focus:outline-none focus:ring-2 focus:ring-peligro/30 focus:border-peligro/50"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleRegistrarGasto}
                  disabled={!gastoDesc.trim() || !gastoMonto || guardandoGasto}
                  className="h-11 bg-peligro/10 text-peligro border border-peligro/30 rounded-xl
                             font-semibold text-sm flex items-center justify-center gap-2
                             hover:bg-peligro/20 transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={16} />
                  {guardandoGasto ? 'Guardando…' : 'Registrar gasto'}
                </button>

                {/* Lista de gastos del día */}
                {resumen && resumen.gastos.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1 border-t border-borde/50 pt-3">
                    <p className="text-xs text-suave font-medium mb-0.5">Gastos registrados hoy</p>
                    {resumen.gastos.map((g) => (
                      <div key={g.id} className="flex items-center justify-between text-sm">
                        <span className="text-texto truncate flex-1">{g.descripcion}</span>
                        <span className="moneda text-peligro font-medium shrink-0 ml-2">
                          -{formatCOP(g.monto)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Espacio para el botón de cierre */}
          <div className="h-24" />
        </div>
      </div>

      {/* Botón cerrar caja */}
      <button
        type="button"
        onClick={() => setMostrarCierre(true)}
        className="fixed bottom-6 right-6 h-14 px-6 bg-peligro text-white
                   rounded-full shadow-xl flex items-center justify-center gap-2
                   hover:opacity-90 active:scale-95 transition-all z-20
                   shadow-peligro/30 font-display font-bold"
      >
        <Lock size={18} />
        Cerrar caja
      </button>

      {mostrarCierre && sesion.id !== undefined && (
        <CerrarCaja
          sesionId={sesion.id}
          onClose={() => setMostrarCierre(false)}
        />
      )}
    </div>
  )
}

// ─── Componente auxiliar ──────────────────────────────────────────────────────

function FilaDesglose({
  icon,
  label,
  valor,
  color,
  negativo = false,
  siempre = false,
}: {
  icon: React.ReactNode
  label: string
  valor: number
  color: string
  negativo?: boolean
  siempre?: boolean   // true = mostrar aunque valor sea 0
}) {
  if (valor === 0 && !siempre) return null
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className={`${valor === 0 ? 'text-suave/40' : color} shrink-0`}>{icon}</span>
      <span className={`text-sm flex-1 ${valor === 0 ? 'text-suave/50' : 'text-suave'}`}>{label}</span>
      <span className={`moneda font-medium text-sm ${valor === 0 ? 'text-suave/40' : color}`}>
        {negativo && valor > 0 ? '-' : ''}{formatCOP(valor)}
      </span>
    </div>
  )
}
