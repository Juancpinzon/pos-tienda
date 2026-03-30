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
  const [estado, setEstado]     = useState<EstadoEscaner>('iniciando')
  const [ultimoCodigo, setUltimoCodigo] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    const iniciar = async () => {
      try {
        // Importar dinámicamente para no bloquear el bundle principal
        const { BrowserMultiFormatReader, NotFoundException } = await import('@zxing/library')

        if (!activo) return

        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader

        // Pedir acceso a la cámara trasera preferentemente
        const constraints: MediaStreamConstraints = {
          video: { facingMode: { ideal: 'environment' } },
        }

        // Verificar que el navegador soporte getUserMedia
        if (!navigator.mediaDevices?.getUserMedia) {
          setEstado('sin_camara')
          return
        }

        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        } catch (err: unknown) {
          if (!activo) return
          const name = err instanceof Error ? err.name : ''
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            setEstado('denegado')
          } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            setEstado('sin_camara')
          } else {
            setEstado('error')
          }
          return
        }

        if (!activo) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setEstado('escaneando')

        // Decodificar frame a frame
        const decode = async () => {
          if (!activo || !videoRef.current) return

          try {
            const result = await reader.decodeOnceFromVideoElement(videoRef.current)

            if (!activo) return

            const codigo = result.getText()
            setUltimoCodigo(codigo)

            // Vibración háptica al detectar (si el dispositivo lo soporta)
            if (navigator.vibrate) navigator.vibrate(200)

            // Parar el stream antes de notificar al padre
            stream.getTracks().forEach((t) => t.stop())
            onCodigoDetectado(codigo)

          } catch (err) {
            if (!activo) return
            // NotFoundException = no hay código en el frame — reintentar
            if (err instanceof NotFoundException) {
              setTimeout(decode, 150)
            }
            // Cualquier otro error: reintentar silenciosamente
            else {
              setTimeout(decode, 300)
            }
          }
        }

        decode()

      } catch {
        if (activo) setEstado('error')
      }
    }

    iniciar()

    return () => {
      activo = false
      // Detener el stream y liberar la cámara
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((t) => t.stop())
        videoRef.current.srcObject = null
      }
      readerRef.current?.reset()
    }
  }, [onCodigoDetectado])

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

        {/* Video */}
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
                    Para escanear códigos de barras, usted debe permitir el acceso
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
                Apunte la cámara al código de barras
              </p>
            </div>
          </>
        )}

        {/* Flash de éxito al detectar */}
        {ultimoCodigo && (
          <div className="absolute inset-0 bg-white/20 pointer-events-none animate-pulse" />
        )}
      </div>
    </div>
  )
}
