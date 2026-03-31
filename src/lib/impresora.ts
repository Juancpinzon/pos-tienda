// impresora.ts — Módulo de impresión térmica vía Web Bluetooth (ESC/POS)
//
// Arquitectura:
//   1. Web Bluetooth API (navigator.bluetooth) — solo Chrome Android 56+
//   2. Fallback automático a compartir por WhatsApp en dispositivos incompatibles
//
// Impresoras soportadas:
//   Las impresoras térmicas de 58mm chinas más comunes en Colombia
//   (Xprinter, POS-5805DD, Rongta, MTP-II, y marcas genéricas)
//   todas usan ESC/POS estándar y uno de los tres perfiles BLE conocidos.
//
// Compatibilidad:
//   ✅ Chrome para Android 56+ (tiendas colombianas usan Android)
//   ❌ Safari iOS (limitación de Apple, sin Web Bluetooth)
//   ⚠️  Chrome Desktop: requiere flag experimental (no recomendado en producción)

import type { Venta, DetalleVenta, ConfigTienda } from '../db/schema'
import { formatCOP } from '../utils/moneda'

// ─── Comandos ESC/POS ─────────────────────────────────────────────────────────

const ESC = 0x1B
const GS  = 0x1D

// Inicializar impresora (resetea alineación, fuente, etc.)
const CMD_INIT: Uint8Array   = new Uint8Array([ESC, 0x40])
// Corte parcial de papel (alimenta ~8mm antes de cortar)
const CMD_CORTAR: Uint8Array = new Uint8Array([GS, 0x56, 0x41, 0x10])

function cmdAlinear(n: 0 | 1 | 2): Uint8Array {
  // 0 = izquierda, 1 = centro, 2 = derecha
  return new Uint8Array([ESC, 0x61, n])
}

function cmdNegrita(on: boolean): Uint8Array {
  return new Uint8Array([ESC, 0x45, on ? 1 : 0])
}

function cmdTamano(ancho: 1 | 2, alto: 1 | 2): Uint8Array {
  // GS ! n — bits 4-6 = (ancho-1), bits 0-2 = (alto-1)
  return new Uint8Array([GS, 0x21, (((ancho - 1) & 7) << 4) | ((alto - 1) & 7)])
}

function cmdAvanzar(lineas: number): Uint8Array {
  return new Uint8Array([ESC, 0x64, Math.min(lineas, 255)])
}

// Codifica texto como Latin-1 + newline.
// Las impresoras térmicas baratas usan Latin-1/CP437, no UTF-8.
// Caracteres fuera del rango (emojis, tildes extendidas) → '?'
function textoBytes(texto: string): Uint8Array {
  const bytes: number[] = []
  for (let i = 0; i < texto.length; i++) {
    const cp = texto.charCodeAt(i)
    if (cp < 256) bytes.push(cp)
    else bytes.push(0x3F) // '?' para caracteres no Latin-1
  }
  bytes.push(0x0A) // newline
  return new Uint8Array(bytes)
}

// ─── Perfiles BLE conocidos para impresoras térmicas de 58mm ─────────────────
// Se prueban en orden hasta encontrar uno que funcione con el dispositivo.

interface PerfilBLE {
  servicio:       string
  caracteristica: string
  nombre:         string
}

const PERFILES_BLE: PerfilBLE[] = [
  {
    nombre:        'Xprinter / POS-5805DD / Genéricas',
    servicio:      '000018f0-0000-1000-8000-00805f9b34fb',
    caracteristica:'00002af1-0000-1000-8000-00805f9b34fb',
  },
  {
    nombre:        'Serie FF (Genéricas chinas comunes)',
    servicio:      '0000ff00-0000-1000-8000-00805f9b34fb',
    caracteristica:'0000ff02-0000-1000-8000-00805f9b34fb',
  },
  {
    nombre:        'Rongta / MTP-II / Epson BLE',
    servicio:      'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    caracteristica:'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  },
]

// ─── Estado en memoria de la sesión ──────────────────────────────────────────
// No se persiste en DB — el usuario reconecta al recargar la app.
// La reconexión sin picker está disponible via getDevices() (Chrome 85+).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BleDevice = any         // BluetoothDevice — tipado via runtime check
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BleChar   = any         // BluetoothRemoteGATTCharacteristic

let _dispositivo:    BleDevice | null = null
let _caracteristica: BleChar   | null = null

// ─── Clave localStorage ───────────────────────────────────────────────────────

const KEY_NOMBRE  = 'pos-impresora-nombre'
// Tamaño de chunk BLE en bytes — 128 bytes funciona en la mayoría de impresoras
// modernas; reducir a 20 si hay problemas de conexión con modelos muy viejos.
const CHUNK_SIZE  = 128

// ─── API pública ──────────────────────────────────────────────────────────────

/** ¿El navegador soporta Web Bluetooth? Solo Chrome Android ≥ 56. */
export function bluetoothDisponible(): boolean {
  return typeof navigator !== 'undefined'
    && 'bluetooth' in navigator
    && typeof (navigator as Record<string, unknown>).bluetooth === 'object'
}

/** Nombre de la última impresora configurada (guardado en localStorage). */
export function obtenerNombreImpresora(): string | null {
  return localStorage.getItem(KEY_NOMBRE)
}

/** ¿La impresora está conectada en esta sesión? */
export function impresoraConectada(): boolean {
  if (!_caracteristica || !_dispositivo) return false
  return (_dispositivo.gatt?.connected ?? false) as boolean
}

/**
 * Abre el picker de Bluetooth y conecta a la impresora.
 * Requiere gesto del usuario (tap en botón).
 * Prueba todos los perfiles BLE conocidos hasta encontrar uno compatible.
 */
export async function conectarImpresora(): Promise<{ nombre: string }> {
  if (!bluetoothDisponible()) {
    throw new Error(
      'La impresión Bluetooth funciona en Chrome para Android. ' +
      'En iPhone use el boton de WhatsApp.'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bt = (navigator as any).bluetooth

  const device: BleDevice = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: PERFILES_BLE.map((p) => p.servicio),
  })

  const server = await device.gatt.connect()

  // Buscar el primer perfil BLE que funcione en este dispositivo
  let caracteristica: BleChar | null = null

  for (const perfil of PERFILES_BLE) {
    try {
      const servicio = await server.getPrimaryService(perfil.servicio)
      const char     = await servicio.getCharacteristic(perfil.caracteristica)
      const props    = char.properties as Record<string, boolean>
      if (props.write || props.writeWithoutResponse) {
        caracteristica = char
        break
      }
    } catch {
      // Este perfil no está en el dispositivo — intentar el siguiente
    }
  }

  if (!caracteristica) {
    await device.gatt.disconnect()
    throw new Error(
      'No se pudo identificar el protocolo de esta impresora. ' +
      'Verifique que sea una impresora termica de 58mm compatible con ESC/POS.'
    )
  }

  // Guardar en memoria
  _dispositivo    = device
  _caracteristica = caracteristica
  const nombre    = (device.name as string | undefined) ?? 'Impresora BT'
  localStorage.setItem(KEY_NOMBRE, nombre)

  // Limpiar estado si el dispositivo se desconecta
  device.addEventListener('gattserverdisconnected', () => {
    _caracteristica = null
  })

  return { nombre }
}

/**
 * Intenta reconectarse a un dispositivo previamente pareado sin mostrar el picker.
 * Usa `getDevices()` (Chrome 85+, experimental). Retorna true si tuvo éxito.
 */
export async function intentarReconexionAutomatica(): Promise<boolean> {
  if (!bluetoothDisponible()) return false
  const nombreGuardado = obtenerNombreImpresora()
  if (!nombreGuardado) return false

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bt = (navigator as any).bluetooth
    if (typeof bt.getDevices !== 'function') return false

    const devices: BleDevice[] = await bt.getDevices()
    const device = devices.find((d: BleDevice) => d.name === nombreGuardado)
    if (!device) return false

    const server = await device.gatt.connect()

    for (const perfil of PERFILES_BLE) {
      try {
        const servicio = await server.getPrimaryService(perfil.servicio)
        const char     = await servicio.getCharacteristic(perfil.caracteristica)
        const props    = char.properties as Record<string, boolean>
        if (props.write || props.writeWithoutResponse) {
          _dispositivo    = device
          _caracteristica = char
          device.addEventListener('gattserverdisconnected', () => {
            _caracteristica = null
          })
          return true
        }
      } catch { /* intentar siguiente */ }
    }

    await device.gatt.disconnect()
    return false
  } catch {
    return false
  }
}

/** Desconecta la impresora y borra la configuración guardada. */
export function desconectarImpresora(): void {
  try { _dispositivo?.gatt?.disconnect() } catch { /* ignorar */ }
  _dispositivo    = null
  _caracteristica = null
  localStorage.removeItem(KEY_NOMBRE)
}

// ─── Envío de datos por BLE (chunked) ────────────────────────────────────────

async function enviarBytes(datos: Uint8Array): Promise<void> {
  if (!_caracteristica) throw new Error('Impresora no conectada')

  const char  = _caracteristica
  const props = char.properties as Record<string, boolean>
  const sinResp = props.writeWithoutResponse

  for (let i = 0; i < datos.length; i += CHUNK_SIZE) {
    const chunk = datos.slice(i, i + CHUNK_SIZE)
    if (sinResp && typeof char.writeValueWithoutResponse === 'function') {
      await char.writeValueWithoutResponse(chunk)
    } else {
      // writeValue es el método legacy — sigue siendo soportado en Chrome
      await char.writeValue(chunk)
    }
    // Pausa mínima para no saturar el buffer de la impresora
    await new Promise<void>((r) => setTimeout(r, 15))
  }
}

function concatenar(...arrays: Uint8Array[]): Uint8Array {
  const total  = arrays.reduce((s, a) => s + a.length, 0)
  const result = new Uint8Array(total)
  let offset   = 0
  for (const a of arrays) { result.set(a, offset); offset += a.length }
  return result
}

// ─── Formateo ESC/POS (58mm = 32 columnas en fuente normal) ──────────────────

const ANCHO = 32

function sep(ch = '-'): Uint8Array {
  return textoBytes(ch.repeat(ANCHO))
}

function centrado(texto: string): Uint8Array {
  const t   = texto.substring(0, ANCHO)
  const pad = Math.max(0, Math.floor((ANCHO - t.length) / 2))
  return textoBytes(' '.repeat(pad) + t)
}

function filaDos(izq: string, der: string): Uint8Array {
  const espacio = ANCHO - izq.length - der.length
  return textoBytes(espacio > 0 ? izq + ' '.repeat(espacio) + der : `${izq}\n  ${der}`)
}

function labelPago(tipo: Venta['tipoPago']): string {
  const m: Record<Venta['tipoPago'], string> = {
    efectivo: 'Efectivo', fiado: 'Fiado',
    transferencia: 'Transf.', mixto: 'Mixto',
  }
  return m[tipo]
}

// ─── Buffer ESC/POS del recibo ────────────────────────────────────────────────

export function construirBufferRecibo(
  venta: Venta,
  detalles: DetalleVenta[],
  config: Pick<ConfigTienda, 'nombreTienda' | 'direccion' | 'telefono' | 'nit' | 'mensajeRecibo'>
): Uint8Array {
  const partes: Uint8Array[] = []
  const add = (...chunks: Uint8Array[]) => partes.push(...chunks)

  // Inicializar
  add(CMD_INIT)

  // ── Encabezado ────────────────────────────────────────────────────────────
  add(cmdAlinear(1))

  // Nombre de la tienda: doble ancho + doble alto (máximo 14 chars en 58mm)
  const nombreCorto = config.nombreTienda.substring(0, 14)
  add(cmdTamano(2, 2), cmdNegrita(true))
  add(textoBytes(nombreCorto))
  add(cmdTamano(1, 1), cmdNegrita(false))

  if (config.direccion) add(centrado(config.direccion.substring(0, ANCHO)))
  if (config.telefono)  add(centrado(`Tel: ${config.telefono}`.substring(0, ANCHO)))
  if (config.nit)       add(centrado(`NIT: ${config.nit}`.substring(0, ANCHO)))

  add(cmdAlinear(0))
  add(sep('='))

  // ── Fecha y número ────────────────────────────────────────────────────────
  const fecha = venta.creadaEn.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora  = venta.creadaEn.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
  add(filaDos(fecha, hora))
  if (venta.id) add(filaDos('Venta #:', String(venta.id)))

  add(sep('-'))

  // ── Productos ─────────────────────────────────────────────────────────────
  for (const d of detalles) {
    const cant   = d.cantidad % 1 === 0 ? String(d.cantidad) : d.cantidad.toFixed(2)
    const nombre = d.nombreProducto.length > 20
      ? d.nombreProducto.substring(0, 18) + '..'
      : d.nombreProducto
    const izq    = `  ${cant}x ${formatCOP(d.precioUnitario)}`
    add(textoBytes(nombre))
    add(filaDos(izq, formatCOP(d.subtotal)))
  }

  add(sep('-'))

  // ── Total (doble alto para que se vea bien) ───────────────────────────────
  add(cmdNegrita(true), cmdTamano(1, 2))
  add(filaDos('TOTAL:', formatCOP(venta.total)))
  add(cmdTamano(1, 1), cmdNegrita(false))

  // ── Pago y cambio ─────────────────────────────────────────────────────────
  const cambioStr = venta.tipoPago === 'efectivo' && (venta.cambio ?? 0) > 0
    ? `Cambio: ${formatCOP(venta.cambio!)}`
    : ''
  add(filaDos(`Pago: ${labelPago(venta.tipoPago)}`, cambioStr))

  add(sep('='))

  // ── Mensaje personalizado ─────────────────────────────────────────────────
  if (config.mensajeRecibo) {
    add(cmdAlinear(1))
    // Partir en líneas de 32 chars
    const msg   = config.mensajeRecibo
    const chunk = ANCHO
    for (let i = 0; i < msg.length; i += chunk) {
      add(textoBytes(msg.substring(i, i + chunk)))
    }
    add(cmdAlinear(0))
    add(sep('='))
  }

  // ── Cierre ────────────────────────────────────────────────────────────────
  add(cmdAlinear(1))
  add(textoBytes('Gracias por su compra!'))
  add(cmdAlinear(0))

  // Avanzar papel y cortar
  add(cmdAvanzar(5))
  add(CMD_CORTAR)

  return concatenar(...partes)
}

// ─── Buffer de recibo de prueba ───────────────────────────────────────────────

export function construirBufferPrueba(): Uint8Array {
  const ahora = new Date()
  const hora  = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })

  const partes: Uint8Array[] = [
    CMD_INIT,
    cmdAlinear(1),
    cmdTamano(2, 2), cmdNegrita(true),
    textoBytes('PRUEBA OK'),
    cmdTamano(1, 1), cmdNegrita(false),
    sep('='),
    centrado('Impresora conectada'),
    centrado(`Hora: ${hora}`),
    sep('-'),
    textoBytes('12345678901234567890123456789012'),
    textoBytes('         1111111111222222222233'),
    textoBytes('1234567890123456789012345678901'),
    sep('-'),
    centrado('58mm - 32 cols'),
    sep('='),
    centrado('POS Tienda de Barrio'),
    cmdAvanzar(5),
    CMD_CORTAR,
  ]
  return concatenar(...partes)
}

// ─── Funciones de impresión ───────────────────────────────────────────────────

/**
 * Imprime el recibo de una venta.
 * Lanza error si la impresora no está conectada.
 */
export async function imprimirRecibo(
  venta: Venta,
  detalles: DetalleVenta[],
  config: Pick<ConfigTienda, 'nombreTienda' | 'direccion' | 'telefono' | 'nit' | 'mensajeRecibo'>
): Promise<void> {
  if (!impresoraConectada()) {
    throw new Error('Impresora no conectada. Conecte la impresora primero desde Configuracion.')
  }
  await enviarBytes(construirBufferRecibo(venta, detalles, config))
}

/**
 * Imprime una hoja de prueba para verificar la conexión y el papel.
 */
export async function imprimirPrueba(): Promise<void> {
  if (!impresoraConectada()) {
    throw new Error('Impresora no conectada.')
  }
  await enviarBytes(construirBufferPrueba())
}
