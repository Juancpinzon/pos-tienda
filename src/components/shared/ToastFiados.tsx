// Toast accionable para fiados pendientes
// Se muestra al detectar clientes con mora al arrancar la app.
// Persiste hasta que el tendero lo cierra manualmente.

import toast from 'react-hot-toast'
import type { ResultadoCobroFiados } from '../../lib/agenteCobroFiados'

// ─── Helpers de formato ───────────────────────────────────────────────────────

function formatPesos(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO')
}

function fechaHoy(): string {
  const hoy = new Date()
  const dia = String(hoy.getDate()).padStart(2, '0')
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}`
}

// ─── Mensaje de WhatsApp ──────────────────────────────────────────────────────

function construirMensajeWA(resultado: ResultadoCobroFiados): string {
  const { totalClientes, totalDeuda, clientes } = resultado

  const lineasClientes = clientes
    .map((c) => `  ${c.nombre} - ${formatPesos(c.totalDeuda)} (${c.diasSinPago}d)`)
    .join('\n')

  return (
    `📊 Fiados pendientes hoy ${fechaHoy()}:\n` +
    `Total: ${totalClientes} cliente${totalClientes === 1 ? '' : 's'} · ${formatPesos(totalDeuda)}\n\n` +
    `${lineasClientes}\n\n` +
    `Ver cartera: https://pos-tienda-ten.vercel.app/fiados`
  )
}

// ─── Componente del toast ─────────────────────────────────────────────────────

interface Props {
  resultado: ResultadoCobroFiados
  toastId: string
}

export function ToastFiados({ resultado, toastId }: Props) {
  const { totalClientes, totalDeuda, clientes } = resultado

  // Subtexto: primeros 2 clientes con deuda
  const subtexto = clientes
    .slice(0, 2)
    .map((c) => `${c.nombre} ${formatPesos(c.totalDeuda)}`)
    .join(', ')

  const urlWA =
    'https://wa.me/?text=' + encodeURIComponent(construirMensajeWA(resultado))

  return (
    <div
      style={{
        background: '#1e1b2e',
        border: '1px solid #7c3aed',
        borderRadius: '12px',
        padding: '14px 16px',
        minWidth: '280px',
        maxWidth: '340px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px', lineHeight: 1 }}>💜</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#ede9fe' }}>
              {totalClientes} cliente{totalClientes === 1 ? '' : 's'} · {formatPesos(totalDeuda)} pendiente
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#a78bfa', marginTop: '2px' }}>
              {subtexto}
            </p>
          </div>
        </div>

        {/* Botón cerrar */}
        <button
          onClick={() => toast.dismiss(toastId)}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            padding: '0 2px',
            flexShrink: 0,
          }}
          title="Cerrar"
        >
          ×
        </button>
      </div>

      {/* Botón de WhatsApp */}
      <a
        href={urlWA}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => toast.dismiss(toastId)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          background: '#16a34a',
          color: '#fff',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '13px',
          fontWeight: 600,
          textDecoration: 'none',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#15803d' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#16a34a' }}
      >
        <span style={{ fontSize: '15px' }}>📲</span>
        Enviar a WhatsApp
      </a>
    </div>
  )
}
