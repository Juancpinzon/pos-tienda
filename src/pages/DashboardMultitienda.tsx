// Dashboard Multi-tienda
// Solo visible para dueños con Supabase configurado + 2+ tiendas.
// Todos los datos se consultan directamente de Supabase — no usa IndexedDB local.

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Store, TrendingUp, ShoppingBag, BookOpen,
  AlertCircle, CheckCircle2, Plus, RefreshCw,
  ArrowRightLeft, Clock,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { supabaseConfigurado } from '../lib/supabase'
import {
  cargarResumenTienda,
  crearTiendaNueva,
  cambiarTiendaActiva,
  type ResumenTienda,
} from '../hooks/useTiendasDueno'
import { formatCOP } from '../utils/moneda'

// ─── Tarjeta por tienda ───────────────────────────────────────────────────────

function TarjetaTienda({
  tienda,
  onCambiar,
}: {
  tienda: ResumenTienda
  onCambiar: (t: ResumenTienda) => void
}) {
  const hayAlertas = !tienda.cajaAbierta || tienda.clientesMora > 0

  return (
    <div className={[
      'bg-white rounded-2xl border overflow-hidden transition-shadow',
      tienda.esActiva ? 'border-primario shadow-md shadow-primario/10' : 'border-borde',
    ].join(' ')}>

      {/* Header de la tarjeta */}
      <div className={[
        'px-4 py-3 flex items-center gap-3',
        tienda.esActiva ? 'bg-primario/5 border-b border-primario/15' : 'border-b border-borde/50',
      ].join(' ')}>
        <div className={[
          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
          tienda.esActiva ? 'bg-primario text-white' : 'bg-gray-100 text-suave',
        ].join(' ')}>
          <Store size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-texto truncate">{tienda.nombre}</p>
          {tienda.esActiva && (
            <p className="text-[10px] font-bold text-primario uppercase tracking-wide">
              Tienda activa
            </p>
          )}
        </div>
        {/* Badge de alertas */}
        {hayAlertas && !tienda.cargando && (
          <AlertCircle size={16} className="text-advertencia shrink-0" />
        )}
        {!hayAlertas && !tienda.cargando && tienda.cantidadVentasHoy > 0 && (
          <CheckCircle2 size={16} className="text-exito shrink-0" />
        )}
      </div>

      {/* Contenido */}
      {tienda.cargando ? (
        <div className="p-6 flex justify-center">
          <div className="w-5 h-5 border-2 border-primario/30 border-t-primario rounded-full animate-spin" />
        </div>
      ) : tienda.error ? (
        <div className="p-4 text-sm text-peligro text-center">{tienda.error}</div>
      ) : (
        <>
          {/* Métricas de hoy */}
          <div className="grid grid-cols-3 divide-x divide-borde/40 border-b border-borde/40">
            <div className="px-3 py-3 flex flex-col gap-0.5">
              <p className="text-[10px] text-suave">Ventas hoy</p>
              <p className="moneda font-bold text-sm text-primario leading-tight">
                {formatCOP(tienda.ventasHoy)}
              </p>
              <p className="text-[10px] text-suave">{tienda.cantidadVentasHoy} vta{tienda.cantidadVentasHoy !== 1 ? 's' : ''}</p>
            </div>
            <div className="px-3 py-3 flex flex-col gap-0.5">
              <p className="text-[10px] text-suave">Fiado hoy</p>
              <p className={`moneda font-bold text-sm leading-tight ${tienda.fiadoHoy > 0 ? 'text-fiado' : 'text-suave/40'}`}>
                {formatCOP(tienda.fiadoHoy)}
              </p>
            </div>
            <div className="px-3 py-3 flex flex-col gap-0.5">
              <p className="text-[10px] text-suave">Caja</p>
              <div className={[
                'flex items-center gap-1 text-xs font-semibold mt-0.5',
                tienda.cajaAbierta ? 'text-exito' : 'text-advertencia',
              ].join(' ')}>
                <span className={[
                  'w-1.5 h-1.5 rounded-full',
                  tienda.cajaAbierta ? 'bg-exito' : 'bg-advertencia animate-pulse',
                ].join(' ')} />
                {tienda.cajaAbierta ? 'Abierta' : 'Sin abrir'}
              </div>
            </div>
          </div>

          {/* Alertas */}
          <div className="px-4 py-2.5 flex flex-wrap gap-2">
            {!tienda.cajaAbierta && (
              <span className="flex items-center gap-1 text-[11px] bg-advertencia/10 text-advertencia px-2 py-0.5 rounded-full font-medium">
                <AlertCircle size={10} />
                Caja sin abrir
              </span>
            )}
            {tienda.clientesMora > 0 && (
              <span className="flex items-center gap-1 text-[11px] bg-peligro/10 text-peligro px-2 py-0.5 rounded-full font-medium">
                <Clock size={10} />
                {tienda.clientesMora} cliente{tienda.clientesMora !== 1 ? 's' : ''} con mora +30 días
              </span>
            )}
            {!hayAlertas && (
              <span className="text-[11px] text-suave/60">Sin alertas</span>
            )}
          </div>

          {/* Acciones */}
          {!tienda.esActiva && (
            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={() => onCambiar(tienda)}
                className="w-full h-9 bg-primario/10 text-primario border border-primario/25
                           rounded-xl text-sm font-semibold flex items-center justify-center gap-2
                           hover:bg-primario/15 active:scale-95 transition-all"
              >
                <ArrowRightLeft size={14} />
                Cambiar a esta tienda
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Modal: crear tienda nueva ────────────────────────────────────────────────

function ModalNuevaTienda({
  onCrear,
  onCerrar,
}: {
  onCrear: (nombre: string) => Promise<void>
  onCerrar: () => void
}) {
  const [nombre,   setNombre]   = useState('')
  const [cargando, setCargando] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return
    setCargando(true)
    setError(null)
    try {
      await onCrear(nombre.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la tienda')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primario/10 rounded-xl flex items-center justify-center">
            <Plus size={20} className="text-primario" />
          </div>
          <div>
            <p className="font-display font-bold text-lg text-texto">Nueva tienda</p>
            <p className="text-xs text-suave">Se vincula a su misma cuenta</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Tienda Norte, Sucursal Centro…"
            maxLength={60}
            required
            autoFocus
            className="w-full h-12 px-4 border border-borde rounded-xl text-sm text-texto
                       focus:outline-none focus:ring-2 focus:ring-primario/40 focus:border-primario"
          />

          {error && (
            <p className="text-xs text-peligro bg-peligro/8 border border-peligro/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 h-11 border border-borde text-suave rounded-xl text-sm font-semibold
                         hover:bg-gray-50 active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando || !nombre.trim()}
              className="flex-1 h-11 bg-primario text-white rounded-xl text-sm font-display font-bold
                         hover:bg-primario-hover active:scale-95 transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {cargando
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Plus size={16} />}
              {cargando ? 'Creando…' : 'Crear tienda'}
            </button>
          </div>
        </form>

        <p className="text-[11px] text-suave/70 text-center leading-relaxed">
          El catálogo de 400 productos se carga automáticamente cuando cambie a esta tienda.
        </p>
      </div>
    </div>
  )
}

// ─── Modal: confirmar cambio de tienda ────────────────────────────────────────

function ModalConfirmarCambio({
  tienda,
  onConfirmar,
  onCancelar,
}: {
  tienda: ResumenTienda
  onConfirmar: () => Promise<void>
  onCancelar: () => void
}) {
  const [cargando, setCargando] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleConfirmar = async () => {
    setCargando(true)
    setError(null)
    try {
      await onConfirmar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar')
      setCargando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-14 h-14 bg-primario/10 rounded-2xl flex items-center justify-center">
            <ArrowRightLeft size={28} className="text-primario" />
          </div>
          <p className="font-display font-bold text-lg text-texto">Cambiar a {tienda.nombre}</p>
          <p className="text-sm text-suave leading-relaxed">
            Los datos locales del dispositivo se reemplazarán con los de esta tienda.
            Asegúrese de tener internet para sincronizar.
          </p>
        </div>

        {error && (
          <p className="text-xs text-peligro bg-peligro/8 border border-peligro/20 rounded-xl px-3 py-2 text-center">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={cargando}
            className="flex-1 h-11 border border-borde text-suave rounded-xl text-sm font-semibold
                       hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={cargando}
            className="flex-1 h-11 bg-primario text-white rounded-xl text-sm font-display font-bold
                       hover:bg-primario-hover active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {cargando
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <ArrowRightLeft size={16} />}
            {cargando ? 'Cambiando…' : 'Sí, cambiar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DashboardMultitienda() {
  const navigate           = useNavigate()
  const usuario            = useAuthStore((s) => s.usuario)
  const todasLasTiendas    = useAuthStore((s) => s.todasLasTiendas)
  const setTodasLasTiendas = useAuthStore((s) => s.setTodasLasTiendas)

  const [resumenes, setResumenes]   = useState<ResumenTienda[]>([])
  const [recargando, setRecargando] = useState(false)

  const [modalNueva,    setModalNueva]    = useState(false)
  const [tiendaCambio,  setTiendaCambio]  = useState<ResumenTienda | null>(null)

  // Redirigir si no es dueño o sin Supabase
  useEffect(() => {
    if (usuario?.rol !== 'dueno' || !supabaseConfigurado) {
      navigate('/', { replace: true })
    }
  }, [usuario, navigate])

  // Inicializar skeleton a partir de todasLasTiendas
  useEffect(() => {
    if (todasLasTiendas.length === 0) return
    setResumenes(
      todasLasTiendas.map((t) => ({
        id:                t.id,
        nombre:            t.nombre,
        esActiva:          t.id === usuario?.tiendaId,
        ventasHoy:         0,
        cantidadVentasHoy: 0,
        fiadoHoy:          0,
        cajaAbierta:       false,
        clientesMora:      0,
        cargando:          true,
        error:             null,
      }))
    )
  }, [todasLasTiendas, usuario?.tiendaId])

  // Cargar resúmenes en paralelo
  const cargarResumenes = useCallback(async () => {
    if (!usuario || todasLasTiendas.length === 0) return
    setRecargando(true)

    await Promise.all(
      todasLasTiendas.map(async (tienda) => {
        try {
          const resumen = await cargarResumenTienda(tienda.id)
          setResumenes((prev) =>
            prev.map((r) =>
              r.id === tienda.id
                ? { ...r, ...resumen, cargando: false, error: null }
                : r
            )
          )
        } catch (err) {
          setResumenes((prev) =>
            prev.map((r) =>
              r.id === tienda.id
                ? { ...r, cargando: false, error: err instanceof Error ? err.message : 'Error' }
                : r
            )
          )
        }
      })
    )

    setRecargando(false)
  }, [usuario, todasLasTiendas])

  useEffect(() => { void cargarResumenes() }, [cargarResumenes])

  // ── Crear nueva tienda ─────────────────────────────────────────────────────

  const handleCrearTienda = async (nombre: string) => {
    if (!usuario) return
    const nueva = await crearTiendaNueva(nombre, usuario.id)
    const nuevaLista = [...todasLasTiendas, nueva]
    setTodasLasTiendas(nuevaLista)
    setResumenes((prev) => [
      ...prev,
      {
        id: nueva.id, nombre: nueva.nombre, esActiva: false,
        ventasHoy: 0, cantidadVentasHoy: 0, fiadoHoy: 0,
        cajaAbierta: false, clientesMora: 0, cargando: false, error: null,
      },
    ])
    setModalNueva(false)
  }

  // ── Totales consolidados ───────────────────────────────────────────────────

  const cargandoAlguna  = resumenes.some((r) => r.cargando)
  const totalVentas     = resumenes.reduce((s, r) => s + r.ventasHoy,   0)
  const totalFiado      = resumenes.reduce((s, r) => s + r.fiadoHoy,    0)
  const totalTransacciones = resumenes.reduce((s, r) => s + r.cantidadVentasHoy, 0)
  const alertasCaja     = resumenes.filter((r) => !r.cargando && !r.cajaAbierta && r.cantidadVentasHoy === 0)
  const alertasMora     = resumenes.reduce((s, r) => s + r.clientesMora, 0)

  if (!supabaseConfigurado || usuario?.rol !== 'dueno') return null

  return (
    <div className="h-full flex flex-col bg-fondo overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">

          {/* Sin tiendas suficientes */}
          {todasLasTiendas.length < 2 && !cargandoAlguna && (
            <div className="bg-white rounded-2xl border border-borde p-6 flex flex-col items-center gap-3 text-center">
              <span className="text-4xl">🏪</span>
              <p className="font-display font-bold text-lg text-texto">¿Tiene más de una tienda?</p>
              <p className="text-sm text-suave leading-relaxed max-w-xs">
                Cree una segunda tienda para ver el resumen consolidado de todas sus sucursales aquí.
              </p>
              <button
                type="button"
                onClick={() => setModalNueva(true)}
                className="h-11 px-5 bg-primario text-white rounded-xl font-semibold text-sm
                           flex items-center gap-2 hover:bg-primario-hover active:scale-95 transition-all"
              >
                <Plus size={16} />
                Agregar tienda nueva
              </button>
            </div>
          )}

          {/* ── Resumen consolidado ── */}
          {todasLasTiendas.length >= 2 && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-base text-texto">
                  Resumen de todas mis tiendas — Hoy
                </h2>
                <button
                  type="button"
                  onClick={cargarResumenes}
                  disabled={recargando}
                  title="Actualizar datos"
                  className="w-8 h-8 flex items-center justify-center rounded-lg
                             text-suave hover:text-texto hover:bg-white transition-colors"
                >
                  <RefreshCw size={15} className={recargando ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Tarjetas de totales */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border border-borde p-4 flex flex-col gap-1">
                  <div className="w-8 h-8 bg-primario/10 text-primario rounded-lg flex items-center justify-center mb-1">
                    <TrendingUp size={16} />
                  </div>
                  <p className="text-xs text-suave">Total vendido</p>
                  <p className="moneda font-bold text-xl text-primario leading-tight">
                    {cargandoAlguna
                      ? <span className="inline-block w-20 h-5 bg-gray-100 rounded animate-pulse" />
                      : formatCOP(totalVentas)}
                  </p>
                  <p className="text-xs text-suave">{totalTransacciones} ventas en {todasLasTiendas.length} tiendas</p>
                </div>
                <div className="bg-white rounded-xl border border-borde p-4 flex flex-col gap-1">
                  <div className="w-8 h-8 bg-fiado/10 text-fiado rounded-lg flex items-center justify-center mb-1">
                    <BookOpen size={16} />
                  </div>
                  <p className="text-xs text-suave">Fiado total hoy</p>
                  <p className={`moneda font-bold text-xl leading-tight ${totalFiado > 0 ? 'text-fiado' : 'text-suave/50'}`}>
                    {cargandoAlguna
                      ? <span className="inline-block w-16 h-5 bg-gray-100 rounded animate-pulse" />
                      : formatCOP(totalFiado)}
                  </p>
                  {alertasMora > 0 && (
                    <p className="text-xs text-peligro font-medium">{alertasMora} clientes con mora</p>
                  )}
                </div>
              </div>

              {/* Alertas globales */}
              {alertasCaja.length > 0 && (
                <div className="flex items-start gap-2 bg-advertencia/10 border border-advertencia/30
                                rounded-xl px-3 py-2.5 text-sm text-advertencia/90">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <p className="font-medium">
                    {alertasCaja.map((t) => t.nombre).join(', ')}:{' '}
                    caja{alertasCaja.length > 1 ? 's' : ''} sin abrir
                  </p>
                </div>
              )}

              {/* ── Por tienda ── */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-suave uppercase tracking-wider">
                  Por tienda ({todasLasTiendas.length})
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {resumenes.map((tienda) => (
                  <TarjetaTienda
                    key={tienda.id}
                    tienda={tienda}
                    onCambiar={setTiendaCambio}
                  />
                ))}
              </div>

              {/* Agregar tienda */}
              <button
                type="button"
                onClick={() => setModalNueva(true)}
                className="w-full h-12 border-2 border-dashed border-borde rounded-2xl
                           text-sm font-semibold text-suave
                           flex items-center justify-center gap-2
                           hover:border-primario/40 hover:text-primario hover:bg-primario/3
                           active:scale-95 transition-all"
              >
                <Plus size={16} />
                Agregar tienda nueva
              </button>
            </>
          )}

          <div className="h-8" />
        </div>
      </div>

      {/* Modales */}
      {modalNueva && (
        <ModalNuevaTienda
          onCrear={handleCrearTienda}
          onCerrar={() => setModalNueva(false)}
        />
      )}

      {tiendaCambio && (
        <ModalConfirmarCambio
          tienda={tiendaCambio}
          onConfirmar={() => cambiarTiendaActiva(tiendaCambio)}
          onCancelar={() => setTiendaCambio(null)}
        />
      )}
    </div>
  )
}
