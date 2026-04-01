// EscanerCodigoBarras.tsx
// Modal de escáner de código de barras usando la cámara del celular.
// Usa @zxing/library (BrowserMultiFormatReader) para leer EAN-13, EAN-8, Code128, QR.
//
// Props:
//   onCodigoDetectado(codigo) — se llama una sola vez al detectar un código
//   onClose                  — cierra el modal sin escanear
//
// Flujo de permisos:
//   - Si el usuario niega la cámara → estado 'denegado' con mensaje claro
//   - Si el dispositivo no tiene cámara → estado 'sin_camara'
//   - HTTPS requerido en producción (Vercel lo provee automáticamente)
//
// BUG FIX (2026-04): La versión anterior usaba `decodeOnceFromVideoElement()` que
// NO existe en @zxing/library v0.21.x — lanzaba TypeError en cada frame, era capturado
// silenciosamente y el escáner nunca disparaba. Fix: usar `decodeFromVideoDevice()`
// que es el método oficial para escaneo continuo desde cámara.

import { useEffect, useRef, useState } from 'react'
import { X, Camera, CameraOff, Loader2 } from 'lucide-react'

type EstadoEscaner = 'iniciando' | 'escaneando' | 'denegado' | 'sin_camara' | 'error'

export interface EscanerCodigoBarrasProps {
  onCodigoDetectado: (codigo: string) => void
  onClose: () => void
}

export function EscanerCodigoBarras({ onCodigoDetectado, onClose }: EscanerCodigoBarrasProps) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<import('@zxing/library').BrowserMultiFormatReader | null>(null)
  const [estado, setEstado]           = useState<EstadoEscaner>('iniciando')
  const [codigoDetectado, setCodigoDetectado] = useState(false)

  useEffect(() => {
    let activo = true

    const iniciar = async () => {
      try {
        // Importar dinámicamente para no bloquear el bundle principal
        const { BrowserMultiFormatReader, NotFoundException } = await import('@zxing/library')
        if (!activo) return

        // Verificar soporte de cámara
        if (!navigator.mediaDevices?.getUserMedia) {
          setEstado('sin_camara')
          return
        }

        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader

        // Obtener la lista de cámaras y preferir la trasera (environment)
        let deviceId: string | null = null
        try {
          const devices = await reader.listVideoInputDevices()
          if (devices.length === 0) {
            setEstado('sin_camara')
            return
          }
          // Buscar cámara trasera por etiqueta común
          const trasera = devices.find((d) =>
            /back|rear|environment|trasera/i.test(d.label)
          )
          deviceId = (trasera ?? devices[devices.length - 1]).deviceId
        } catch {
          // Si listVideoInputDevices falla, dejar deviceId=null y que ZXing elija
        }

        if (!activo) return
        setEstado('escaneando')

        // decodeFromVideoDevice gestiona TODO el ciclo:
        //   - getUserMedia con el deviceId indicado
        //   - Adjunta el stream al elemento <video>
        //   - Decodifica frame a frame en un canvas interno
        //   - Llama al callback con el resultado (o el error de cada frame)
        //
        // Importante: NO usar decodeOnceFromVideoElement — ese método no existe en v0.21.x.
        await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result, err) => {
            if (!activo) return

            if (result) {
              const codigo = result.getText()
              if (!codigo) return

              // Prevenir disparos múltiples en el mismo frame
              if (codigoDetectado) return
              setCodigoDetectado(true)

              // Vibración háptica (si el dispositivo lo soporta)
              if (navigator.vibrate) navigator.vibrate(200)

              // Detener el escáner antes de notificar al padre
              reader.reset()
              onCodigoDetectado(codigo)
              return
            }

            // NotFoundException = no hay código visible en el frame — completamente normal
            // Cualquier otro error: loguear pero NO detener el escáner
            if (err && !(err instanceof NotFoundException)) {
              console.warn('[EscanerCodigoBarras] frame error:', err.message ?? err)
            }
          }
        )

      } catch (err: unknown) {
        if (!activo) return
        const name = err instanceof Error ? err.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setEstado('denegado')
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setEstado('sin_camara')
        } else {
          console.error('[EscanerCodigoBarras]', err)
          setEstado('error')
        }
      }
    }

    iniciar()

    return () => {
      activo = false
      // reset() detiene el stream de cámara y libera todos los recursos internos de ZXing
      readerRef.current?.reset()
      readerRef.current = null
    }
  }, [onCodigoDetectado]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cerrar con Escape ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 shrink-0">
        <div className="flex items-center gap-2 text-white">
          <Camera size={18} />
          <span className="font-semibold text-sm">Escanear código de barras</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center rounded-full
                     bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X size={22} />
        </button>
      </div>

      {/* ── Visor de la cámara (80% de altura) ── */}
      <div className="flex-1 relative overflow-hidden">

        {/* Video — ZXing adjunta el srcObject aquí al iniciar */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
          style={{ display: estado === 'escaneando' ? 'block' : 'none' }}
        />

        {/* Estados no-escaneando */}
        {estado !== 'escaneando' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center">
            {estado === 'iniciando' && (
              <>
                <Loader2 size={48} className="text-white animate-spin" />
                <p className="text-white text-base font-medium">Iniciando cámara…</p>
              </>
            )}
            {estado === 'denegado' && (
              <>
                <CameraOff size={52} className="text-red-400" />
                <div>
                  <p className="text-white font-bold text-lg mb-2">Permiso de cámara denegado</p>
                  <p className="text-white/70 text-sm leading-relaxed">
                    Para escanear códigos de barras, debe permitir el acceso
                    a la cámara en la configuración de su navegador.
                  </p>
                  <p className="text-white/50 text-xs mt-3">
                    En Chrome: Configuración → Privacidad → Permisos de cámara
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 px-6 py-3 bg-white text-black rounded-xl font-bold text-sm
                             hover:bg-white/90 active:scale-95 transition-all"
                >
                  Entendido
                </button>
              </>
            )}
            {estado === 'sin_camara' && (
              <>
                <CameraOff size={52} className="text-yellow-400" />
                <div>
                  <p className="text-white font-bold text-lg mb-2">No se detectó cámara</p>
                  <p className="text-white/70 text-sm leading-relaxed">
                    Este dispositivo no tiene cámara disponible o el navegador
                    no permite acceder a ella. Ingrese el código manualmente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 px-6 py-3 bg-white text-black rounded-xl font-bold text-sm
                             hover:bg-white/90 active:scale-95 transition-all"
                >
                  Ingresar manualmente
                </button>
              </>
            )}
            {estado === 'error' && (
              <>
                <CameraOff size={52} className="text-red-400" />
                <div>
                  <p className="text-white font-bold text-lg mb-2">Error al abrir la cámara</p>
                  <p className="text-white/70 text-sm">
                    Intente de nuevo o ingrese el código manualmente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 px-6 py-3 bg-white text-black rounded-xl font-bold text-sm"
                >
                  Cerrar
                </button>
              </>
            )}
          </div>
        )}

        {/* Marco de escaneo + línea animada (solo cuando está escaneando) */}
        {estado === 'escaneando' && (
          <>
            {/* Oscurece los bordes dejando ventana central */}
            <div className="absolute inset-0 pointer-events-none"
              style={{
                background: `
                  linear-gradient(to bottom,
                    rgba(0,0,0,0.55) 0%,
                    rgba(0,0,0,0.55) 20%,
                    transparent 20%,
                    transparent 80%,
                    rgba(0,0,0,0.55) 80%,
                    rgba(0,0,0,0.55) 100%
                  ),
                  linear-gradient(to right,
                    rgba(0,0,0,0.55) 0%,
                    rgba(0,0,0,0.55) 8%,
                    transparent 8%,
                    transparent 92%,
                    rgba(0,0,0,0.55) 92%,
                    rgba(0,0,0,0.55) 100%
                  )
                `,
              }}
            />

            {/* Esquinas del marco */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-[84%] h-[60%]">
                {/* Esquina sup-izq */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                {/* Esquina sup-der */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                {/* Esquina inf-izq */}
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                {/* Esquina inf-der */}
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />

                {/* Línea de escaneo animada */}
                <div className="absolute left-2 right-2 h-0.5 bg-primario/90 shadow-[0_0_8px_2px_rgba(45,106,79,0.8)]
                                animate-[scan_2s_ease-in-out_infinite]"
                />
              </div>
            </div>

            {/* Ayuda textual */}
            <div className="absolute bottom-0 left-0 right-0 pb-4 flex justify-center pointer-events-none">
              <p className="text-white/80 text-sm font-medium bg-black/50 px-4 py-2 rounded-full">
                {codigoDetectado ? '✓ Código detectado…' : 'Apunte la cámara al código de barras'}
              </p>
            </div>
          </>
        )}

        {/* Flash verde al detectar */}
        {codigoDetectado && (
          <div className="absolute inset-0 bg-exito/20 pointer-events-none animate-pulse" />
        )}
      </div>
    </div>
  )
}
