// TourOverlay.tsx — Overlay de onboarding con spotlight y tooltip
//
// Técnica del spotlight:
//   Un div transparente de posición fixed, alineado exactamente sobre el
//   elemento target, con `box-shadow: 0 0 0 9999px rgba(0,0,0,0.72)`.
//   La sombra cubre toda la pantalla excepto el área del div (que es transparente),
//   creando el efecto de "recorte iluminado" sin SVG ni canvas.
//
// Control de clicks:
//   La capa raíz (z-60) intercepta todos los clicks, impidiendo que el tendero
//   interactúe con la app durante el tour. El tooltip (z-62) recibe sus propios
//   eventos ya que tiene z-index mayor.

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, CheckCircle2 } from 'lucide-react'
import type { PasoTour, TourState } from '../../hooks/useOnboarding'

// ─── Constantes de layout ─────────────────────────────────────────────────────

const PADDING     = 10   // px extra alrededor del elemento resaltado
const TOOLTIP_W   = 288  // ancho fijo del tooltip (≈ max-w-xs)
const TOOLTIP_GAP = 14   // espacio entre el borde del spotlight y el tooltip
const EDGE_MARGIN = 12   // margen mínimo respecto al borde de la pantalla

// ─── SpotlightBox ─────────────────────────────────────────────────────────────

function SpotlightBox({ rect }: { rect: DOMRect }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position:     'fixed',
        top:          rect.top    - PADDING,
        left:         rect.left   - PADDING,
        width:        rect.width  + PADDING * 2,
        height:       rect.height + PADDING * 2,
        borderRadius: 14,
        // La sombra masiva crea la oscuridad — el div en sí es transparente
        boxShadow:    '0 0 0 9999px rgba(0, 0, 0, 0.72)',
        outline:      '2px solid rgba(255, 255, 255, 0.35)',
        outlineOffset: '0px',
        zIndex:       61,
        pointerEvents: 'none',
        transition:   'top 280ms ease, left 280ms ease, width 280ms ease, height 280ms ease',
      }}
    />
  )
}

// ─── Posicionamiento del tooltip ──────────────────────────────────────────────

function calcTooltipStyle(
  rect: DOMRect | null,
  paso: PasoTour,
): React.CSSProperties {
  // Sin target → centrado en pantalla
  if (!rect) {
    return {
      top:       '50%',
      left:      '50%',
      transform: 'translate(-50%, -50%)',
    }
  }

  const vw  = window.innerWidth
  const vh  = window.innerHeight
  const gap = PADDING + TOOLTIP_GAP

  // Coordenadas del spotlight (elemento resaltado + padding)
  const sTop    = rect.top    - PADDING
  const sLeft   = rect.left   - PADDING
  const sW      = rect.width  + PADDING * 2
  const sH      = rect.height + PADDING * 2
  const sRight  = sLeft + sW
  const sBottom = sTop  + sH

  // Clampea el left del tooltip para que no se salga de la pantalla
  const clampLeft = (l: number) =>
    Math.max(EDGE_MARGIN, Math.min(l, vw - TOOLTIP_W - EDGE_MARGIN))

  // Clampea el top para que el tooltip no quede cortado verticalmente
  const clampTop = (t: number) =>
    Math.max(EDGE_MARGIN, Math.min(t, vh - 240 - EDGE_MARGIN))

  switch (paso.posTooltip) {
    case 'abajo':
      return { top: sBottom + gap, left: clampLeft(sLeft) }

    case 'arriba':
      // bottom = distancia desde el borde inferior de la pantalla
      return { bottom: vh - sTop + gap, left: clampLeft(sLeft) }

    case 'derecha':
      // Para nav items laterales: tooltip a la derecha del spotlight
      return { top: clampTop(sTop), left: sRight + gap }

    case 'izquierda':
      // right = distancia desde el borde derecho de la pantalla
      // right = vw - (sLeft - gap) = vw - sLeft + gap
      return { top: clampTop(sTop), right: vw - sLeft + gap }

    default: {
      // Auto: abajo si hay espacio, si no arriba
      if (sBottom + 220 + gap < vh) {
        return { top: sBottom + gap, left: clampLeft(sLeft) }
      }
      return { bottom: vh - sTop + gap, left: clampLeft(sLeft) }
    }
  }
}

// ─── TooltipCard ──────────────────────────────────────────────────────────────

interface TooltipCardProps {
  paso:       PasoTour
  pasoActual: number
  totalPasos: number
  style:      React.CSSProperties
  onSiguiente: () => void
  onAnterior:  () => void
  onSaltar:    () => void
  esUltimo:    boolean
}

function TooltipCard({
  paso,
  pasoActual,
  totalPasos,
  style,
  onSiguiente,
  onAnterior,
  onSaltar,
  esUltimo,
}: TooltipCardProps) {
  return (
    <div
      className="fixed z-[62] bg-white rounded-2xl shadow-2xl flex flex-col gap-3 p-5"
      style={{ width: TOOLTIP_W, ...style }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Encabezado */}
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none shrink-0 mt-0.5">{paso.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-texto text-[15px] leading-snug">
            {paso.titulo}
          </p>
        </div>
        <button
          type="button"
          onClick={onSaltar}
          title="Saltar tour"
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full
                     text-suave hover:text-texto hover:bg-gray-100 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Descripción */}
      <p className="text-sm text-suave leading-relaxed">{paso.descripcion}</p>

      {/* Progreso + navegación */}
      <div className="flex items-center gap-2 pt-1">

        {/* Puntos de progreso */}
        <div className="flex items-center gap-1.5 flex-1">
          {Array.from({ length: totalPasos }).map((_, i) => (
            <div
              key={i}
              className={[
                'rounded-full transition-all duration-300',
                i === pasoActual
                  ? 'w-5 h-2 bg-primario'
                  : i < pasoActual
                    ? 'w-2 h-2 bg-primario/40'
                    : 'w-2 h-2 bg-gray-200',
              ].join(' ')}
            />
          ))}
        </div>

        {/* Botones anterior / siguiente */}
        <div className="flex items-center gap-1.5 shrink-0">
          {pasoActual > 0 && (
            <button
              type="button"
              onClick={onAnterior}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-borde
                         text-suave hover:text-texto hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={17} />
            </button>
          )}
          <button
            type="button"
            onClick={onSiguiente}
            className="h-9 px-4 bg-primario text-white rounded-xl
                       font-display font-semibold text-sm
                       hover:bg-primario-hover active:scale-95 transition-all
                       flex items-center gap-1.5"
          >
            {esUltimo ? (
              <>
                <CheckCircle2 size={14} />
                ¡Listo!
              </>
            ) : (
              <>
                Siguiente
                <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Indicador textual */}
      <p className="text-[11px] text-suave/50 text-right -mt-1">
        Paso {pasoActual + 1} de {totalPasos}
      </p>
    </div>
  )
}

// ─── PantallaFin ──────────────────────────────────────────────────────────────

function PantallaFin({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-6">
      <div
        className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full
                   flex flex-col items-center gap-5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-6xl">🎉</div>

        <div>
          <p className="font-display font-bold text-xl text-texto mb-2">
            ¡Listo! Su tienda está configurada
          </p>
          <p className="text-sm text-suave leading-relaxed">
            Los datos se guardan solos — usted solo venda. Si en algún momento
            tiene dudas, puede repetir este tour desde{' '}
            <strong className="text-texto">Configuración</strong> (toque el
            nombre de su tienda arriba).
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 bg-primario text-white rounded-xl
                     font-display font-bold text-base
                     hover:bg-primario-hover active:scale-95 transition-all"
        >
          ¡Empecemos a vender! 🏪
        </button>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

type TourOverlayProps = Pick<
  TourState,
  | 'pasoActual'
  | 'totalPasos'
  | 'pasoInfo'
  | 'siguientePaso'
  | 'anteriorPaso'
  | 'saltarTour'
  | 'completarTour'
>

export function TourOverlay({
  pasoActual,
  totalPasos,
  pasoInfo,
  siguientePaso,
  anteriorPaso,
  saltarTour,
  completarTour,
}: TourOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [mostrandoFin, setMostrandoFin] = useState(false)

  // Localizar el elemento target en el DOM cuando cambia el paso
  useEffect(() => {
    if (!pasoInfo.target) {
      setRect(null)
      return
    }

    const buscar = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${pasoInfo.target}"]`)
      setRect(el ? el.getBoundingClientRect() : null)
    }

    buscar()
    // Reintento breve: el DOM puede no haberse pintado en el mismo tick
    const t = setTimeout(buscar, 80)

    const onResize = () => buscar()
    window.addEventListener('resize', onResize)

    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', onResize)
    }
  }, [pasoActual, pasoInfo.target])

  // ── Pantalla de fin (después del último paso) ──────────────────────────────
  if (mostrandoFin) {
    return (
      <PantallaFin
        onClose={async () => {
          await completarTour()
          // completarTour() setea tourCompletado=true en el hook padre,
          // lo que desmonta este componente desde AppLayout
        }}
      />
    )
  }

  const esUltimo       = pasoActual === totalPasos - 1
  const tooltipStyle   = calcTooltipStyle(rect, pasoInfo)

  const handleSiguiente = () => {
    if (esUltimo) {
      setMostrandoFin(true)
    } else {
      siguientePaso()
    }
  }

  return (
    // Capa raíz: intercepta todos los clicks para evitar interacción con la app
    <div
      className="fixed inset-0 z-[60]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Spotlight — el div transparente cuya sombra oscurece el resto */}
      {rect && <SpotlightBox rect={rect} />}

      {/* Fondo oscuro para pasos sin target (paso 5: tarjeta centrada) */}
      {!rect && (
        <div className="absolute inset-0 bg-black/72" />
      )}

      {/* Tooltip interactivo */}
      <TooltipCard
        paso={pasoInfo}
        pasoActual={pasoActual}
        totalPasos={totalPasos}
        style={tooltipStyle}
        onSiguiente={handleSiguiente}
        onAnterior={anteriorPaso}
        onSaltar={saltarTour}
        esUltimo={esUltimo}
      />
    </div>
  )
}
