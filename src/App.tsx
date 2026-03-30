import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { ShoppingCart, BookOpen, Package, DollarSign, BarChart2, AlertCircle, Settings, Truck, Archive, LogOut, RefreshCw } from 'lucide-react'
import { useSeed } from './hooks/useSeed'
import { useSesionActual, useResumenCaja } from './hooks/useCaja'
import { useConfig } from './hooks/useConfig'
import { useProductosBajoStock } from './hooks/useStock'
import { useOnboarding } from './hooks/useOnboarding'
import { useSyncStatus } from './hooks/useSyncStatus'
import { TourOverlay } from './components/onboarding/TourOverlay'
import { ConfigModal } from './components/config/ConfigModal'
import { BannerInstalacion } from './components/shared/BannerInstalacion'
import POSPage from './pages/POSPage'
import FiadosPage from './pages/FiadosPage'
import ProductosPage from './pages/ProductosPage'
import CajaPage from './pages/CajaPage'
import ReportesPage from './pages/ReportesPage'
import ProveedoresPage from './pages/ProveedoresPage'
import InventarioPage from './pages/InventarioPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import { formatCOP } from './utils/moneda'
import { useAuthStore, puedeAcceder } from './stores/authStore'
import { supabase, supabaseConfigurado } from './lib/supabase'
import { startAutoSync, stopAutoSync, pullFromSupabase } from './lib/sync'

// ─── Pantallas de carga / error ───────────────────────────────────────────────

function PantallaCarga({ mensaje }: { mensaje: string }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-fondo gap-4">
      <div className="text-6xl">🏪</div>
      <p className="text-primario font-display font-bold text-xl">POS Tienda</p>
      <p className="text-suave text-sm">{mensaje}</p>
      <div className="w-8 h-8 border-4 border-primario border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function PantallaError({ error }: { error: string }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-fondo gap-4 p-8">
      <div className="text-6xl">⚠️</div>
      <p className="font-display font-bold text-xl text-peligro">Error al inicializar</p>
      <p className="text-suave text-sm text-center max-w-sm">{error}</p>
      <button className="btn-primario" onClick={() => window.location.reload()}>
        Reintentar
      </button>
    </div>
  )
}

// ─── Indicador de sincronización ─────────────────────────────────────────────

function IndicadorSync() {
  const sync = useSyncStatus()

  if (sync.estado === 'desactivado') return null

  const config = {
    sincronizado: { dot: 'bg-exito',      label: 'Sincronizado'  },
    pendiente:    { dot: 'bg-advertencia', label: 'Sincronizando' },
    sin_internet: { dot: 'bg-peligro',     label: 'Sin internet'  },
    desactivado:  { dot: 'bg-suave',       label: ''              },
  }[sync.estado]

  return (
    <div className="flex items-center gap-1.5" title={config.label}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${config.dot} ${sync.estado === 'pendiente' ? 'animate-pulse' : ''}`} />
      <span className="text-white/50 text-xs hidden lg:inline">{config.label}</span>
    </div>
  )
}

// ─── Header con totales del día ───────────────────────────────────────────────

function HeaderDia({ onAbrirConfig }: { onAbrirConfig: () => void }) {
  const sesion       = useSesionActual()
  const resumen      = useResumenCaja(sesion?.id)
  const config       = useConfig()
  const usuario      = useAuthStore((s) => s.usuario)
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion)
  const sinCaja      = sesion === null
  const esDueno      = !usuario || usuario.rol === 'dueno'

  const nombreTienda = config?.nombreTienda ?? usuario?.nombreTienda ?? 'POS Tienda'

  const handleCerrarSesion = async () => {
    await supabase.auth.signOut()
    cerrarSesion()
  }

  return (
    <header className="h-11 bg-primario flex items-center justify-between px-3 shrink-0">
      {/* Nombre tienda — solo dueño puede abrir config */}
      {esDueno ? (
        <button
          type="button"
          onClick={onAbrirConfig}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          title="Configuración de la tienda"
        >
          <span className="text-white text-base leading-none">🏪</span>
          <span className="text-white font-display font-bold text-sm truncate max-w-[100px] sm:max-w-none">
            {nombreTienda}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-white text-base leading-none">🏪</span>
          <span className="text-white font-display font-bold text-sm truncate max-w-[100px] sm:max-w-none">
            {nombreTienda}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Badge de rol — más visible */}
        {usuario && (
          <span className={[
            'text-xs font-bold px-2 py-0.5 rounded-md',
            usuario.rol === 'dueno'
              ? 'bg-acento/25 text-acento'
              : 'bg-sky-400/20 text-sky-300',
          ].join(' ')}>
            {usuario.rol === 'dueno' ? '👑 Dueño' : '👤 Empleado'}
          </span>
        )}

        {/* Estado de caja (solo dueño ve la alerta) */}
        {esDueno && sinCaja && (
          <div className="flex items-center gap-1 text-yellow-300 text-xs font-medium">
            <AlertCircle size={13} />
            <span className="hidden sm:inline">Caja sin abrir</span>
          </div>
        )}
        {!sinCaja && resumen && (
          <div className="flex items-center gap-1.5">
            <span className="text-white/60 text-xs">Hoy:</span>
            <span className="moneda text-white font-bold text-sm">{formatCOP(resumen.totalVentas)}</span>
            <span className="text-white/50 text-xs hidden sm:inline">
              · {resumen.cantidadVentas} venta{resumen.cantidadVentas !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Indicador de sync */}
        <IndicadorSync />

        {/* Config — solo dueño */}
        {esDueno && (
          <button
            type="button"
            onClick={onAbrirConfig}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Configuración"
          >
            <Settings size={16} />
          </button>
        )}

        {/* Cerrar sesión (solo si Supabase configurado) */}
        {supabaseConfigurado && usuario && (
          <button
            type="button"
            onClick={handleCerrarSesion}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title={`Cerrar sesión (${usuario.nombre})`}
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    </header>
  )
}

// ─── Guard de ruta por rol ────────────────────────────────────────────────────

function RutaProtegida({ children }: { children: React.ReactNode }) {
  const usuario = useAuthStore((s) => s.usuario)
  const location = useLocation()

  if (!usuario) return null

  if (!puedeAcceder(usuario.rol, location.pathname)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// ─── App principal ────────────────────────────────────────────────────────────

export default function App() {
  const { estado, error, primerUso } = useSeed()
  const usuario    = useAuthStore((s) => s.usuario)
  const isLoading  = useAuthStore((s) => s.isLoading)
  const setUsuario = useAuthStore((s) => s.setUsuario)
  const setIsLoading = useAuthStore((s) => s.setIsLoading)

  const [vistaAuth, setVistaAuth] = useState<'login' | 'registro'>('login')

  // Verificar sesión activa de Supabase al montar
  useEffect(() => {
    if (!supabaseConfigurado) {
      setIsLoading(false)
      return
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setIsLoading(false)
        return
      }

      // Hay sesión activa → cargar perfil
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('id, tienda_id, email, nombre, rol, tiendas(nombre)')
        .eq('id', session.user.id)
        .single()

      if (perfil) {
        setUsuario({
          id:           perfil.id,
          email:        perfil.email,
          nombre:       perfil.nombre,
          rol:          perfil.rol as 'dueno' | 'empleado',
          tiendaId:     perfil.tienda_id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nombreTienda: (perfil.tiendas as any)?.nombre ?? 'Mi Tienda',
        })
      } else {
        setIsLoading(false)
      }
    })
  }, [setUsuario, setIsLoading])

  // Iniciar/parar auto-sync según usuario
  useEffect(() => {
    if (usuario?.tiendaId) {
      startAutoSync(usuario.tiendaId)
    }
    return () => stopAutoSync()
  }, [usuario?.tiendaId])

  // ── Carga de DB local
  if (estado === 'verificando' || estado === 'cargando') {
    const mensaje = estado === 'cargando'
      ? 'Cargando productos por primera vez…'
      : 'Iniciando base de datos…'
    return <PantallaCarga mensaje={mensaje} />
  }

  if (estado === 'error') {
    return <PantallaError error={error ?? 'Error desconocido'} />
  }

  // ── Auth gate (solo si Supabase está configurado)
  if (supabaseConfigurado) {
    if (isLoading) return <PantallaCarga mensaje="Verificando sesión…" />

    if (!usuario) {
      return vistaAuth === 'login'
        ? <LoginPage    onIrARegistro={() => setVistaAuth('registro')} />
        : <RegisterPage onIrALogin={()   => setVistaAuth('login')}    />
    }
  }

  return (
    <BrowserRouter>
      <AppLayout primerUso={primerUso} />
    </BrowserRouter>
  )
}

// Separado para que los hooks reactivos tengan acceso al BrowserRouter
function AppLayout({ primerUso }: { primerUso: boolean }) {
  const sesion  = useSesionActual()
  const usuario = useAuthStore((s) => s.usuario)
  const sinCaja = sesion === null
  const [mostrarConfig, setMostrarConfig] = useState(primerUso)

  const bajoStock    = useProductosBajoStock()
  const hayBajoStock = (bajoStock?.length ?? 0) > 0
  const tour         = useOnboarding()
  const mostrarTour  = tour.tourCompletado === false

  const rol = usuario?.rol ?? 'dueno'

  // Pull manual al hacer clic en el indicador de sync
  const [sincronizando, setSincronizando] = useState(false)
  const handlePullManual = async () => {
    if (!usuario?.tiendaId || sincronizando) return
    setSincronizando(true)
    await pullFromSupabase(usuario.tiendaId)
    setSincronizando(false)
  }

  // Items de navegación filtrados según el rol
  const navItemsTodos = [
    { to: '/',            icon: ShoppingCart, label: 'POS',       badge: false,        tourId: undefined,    roles: ['dueno', 'empleado'] },
    { to: '/fiados',      icon: BookOpen,     label: 'Fiados',    badge: false,        tourId: 'nav-fiados', roles: ['dueno', 'empleado'] },
    { to: '/productos',   icon: Package,      label: 'Productos', badge: hayBajoStock, tourId: undefined,    roles: ['dueno']             },
    { to: '/inventario',  icon: Archive,      label: 'Stock',     badge: hayBajoStock, tourId: undefined,    roles: ['dueno']             },
    { to: '/proveedores', icon: Truck,        label: 'Proveed.',  badge: false,        tourId: undefined,    roles: ['dueno']             },
    { to: '/caja',        icon: DollarSign,   label: 'Caja',      badge: sinCaja,      tourId: 'nav-caja',   roles: ['dueno']             },
    { to: '/reportes',    icon: BarChart2,    label: 'Reportes',  badge: false,        tourId: undefined,    roles: ['dueno']             },
  ]

  const navItems = navItemsTodos.filter((item) => item.roles.includes(rol))

  return (
    <div className="flex flex-col h-screen bg-fondo overflow-hidden">
      <HeaderDia onAbrirConfig={() => setMostrarConfig(true)} />

      <div className="flex flex-1 overflow-hidden">
        {/* Barra de navegación lateral */}
        <nav className="w-16 bg-primario flex flex-col items-center py-3 gap-1 shrink-0">
          {navItems.map(({ to, icon: Icon, label, badge, tourId }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              {...(tourId ? { 'data-tour': tourId } : {})}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center w-12 h-12 rounded-xl text-xs gap-1 transition-colors
                 ${isActive
                   ? 'bg-white/20 text-white'
                   : 'text-white/60 hover:text-white hover:bg-white/10'}`
              }
            >
              <Icon size={20} />
              <span className="text-[10px] leading-none">{label}</span>
              {badge && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              )}
            </NavLink>
          ))}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Botón de sync manual (solo con Supabase configurado) */}
          {supabaseConfigurado && usuario && (
            <button
              type="button"
              onClick={handlePullManual}
              disabled={sincronizando}
              title="Sincronizar datos"
              className="w-12 h-12 flex flex-col items-center justify-center rounded-xl gap-1
                         text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <RefreshCw size={16} className={sincronizando ? 'animate-spin' : ''} />
              <span className="text-[9px] leading-none">Sync</span>
            </button>
          )}
        </nav>

        {/* Contenido principal */}
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/"            element={<POSPage />}                                                          />
            <Route path="/fiados"      element={<FiadosPage />}                                                       />
            <Route path="/productos"   element={<RutaProtegida><ProductosPage /></RutaProtegida>}                     />
            <Route path="/inventario"  element={<RutaProtegida><InventarioPage /></RutaProtegida>}                    />
            <Route path="/proveedores" element={<RutaProtegida><ProveedoresPage /></RutaProtegida>}                   />
            <Route path="/caja"        element={<RutaProtegida><CajaPage /></RutaProtegida>}                          />
            <Route path="/reportes"    element={<RutaProtegida><ReportesPage /></RutaProtegida>}                      />
          </Routes>
        </main>
      </div>

      {mostrarConfig && (
        <ConfigModal
          onClose={() => setMostrarConfig(false)}
          onReiniciarTour={tour.reiniciarTour}
        />
      )}

      {mostrarTour && (
        <TourOverlay
          pasoActual={tour.pasoActual}
          totalPasos={tour.totalPasos}
          pasoInfo={tour.pasoInfo}
          siguientePaso={tour.siguientePaso}
          anteriorPaso={tour.anteriorPaso}
          saltarTour={tour.saltarTour}
          completarTour={tour.completarTour}
        />
      )}

      <BannerInstalacion />
    </div>
  )
}
