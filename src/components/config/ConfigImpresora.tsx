// ConfigImpresora.tsx — Sección de configuración de impresora térmica Bluetooth
//
// Solo visible para dueño. Funciona en Chrome para Android (Web Bluetooth API).
// En iPhone o navegadores sin soporte muestra instrucciones de WhatsApp.
//
// Impresoras compatibles: Xprinter XP-58, GOOJPRT PT-210, POS-5805DD,
// Rongta y cualquier impresora térmica 58mm compatible con ESC/POS vía BLE.

import { useState } from 'react'
import {
  Printer,
  Bluetooth,
  BluetoothOff,
  Loader2,
  CheckCircle2,
  Smartphone,
} from 'lucide-react'
import {
  bluetoothDisponible,
  obtenerNombreImpresora,
  impresoraConectada,
  conectarImpresora,
  desconectarImpresora,
  imprimirPrueba,
} from '../../lib/impresora'
import { useAuthStore } from '../../stores/authStore'

// ─── Componente exportado ─────────────────────────────────────────────────────

export function ConfigImpresora() {
  const usuario = useAuthStore((s) => s.usuario)

  const [nombreGuardado, setNombreGuardado] = useState<string | null>(
    () => obtenerNombreImpresora()
  )
  const [conectado,    setConectado]    = useState<boolean>(() => impresoraConectada())
  const [accion,       setAccion]       = useState<'idle' | 'conectando' | 'probando' | 'ok' | 'error'>('idle')
  const [msgAccion,    setMsgAccion]    = useState<string | null>(null)

  // Solo visible para dueño
  if (usuario?.rol !== 'dueno') return null

  const btDisponible = bluetoothDisponible()
  const ocupado      = accion === 'conectando' || accion === 'probando'

  const handleConectar = async () => {
    setAccion('conectando')
    setMsgAccion(null)
    try {
      const { nombre } = await conectarImpresora()
      setNombreGuardado(nombre)
      setConectado(true)
      setAccion('ok')
      setMsgAccion(`Conectado a: ${nombre}`)
    } catch (err) {
      setAccion('error')
      setMsgAccion(err instanceof Error ? err.message : 'Error al conectar')
    }
  }

  const handlePrueba = async () => {
    setAccion('probando')
    setMsgAccion(null)
    try {
      await imprimirPrueba()
      setAccion('ok')
      setMsgAccion('Recibo de prueba enviado correctamente.')
    } catch (err) {
      setAccion('error')
      setMsgAccion(err instanceof Error ? err.message : 'Error al imprimir')
    }
  }

  const handleDesconectar = () => {
    desconectarImpresora()
    setNombreGuardado(null)
    setConectado(false)
    setAccion('idle')
    setMsgAccion(null)
  }

  return (
    <section>
      <p className="text-xs font-semibold text-suave uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Printer size={13} />
        Impresora Bluetooth
      </p>

      {!btDisponible ? (
        /* Navegador incompatible — iOS, Firefox, etc. */
        <div className="bg-fondo rounded-xl border border-borde p-4 flex items-start gap-3">
          <Smartphone size={18} className="text-suave shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-texto">
              Funciona en Chrome para Android
            </p>
            <p className="text-xs text-suave leading-relaxed">
              La impresión directa vía Bluetooth requiere Chrome en Android.
              En iPhone usa el botón <span className="font-semibold">WhatsApp</span>{' '}
              para enviar el recibo al cliente.
            </p>
            <p className="text-[11px] text-suave/70 mt-1">
              Compatible: Xprinter XP-58, GOOJPRT PT-210, y cualquier impresora térmica 58mm ESC/POS.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-fondo rounded-xl border border-borde overflow-hidden">

          {/* Estado de conexión */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-borde/50">
            <div className={[
              'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
              conectado ? 'bg-exito/15 text-exito' : 'bg-gray-100 text-suave',
            ].join(' ')}>
              <Bluetooth size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-texto truncate">
                {conectado && nombreGuardado ? nombreGuardado : 'Sin impresora configurada'}
              </p>
              <p className="text-xs text-suave">
                {conectado
                  ? 'Conectada y lista para imprimir'
                  : nombreGuardado
                    ? `Última usada: ${nombreGuardado}`
                    : 'Toca "Buscar" para conectar'}
              </p>
            </div>
            {conectado && (
              <span className="text-[10px] font-bold text-exito bg-exito/10 px-2 py-0.5 rounded-full shrink-0">
                ONLINE
              </span>
            )}
          </div>

          {/* Acciones */}
          <div className="p-3 flex flex-col gap-2">

            {/* Buscar / Cambiar impresora */}
            <button
              type="button"
              onClick={handleConectar}
              disabled={ocupado}
              className="w-full h-11 bg-gray-900 text-white rounded-xl text-sm font-semibold
                         flex items-center justify-center gap-2
                         hover:bg-gray-800 active:scale-95 transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {accion === 'conectando' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Bluetooth size={16} />
              )}
              {accion === 'conectando'
                ? 'Buscando impresora…'
                : conectado
                  ? 'Cambiar impresora'
                  : '🔍 Buscar impresora Bluetooth'}
            </button>

            {/* Imprimir recibo de prueba — solo si conectada */}
            {conectado && (
              <button
                type="button"
                onClick={handlePrueba}
                disabled={ocupado}
                className="w-full h-10 bg-primario/10 text-primario border border-primario/25
                           rounded-xl text-sm font-semibold flex items-center justify-center gap-2
                           hover:bg-primario/15 active:scale-95 transition-all
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {accion === 'probando' ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Printer size={15} />
                )}
                {accion === 'probando' ? 'Imprimiendo…' : '🖨️ Imprimir recibo de prueba'}
              </button>
            )}

            {/* Desconectar — solo si hay algo guardado */}
            {(nombreGuardado || conectado) && (
              <button
                type="button"
                onClick={handleDesconectar}
                disabled={ocupado}
                className="w-full h-10 text-peligro border border-peligro/25 rounded-xl text-sm
                           font-semibold flex items-center justify-center gap-2
                           hover:bg-peligro/5 active:scale-95 transition-all
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <BluetoothOff size={15} />
                Desconectar
              </button>
            )}
          </div>

          {/* Resultado de la última acción */}
          {msgAccion && (
            <div className={[
              'mx-3 mb-3 px-3 py-2.5 rounded-xl text-xs flex items-start gap-2',
              accion === 'error'
                ? 'bg-peligro/8 text-peligro border border-peligro/20'
                : 'bg-exito/8 text-exito border border-exito/20',
            ].join(' ')}>
              {accion === 'error'
                ? <BluetoothOff size={13} className="shrink-0 mt-0.5" />
                : <CheckCircle2 size={13} className="shrink-0 mt-0.5" />}
              <span className="leading-snug">{msgAccion}</span>
            </div>
          )}

          {/* Nota de compatibilidad */}
          <p className="px-4 pb-3 text-[11px] text-suave/60 leading-snug">
            Compatible con Xprinter XP-58, GOOJPRT PT-210, POS-5805DD, Rongta y similares.
            Requiere Chrome para Android. iPhone usa WhatsApp.
          </p>
        </div>
      )}
    </section>
  )
}
