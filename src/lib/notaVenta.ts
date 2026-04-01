// Generador de Nota de Venta — Régimen Simple (DIAN)
// Para tenderos que aún NO están obligados a facturación electrónica.
// Genera un documento válido para soportar transacciones.

import type { Venta, DetalleVenta, ConfigTienda } from '../db/schema'
import { formatCOP } from '../utils/moneda'
import { db } from '../db/database'

// ─── Consecutivo ──────────────────────────────────────────────────────────────

/**
 * Obtiene y devuelve el siguiente consecutivo de nota de venta.
 * Incrementa automáticamente el contador en la DB.
 */
export async function siguienteConsecutivo(): Promise<{ numero: number; codigo: string }> {
  const cfg = await db.configFiscal.get(1)

  const prefijo = cfg?.prefijo ?? 'NV'
  const siguiente = (cfg?.ultimoConsecutivo ?? 0) + 1

  if (cfg) {
    await db.configFiscal.update(1, { ultimoConsecutivo: siguiente })
  } else {
    await db.configFiscal.put({
      id: 1,
      ultimoConsecutivo: siguiente,
      prefijo,
    })
  }

  const codigo = `${prefijo}-${String(siguiente).padStart(4, '0')}`
  return { numero: siguiente, codigo }
}

/**
 * Obtiene el consecutivo de una nota existente sin incrementar.
 * Usa el id de venta como fallback.
 */
export function formatearConsecutivo(
  prefijo: string,
  numero: number,
): string {
  return `${prefijo}-${String(numero).padStart(4, '0')}`
}

// ─── Label forma de pago ──────────────────────────────────────────────────────

function labelFormaPago(venta: Venta): string {
  if (venta.tipoPago === 'efectivo') return 'Efectivo'
  if (venta.tipoPago === 'fiado') return 'Fiado (crédito)'
  if (venta.tipoPago === 'transferencia') return `Transferencia${venta.notas ? ` (${venta.notas})` : ''}`
  if (venta.tipoPago === 'tarjeta') {
    return venta.subtipoTarjeta === 'debito' ? 'Tarjeta Débito' : 'Tarjeta Crédito'
  }
  return venta.tipoPago
}

// ─── Generador HTML ───────────────────────────────────────────────────────────

export interface NotaVentaOptions {
  /** Código consecutivo, ej: "NV-0042" */
  consecutivo: string
  /** Nombre del cliente si es venta a fiado */
  nombreCliente?: string
}

/**
 * Genera el HTML de la nota de venta.
 * El HTML es auto-contenido (estilos inline) para que la conversión
 * a PDF con html2canvas funcione correctamente.
 */
export function generarNotaVenta(
  venta: Venta,
  detalles: DetalleVenta[],
  config: Pick<ConfigTienda, 'nombreTienda' | 'nit' | 'direccion' | 'telefono' | 'mensajeRecibo'>,
  opciones: NotaVentaOptions,
): string {
  const fecha = venta.creadaEn.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const hora = venta.creadaEn.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  const formaPago = labelFormaPago(venta)
  const cambio = venta.cambio ?? 0

  const filasDetalle = detalles
    .map(
      (d) => {
        const cant = d.cantidad % 1 === 0 ? String(d.cantidad) : d.cantidad.toFixed(2)
        const nombre = d.nombreProducto.length > 28
          ? d.nombreProducto.substring(0, 26) + '…'
          : d.nombreProducto
        return `
    <tr>
      <td style="padding:3px 4px;color:#374151;font-size:12px;">${cant}</td>
      <td style="padding:3px 4px;color:#111827;font-size:12px;">${nombre}${d.esProductoFantasma ? ' <span style="color:#D97706;font-size:10px;">(sin registro)</span>' : ''}</td>
      <td style="padding:3px 4px;text-align:right;color:#111827;font-size:12px;font-weight:600;font-family:monospace;">${formatCOP(d.subtotal)}</td>
    </tr>`
      }
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Nota de Venta ${opciones.consecutivo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      background: #F9FAFB;
      display: flex;
      justify-content: center;
      padding: 16px;
    }
    .nota {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      width: 300px;
      padding: 0;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .cabecera {
      background: #1E3A5F;
      color: #FFFFFF;
      text-align: center;
      padding: 16px 12px 14px;
    }
    .cabecera .nombre {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .cabecera .nit {
      font-size: 11px;
      margin-top: 2px;
      opacity: 0.85;
    }
    .cabecera .dir {
      font-size: 10px;
      margin-top: 1px;
      opacity: 0.75;
    }
    .encabezado-nv {
      background: #F3F8FF;
      border-bottom: 1px solid #E5E7EB;
      padding: 10px 14px;
    }
    .encabezado-nv .numero {
      font-size: 13px;
      font-weight: 700;
      color: #1E3A5F;
    }
    .encabezado-nv .fecha {
      font-size: 11px;
      color: #6B7280;
      margin-top: 1px;
    }
    .tabla-wrapper {
      padding: 4px 0;
    }
    .tabla-header {
      display: grid;
      grid-template-columns: 28px 1fr auto;
      background: #F9FAFB;
      border-bottom: 1px solid #E5E7EB;
      padding: 4px 14px;
    }
    .tabla-header span {
      font-size: 10px;
      font-weight: 600;
      color: #9CA3AF;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    table td {
      padding: 3px 14px;
    }
    table tr:last-child td {
      padding-bottom: 6px;
    }
    .divisor {
      border: none;
      border-top: 1px dashed #D1D5DB;
      margin: 0 14px;
    }
    .total-section {
      padding: 8px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total-row .label {
      font-size: 11px;
      color: #6B7280;
    }
    .total-row .valor {
      font-size: 11px;
      font-family: monospace;
      color: #111827;
    }
    .total-row.total-final {
      background: #EFF6FF;
      margin: 0 -14px;
      padding: 8px 14px;
      border-top: 1px solid #BFDBFE;
      border-bottom: 1px solid #BFDBFE;
    }
    .total-row.total-final .label {
      font-size: 13px;
      font-weight: 700;
      color: #1E3A5F;
    }
    .total-row.total-final .valor {
      font-size: 15px;
      font-weight: 700;
      color: #1E3A5F;
    }
    .footer {
      padding: 10px 14px 14px;
      text-align: center;
    }
    .footer .regimen {
      background: #FEF3C7;
      border: 1px solid #FDE68A;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 10px;
      color: #92400E;
      margin-bottom: 8px;
      line-height: 1.4;
    }
    .footer .gracias {
      font-size: 12px;
      font-weight: 600;
      color: #1E3A5F;
    }
    .footer .mensaje {
      font-size: 10px;
      color: #6B7280;
      margin-top: 2px;
    }
  </style>
</head>
<body>
<div class="nota" id="nota-venta-doc">
  <div class="cabecera">
    <p class="nombre">🏪 ${config.nombreTienda}</p>
    ${config.nit ? `<p class="nit">NIT/CC: ${config.nit}</p>` : ''}
    ${config.direccion ? `<p class="dir">${config.direccion}</p>` : ''}
    ${config.telefono ? `<p class="dir">Tel: ${config.telefono}</p>` : ''}
  </div>

  <div class="encabezado-nv">
    <p class="numero">NOTA DE VENTA No. ${opciones.consecutivo}</p>
    <p class="fecha">📅 ${fecha} &nbsp;⏰ ${hora}${opciones.nombreCliente ? ` &nbsp;· 👤 ${opciones.nombreCliente}` : ''}</p>
  </div>

  <div class="tabla-wrapper">
    <div class="tabla-header">
      <span>Cant</span>
      <span>Descripción</span>
      <span>Valor</span>
    </div>
    <table>
      ${filasDetalle}
    </table>
  </div>

  <hr class="divisor" />

  <div class="total-section">
    ${venta.descuento > 0 ? `
    <div class="total-row">
      <span class="label">Descuento</span>
      <span class="valor">-${formatCOP(venta.descuento)}</span>
    </div>` : ''}

    <div class="total-row total-final">
      <span class="label">TOTAL</span>
      <span class="valor">${formatCOP(venta.total)}</span>
    </div>

    <div class="total-row" style="margin-top:4px;">
      <span class="label">Forma de pago</span>
      <span class="valor">${formaPago}</span>
    </div>

    ${venta.tipoPago === 'efectivo' && venta.efectivoRecibido !== undefined ? `
    <div class="total-row">
      <span class="label">Efectivo recibido</span>
      <span class="valor">${formatCOP(venta.efectivoRecibido)}</span>
    </div>` : ''}

    ${venta.tipoPago === 'efectivo' && cambio > 0 ? `
    <div class="total-row">
      <span class="label">Cambio</span>
      <span class="valor" style="color:#16A34A;font-weight:600;">${formatCOP(cambio)}</span>
    </div>` : ''}
  </div>

  <hr class="divisor" />

  <div class="footer">
    <div class="regimen">
      ⚠️ No somos responsables de IVA — Régimen Simple de Tributación
    </div>
    <p class="gracias">¡Gracias por su compra!</p>
    ${config.mensajeRecibo ? `<p class="mensaje">${config.mensajeRecibo}</p>` : ''}
  </div>
</div>
</body>
</html>`
}

// ─── Generador de texto plano para WhatsApp ───────────────────────────────────

/**
 * Genera texto plano de la nota de venta para compartir por WhatsApp.
 */
export function generarTextoNotaVenta(
  venta: Venta,
  detalles: DetalleVenta[],
  config: Pick<ConfigTienda, 'nombreTienda' | 'nit' | 'direccion' | 'telefono' | 'mensajeRecibo'>,
  opciones: NotaVentaOptions,
): string {
  const L = 32
  const linea = '─'.repeat(L)
  const centro = (t: string) => {
    const pad = Math.max(0, Math.floor((L - t.length) / 2))
    return ' '.repeat(pad) + t
  }
  const fila = (izq: string, der: string) => {
    const esp = L - izq.length - der.length
    if (esp <= 0) return `${izq}\n  ${der}`
    return izq + ' '.repeat(esp) + der
  }

  const fecha = venta.creadaEn.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora = venta.creadaEn.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })

  const ls: string[] = []
  ls.push(centro('🏪 ' + config.nombreTienda))
  if (config.nit) ls.push(centro('NIT/CC: ' + config.nit))
  if (config.direccion) ls.push(centro(config.direccion))
  if (config.telefono) ls.push(centro('Tel: ' + config.telefono))
  ls.push(linea)
  ls.push(centro(`NOTA DE VENTA No. ${opciones.consecutivo}`))
  ls.push(fila('Fecha:', fecha))
  ls.push(fila('Hora:', hora))
  if (opciones.nombreCliente) ls.push(fila('Cliente:', opciones.nombreCliente))
  ls.push(linea)

  for (const d of detalles) {
    const cant = d.cantidad % 1 === 0 ? String(d.cantidad) : d.cantidad.toFixed(2)
    const nom = d.nombreProducto.length > 18 ? d.nombreProducto.substring(0, 16) + '…' : d.nombreProducto
    ls.push(`${cant}  ${nom}`)
    ls.push(fila('   ' + formatCOP(d.precioUnitario) + ' c/u', formatCOP(d.subtotal)))
  }

  ls.push(linea)
  if (venta.descuento > 0) ls.push(fila('Descuento:', `-${formatCOP(venta.descuento)}`))
  ls.push(fila('TOTAL:', formatCOP(venta.total)))
  ls.push(fila('Forma de pago:', labelFormaPago(venta)))
  if (venta.tipoPago === 'efectivo' && venta.efectivoRecibido !== undefined) {
    ls.push(fila('Recibido:', formatCOP(venta.efectivoRecibido)))
  }
  if (venta.tipoPago === 'efectivo' && (venta.cambio ?? 0) > 0) {
    ls.push(fila('Cambio:', formatCOP(venta.cambio!)))
  }
  ls.push(linea)
  ls.push('⚠️ No resp. de IVA — Régimen Simple')
  ls.push(linea)
  ls.push(centro('¡Gracias por su compra!'))
  if (config.mensajeRecibo) ls.push(centro(config.mensajeRecibo))

  return ls.join('\n')
}

// ─── Generación de PDF ────────────────────────────────────────────────────────

/**
 * Convierte el HTML de la nota de venta en un Blob PDF.
 * Usa html2canvas + jsPDF para renderizar el HTML como imagen.
 */
export async function generarPDF(htmlNota: string): Promise<Blob> {
  // Importaciones dinámicas para no aumentar el bundle inicial
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  // Crear iframe oculto para renderizar el HTML
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:340px;height:auto;border:none;opacity:0;'
  document.body.appendChild(iframe)

  return new Promise((resolve, reject) => {
    iframe.onload = async () => {
      try {
        const doc = iframe.contentDocument!
        const notaEl = doc.getElementById('nota-venta-doc')
        if (!notaEl) throw new Error('No se encontró el elemento #nota-venta-doc')

        // Esperar a que el font de Google Fonts cargue (si hay conexión)
        await new Promise((r) => setTimeout(r, 800))

        const canvas = await html2canvas(notaEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#FFFFFF',
          logging: false,
        })

        const imgW = 80   // mm (ancho rollo 80mm)
        const imgH = (canvas.height * imgW) / canvas.width
        const pdf = new jsPDF({ unit: 'mm', format: [imgW, imgH + 6] })
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 3, imgW, imgH)

        document.body.removeChild(iframe)
        resolve(pdf.output('blob'))
      } catch (err) {
        document.body.removeChild(iframe)
        reject(err)
      }
    }

    iframe.srcdoc = htmlNota
  })
}

// ─── Descarga del PDF ─────────────────────────────────────────────────────────

/**
 * Descarga un Blob de PDF en el dispositivo del usuario.
 */
export function descargarPDF(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// ─── Compartir por WhatsApp ───────────────────────────────────────────────────

/**
 * Abre WhatsApp con la nota de venta pre-cargada en el campo de texto.
 */
export function compartirNotaPorWhatsApp(texto: string) {
  const encoded = encodeURIComponent(texto)
  window.open(`https://wa.me/?text=${encoded}`, '_blank')
}
