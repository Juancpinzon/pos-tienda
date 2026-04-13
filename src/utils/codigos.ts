// Genera un código único para un cliente
export function generarCodigoCliente(plan: "basico" | "pro" | "upgrade"): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Sin caracteres confusos
  const sufijo = Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
  
  const prefijos = {
    basico: 'TIENDA',
    pro: 'PRO',
    upgrade: 'UPG'
  }
  
  return `${prefijos[plan]}-${sufijo}`
}
