import type { PeriodoNomina, Empleado, ConfigTienda } from '../db/schema'
import { formatCOP } from '../utils/moneda'
import { format } from 'date-fns'

export function generarColillaHTML(
  empleado: Empleado,
  periodo: PeriodoNomina,
  config: Pick<ConfigTienda, 'nombreTienda' | 'nit' | 'direccion' | 'telefono'>
): string {
  const fechaInicio = format(periodo.fechaInicio, 'dd/MM/yyyy')
  const fechaFin = format(periodo.fechaFin, 'dd/MM/yyyy')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Colilla de Pago ${empleado.nombre}</title>
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
    .colilla {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      width: 380px;
      padding: 0;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .cabecera {
      background: #0F172A;
      color: #FFFFFF;
      text-align: center;
      padding: 16px 12px;
    }
    .cabecera .nombre-tienda { font-size: 16px; font-weight: 700; letter-spacing: 0.02em; }
    .cabecera .info-tienda { font-size: 11px; margin-top: 4px; opacity: 0.85; line-height: 1.4; }
    
    .seccion-empleado {
      background: #F8FAFC;
      border-bottom: 1px solid #E2E8F0;
      padding: 14px 16px;
    }
    .seccion-empleado .titulo { font-size: 10px; text-transform: uppercase; color: #64748B; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 2px; }
    .seccion-empleado .nombre-emp { font-size: 15px; font-weight: 700; color: #0F172A; }
    .seccion-empleado .cargo-emp { font-size: 12px; color: #475569; margin-top: 1px; }
    .seccion-empleado .periodo { font-size: 11px; color: #334155; margin-top: 8px; font-weight: 600; background: #E2E8F0; display: inline-block; padding: 3px 8px; border-radius: 4px; }
    
    .cuerpo { padding: 16px; }
    
    .tabla-rubros { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .tabla-rubros th { text-align: left; font-size: 10px; color: #64748B; border-bottom: 1px solid #CBD5E1; padding-bottom: 6px; text-transform: uppercase; }
    .tabla-rubros th.right { text-align: right; }
    .tabla-rubros td { padding: 6px 0; font-size: 12px; color: #334155; border-bottom: 1px dashed #E2E8F0; }
    .tabla-rubros td.valor { text-align: right; font-family: monospace; font-weight: 600; color: #0F172A; }
    .tabla-rubros tr.deduccion td { color: #64748B; }
    .tabla-rubros tr.deduccion td.valor { color: #DC2626; }
    .tabla-rubros tr.bono td.valor { color: #16A34A; }
    
    .resumen { background: #F1F5F9; border-radius: 8px; padding: 12px; margin-top: 16px; }
    .resumen-fila { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; color: #475569; }
    .resumen-fila.total { border-top: 1px solid #CBD5E1; margin-top: 6px; padding-top: 8px; font-weight: 700; color: #0F172A; font-size: 16px; align-items: center; }
    .resumen-fila.total .valor { font-size: 18px; color: #2563EB; }
    
    .firma { margin-top: 32px; padding: 0 16px 24px; text-align: center; }
    .firma-linea { border-top: 1px solid #94A3B8; width: 200px; margin: 0 auto; padding-top: 8px; }
    .firma > p { font-size: 11px; color: #64748B; }
  </style>
</head>
<body>
<div class="colilla" id="colilla-doc">
  <div class="cabecera">
    <p class="nombre-tienda">🏪 ${config.nombreTienda}</p>
    <div class="info-tienda">
      ${config.nit ? `NIT: ${config.nit} | ` : ''} ${config.telefono ? `Tel: ${config.telefono}` : ''}
    </div>
  </div>
  
  <div class="seccion-empleado">
    <p class="titulo">Comprobante de Pago de Nómina</p>
    <p class="nombre-emp">${empleado.nombre}</p>
    <p class="cargo-emp">${empleado.cargo || 'Empleado'} ${empleado.cedula ? `| CC: ${empleado.cedula}` : ''}</p>
    <p class="periodo">Período: ${fechaInicio} al ${fechaFin}</p>
  </div>
  
  <div class="cuerpo">
    <table class="tabla-rubros">
      <thead>
        <tr>
          <th>Concepto</th>
          <th class="right">Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Salario Básico (${periodo.diasTrabajados} días)</td>
          <td class="valor">${formatCOP(periodo.totalDevengado - periodo.bonificaciones)}</td>
        </tr>
        ${periodo.bonificaciones > 0 ? `
        <tr class="bono">
          <td>Bonificaciones / Extras</td>
          <td class="valor">+${formatCOP(periodo.bonificaciones)}</td>
        </tr>` : ''}
        <tr class="deduccion">
          <td>Aporte Salud (4%)</td>
          <td class="valor">-${formatCOP(periodo.deduccionSalud)}</td>
        </tr>
        <tr class="deduccion">
          <td>Aporte Pensión (4%)</td>
          <td class="valor">-${formatCOP(periodo.deduccionPension)}</td>
        </tr>
        ${periodo.otrasDeduciones > 0 ? `
        <tr class="deduccion">
          <td>Adelantos / Otras deduc.</td>
          <td class="valor">-${formatCOP(periodo.otrasDeduciones)}</td>
        </tr>` : ''}
      </tbody>
    </table>
    
    <div class="resumen">
      <div class="resumen-fila">
        <span>Total Devengado</span>
        <span style="font-family:monospace;font-weight:600;">${formatCOP(periodo.totalDevengado)}</span>
      </div>
      <div class="resumen-fila">
        <span>Total Deducciones</span>
        <span style="font-family:monospace;font-weight:600;color:#DC2626;">-${formatCOP(periodo.totalDeducciones)}</span>
      </div>
      <div class="resumen-fila total">
        <span>NETO A PAGAR</span>
        <span class="valor" style="font-family:monospace;">${formatCOP(periodo.netoAPagar)}</span>
      </div>
    </div>
  </div>
  
  <div class="firma">
    <div class="firma-linea"></div>
    <p>Firma del empleado</p>
    <p style="margin-top:2px;font-size:9px;opacity:0.6;">Documento soporte de pago de nómina</p>
  </div>
</div>
</body>
</html>`
}

export function generarTextoColilla(
  empleado: Empleado,
  periodo: PeriodoNomina,
  config: Pick<ConfigTienda, 'nombreTienda'>
): string {
  const fechaInicio = format(periodo.fechaInicio, 'dd/MM/yyyy')
  const fechaFin = format(periodo.fechaFin, 'dd/MM/yyyy')
  const L = 30
  const linea = '─'.repeat(L)
  
  const ls: string[] = []
  ls.push(`🏢 *${config.nombreTienda}*`)
  ls.push(`📄 *Colilla de Pago*`)
  ls.push(linea)
  ls.push(`👤 *Empleado:* ${empleado.nombre}`)
  ls.push(`📅 *Período:* ${fechaInicio} al ${fechaFin}`)
  ls.push(linea)
  ls.push(`Devengado: ${formatCOP(periodo.totalDevengado)}`)
  ls.push(`Deducciones: -${formatCOP(periodo.totalDeducciones)}`)
  ls.push(linea)
  ls.push(`💰 *NETO A PAGAR: ${formatCOP(periodo.netoAPagar)}*`)
  ls.push(linea)
  ls.push(`Este es un resumen de tu pago. Por favor revisa el PDF para el detalle.`)
  
  return ls.join('\n')
}

export async function generarColillaPDF(htmlDoc: string): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ])

  const iframe = document.createElement('iframe')
  // We make width 400px to have a nice clean render before we shrink it to 80mm PDF
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:auto;border:none;opacity:0;'
  document.body.appendChild(iframe)

  return new Promise((resolve, reject) => {
    iframe.onload = async () => {
      try {
        const doc = iframe.contentDocument!
        const colillaEl = doc.getElementById('colilla-doc')
        if (!colillaEl) throw new Error('No se encontró #colilla-doc')

        await new Promise((r) => setTimeout(r, 800))

        const canvas = await html2canvas(colillaEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#FFFFFF',
          logging: false
        })

        const imgW = 80
        const imgH = (canvas.height * imgW) / canvas.width
        const pdf = new jsPDF({ unit: 'mm', format: [imgW, imgH] })
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, imgH)

        document.body.removeChild(iframe)
        resolve(pdf.output('blob'))
      } catch (err) {
        document.body.removeChild(iframe)
        reject(err)
      }
    }
    iframe.srcdoc = htmlDoc
  })
}

export function descargarColillaPDF(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function compartirColillaWhatsApp(texto: string) {
  const encoded = encodeURIComponent(texto)
  window.open(`https://wa.me/?text=${encoded}`, '_blank')
}
