// Generador de recibos en texto plano, optimizado para compartir por WhatsApp
// REGLA: nunca acceder a DB aquí — recibe los datos ya resueltos

import type { Venta, DetalleVenta, ConfigTienda } from '../db/schema'
import { formatCOP } from './moneda'

function linea(char = '─', largo = 32) {
  return char.repeat(largo)
}

function centrar(texto: string, largo = 32) {
  const pad = Math.max(0, Math.floor((largo - texto.length) / 2))
  return ' '.repeat(pad) + texto
}

function fila(izq: string, der: string, largo = 32) {
  const espacio = largo - izq.length - der.length
  if (espacio <= 0) return `${izq}\n  ${der}`
  return izq + ' '.repeat(espacio) + der
}

function formatearFecha(fecha: Date) {
  return fecha.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function labelTipoPago(tipo: Venta['tipoPago']) {
  const labels: Record<Venta['tipoPago'], string> = {
    efectivo: 'Efectivo',
    fiado: 'Fiado',
    transferencia: 'Transferencia',
    mixto: 'Pago mixto',
  }
  return labels[tipo]
}

/**
 * Genera el texto del recibo para compartir por WhatsApp u otros medios.
 * Usa caracteres de texto plano para máxima compatibilidad.
 */
export function generarRecibo(
  venta: Venta,
  detalles: DetalleVenta[],
  config: Pick<ConfigTienda, 'nombreTienda' | 'direccion' | 'telefono' | 'nit' | 'mensajeRecibo'>
): string {
  const lineas: string[] = []

  // Encabezado
  lineas.push(centrar('🏪 ' + config.nombreTienda))
  if (config.direccion) lineas.push(centrar(config.direccion))
  if (config.telefono) lineas.push(centrar('Tel: ' + config.telefono))
  if (config.nit) lineas.push(centrar('NIT: ' + config.nit))
  lineas.push(linea())

  // Fecha y número de venta
  lineas.push(fila('Fecha:', formatearFecha(venta.creadaEn)))
  if (venta.id) lineas.push(fila('Venta #:', String(venta.id)))
  lineas.push(linea())

  // Productos
  lineas.push('PRODUCTOS:')
  for (const d of detalles) {
    const cantStr = d.cantidad % 1 === 0
      ? String(d.cantidad)
      : d.cantidad.toFixed(2)
    const nombre = d.nombreProducto.length > 20
      ? d.nombreProducto.substring(0, 18) + '…'
      : d.nombreProducto
    lineas.push(`  ${nombre}`)
    lineas.push(fila(`  ${cantStr} x ${formatCOP(d.precioUnitario)}`, formatCOP(d.subtotal)))
  }
  lineas.push(linea())

  // Totales
  if (venta.descuento > 0) {
    lineas.push(fila('Descuento:', `-${formatCOP(venta.descuento)}`))
  }
  lineas.push(fila('TOTAL:', formatCOP(venta.total)))
  lineas.push(linea())

  // Pago
  lineas.push(fila('Pago:', labelTipoPago(venta.tipoPago)))
  if (venta.tipoPago === 'efectivo' && venta.efectivoRecibido !== undefined) {
    lineas.push(fila('Recibido:', formatCOP(venta.efectivoRecibido)))
    if (venta.cambio !== undefined && venta.cambio > 0) {
      lineas.push(fila('Cambio:', formatCOP(venta.cambio)))
    }
  }

  // Mensaje personalizado
  if (config.mensajeRecibo) {
    lineas.push(linea())
    lineas.push(centrar(config.mensajeRecibo))
  }

  lineas.push(linea())
  lineas.push(centrar('¡Gracias por su compra!'))

  return lineas.join('\n')
}

/**
 * Abre WhatsApp con el recibo pre-cargado en el campo de texto.
 * En móvil abre la app; en escritorio abre web.whatsapp.com
 */
export function compartirPorWhatsApp(texto: string) {
  const encoded = encodeURIComponent(texto)
  // wa.me sin número → abre WhatsApp con el mensaje listo para elegir destinatario
  window.open(`https://wa.me/?text=${encoded}`, '_blank')
}
