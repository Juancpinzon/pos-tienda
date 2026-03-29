import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { ShoppingCart, BookOpen, Package, DollarSign, BarChart2, AlertCircle, Settings, Truck, Archive } from 'lucide-react'
import { useSeed } from './hooks/useSeed'
import { useSesionActual, useResumenCaja } from './hooks/useCaja'
import { useConfig } from './hooks/useConfig'
import { useProductosBajoStock } from './hooks/useStock'
import { useOnboarding } from './hooks/useOnboarding'
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
import { formatCOP } from './utils/moneda'

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

// ─── Header con totales del día ───────────────────────────────────────────────

function HeaderDia({ onAbrirConfig }: { onAbrirConfig: () => void }) {
  const sesion = useSesionActual()
  const resumen = useResumenCaja(sesion?.id)
  const config = useConfig()
  const sinCaja = sesion === null

  const nombreTienda = config?.nombreTienda ?? 'POS Tienda'

  return (
    <header className="h-11 bg-primario flex items-center justify-between px-3 shrink-0">
      <button
        type="button"
        onClick={onAbrirConfig}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        title="Configuración de la tienda"
      >
        <span className="text-white text-base leading-none">🏪</span>
        <span className="text-white font-display font-bold text-sm truncate max-w-[120px] sm:max-w-none">
          {nombreTienda}
        </span>
      </button>

      <div className="flex items-center gap-2">
        {sinCaja && (
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
        <button
          type="button"
          onClick={onAbrirConfig}
          className="w-8 h-8 flex items-center justify-center rounded-lg
                     text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Configuración"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  )
}

// ─── App principal ────────────────────────────────────────────────────────────

export default function App() {
  const { estado, error, primerUso } = useSeed()

  if (estado === 'verificando' || estado === 'cargando') {
    const mensaje = estado === 'cargando'
      ? 'Cargando productos por primera vez…'
      : 'Iniciando base de datos…'
    return <PantallaCarga mensaje={mensaje} />
  }

  if (estado === 'error') {
    return <PantallaError error={error ?? 'Error desconocido'} />
  }

  return (
    <BrowserRouter>
      <AppLayout primerUso={primerUso} />
    </BrowserRouter>
  )
}

// Separado para que los hooks reactivos tengan acceso al BrowserRouter
function AppLayout({ primerUso }: { primerUso: boolean }) {
  const sesion = useSesionActual()
  const sinCaja = sesion === null
  // Abrir config en primer uso para que el tendero configure el nombre de la tienda
  const [mostrarConfig, setMostrarConfig] = useState(primerUso)

  // Badge rojo en Productos/Stock cuando hay productos bajo mínimo
  const bajoStock = useProductosBajoStock()
  const hayBajoStock = (bajoStock?.length ?? 0) > 0

  // Tour de onboarding — fuente de verdad única en este componente
  const tour = useOnboarding()
  const mostrarTour = tour.tourCompletado === false

  const navItems = [
    { to: '/',            icon: ShoppingCart, label: 'POS',        badge: false,        tourId: undefined     },
    { to: '/fiados',      icon: BookOpen,     label: 'Fiados',     badge: false,        tourId: 'nav-fiados'  },
    { to: '/productos',   icon: Package,      label: 'Productos',  badge: hayBajoStock, tourId: undefined     },
    { to: '/inventario',  icon: Archive,      label: 'Stock',      badge: hayBajoStock, tourId: undefined     },
    { to: '/proveedores', icon: Truck,        label: 'Proveed.',   badge: false,        tourId: undefined     },
    { to: '/caja',        icon: DollarSign,   label: 'Caja',       badge: sinCaja,      tourId: 'nav-caja'    },
    { to: '/reportes',    icon: BarChart2,    label: 'Reportes',   badge: false,        tourId: undefined     },
  ]

  return (
    <div className="flex flex-col h-screen bg-fondo overflow-hidden">
      {/* Header superior */}
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
        </nav>

        {/* Contenido principal */}
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/"            element={<POSPage />}         />
            <Route path="/fiados"      element={<FiadosPage />}      />
            <Route path="/productos"   element={<ProductosPage />}   />
            <Route path="/inventario"  element={<InventarioPage />}  />
            <Route path="/proveedores" element={<ProveedoresPage />} />
            <Route path="/caja"        element={<CajaPage />}        />
            <Route path="/reportes"    element={<ReportesPage />}    />
          </Routes>
        </main>
      </div>

      {/* Modal de configuración */}
      {mostrarConfig && (
        <ConfigModal
          onClose={() => setMostrarConfig(false)}
          onReiniciarTour={tour.reiniciarTour}
        />
      )}

      {/* Tour de onboarding — solo visible la primera vez (tourCompletado === false) */}
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

      {/* Banner de instalación PWA */}
      <BannerInstalacion />
    </div>
  )
}
