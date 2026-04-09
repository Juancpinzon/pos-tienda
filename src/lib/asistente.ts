import { db } from '../db/database'
import { formatCOP } from '../utils/moneda'
import { supabase, supabaseConfigurado } from './supabase'

/**
 * Prepara el contexto de la tienda en formato texto para inyectarlo al prompt de Claude.
 * Busca los últimos 30 días de ventas, los top 5 clientes morosos, productos agotados, etc.
 */
export async function prepararContextoIA(): Promise<string> {
  const hace30dias = new Date()
  hace30dias.setDate(hace30dias.getDate() - 30)

  // 1. Obtener ventas completadas de los últimos 30 días
  const ventas = await db.ventas
    .where('creadaEn').aboveOrEqual(hace30dias)
    .filter(v => v.estado === 'completada')
    .toArray()

  // 2. Extraer detalles para top de productos
  const detallesList = await Promise.all(
    ventas.map(v => db.detallesVenta.where('ventaId').equals(v.id!).toArray())
  )
  const detalles = detallesList.flat()

  // Agrupar productos
  const mapaProductos = new Map<number | string, { nombre: string; cantidad: number; ingresos: number; ganancia: number }>()
  for (const d of detalles) {
    const key = d.productoId ?? d.nombreProducto
    const prev = mapaProductos.get(key) || { nombre: d.nombreProducto, cantidad: 0, ingresos: 0, ganancia: 0 }
    
    const qty = prev.cantidad + d.cantidad
    const ingresos = prev.ingresos + d.subtotal
    const ganancia = prev.ganancia + (d.subtotal - ((d.precioCompraSnapshot ?? 0) * d.cantidad))

    mapaProductos.set(key, { ...prev, cantidad: qty, ingresos, ganancia })
  }

  const productosOrdenados = Array.from(mapaProductos.values())
    .sort((a, b) => b.ingresos - a.ingresos)
    .slice(0, 10)

  const topVentasText = productosOrdenados.map((p, i) => 
    `${i + 1}. ${p.nombre}: vendió ${p.cantidad} u. dejando ${formatCOP(p.ingresos)} (ganancia est. ${formatCOP(p.ganancia)})`
  ).join('\n')

  // 3. Top clientes morosos
  const clientes = await db.clientes.filter(c => c.totalDeuda > 0).toArray()
  const topMorosos = clientes
    .sort((a, b) => b.totalDeuda - a.totalDeuda)
    .slice(0, 5)
  const morososText = topMorosos.map((c, i) => {
    let diasMora = 0
    if (c.ultimoMovimiento) {
        const dif = new Date().getTime() - c.ultimoMovimiento.getTime()
        diasMora = Math.floor(dif / (1000 * 3600 * 24))
    }
    return `${i + 1}. ${c.nombre}: debe ${formatCOP(c.totalDeuda)} (aprox. ${diasMora} días sin abono)`
  }).join('\n')

  // 4. Productos agotados
  const agotados = await db.productos
    .filter(p => p.activo && p.stockActual !== undefined && p.stockActual <= 0)
    .limit(10)
    .toArray()
  const agotadosText = agotados.map((p, i) => `${i + 1}. ${p.nombre}`).join('\n')

  // Constuir string final
  return `### RESUMEN ÚLTIMOS 30 DÍAS ###
Total de ventas completadas: ${ventas.length}
Ingreso total 30 días: ${formatCOP(ventas.reduce((sum, v) => sum + v.total, 0))}

TOP 10 PRODUCTOS QUE MÁS DEJAN PLATA:
${topVentasText || 'Ninguna venta registrada todavía.'}

TOP 5 CLIENTES QUE MÁS DEBEN (OJO CLAVOS):
${morososText || 'Nadie debe, todos al día.'}

ALGUNOS PRODUCTOS AGOTADOS QUE DEBERÍA SURTIR:
${agotadosText || 'No hay productos marcados como agotados, inventario al día.'}`
}

/**
 * Llama a la Edge Function pasándole el query y el contexto.
 */
export async function consultarIA(pregunta: string): Promise<string> {
  // Sin Supabase configurado no hay Edge Function disponible
  if (!supabaseConfigurado) {
    return 'Función disponible solo con conexión activa. Configure Supabase para usar el asistente IA.'
  }

  // Verificar sesión activa
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return 'Función disponible solo con conexión activa. Inicie sesión para usar el asistente IA.'
  }

  const contexto = await prepararContextoIA()

  // Revisar si casi no hay datos
  if (contexto.includes('Ninguna venta registrada')) {
    return 'Mi pez, registre más ventas primero para poder darle un buen análisis de cómo va el negocio. Por ahora no tengo datos.'
  }

  const { data, error } = await supabase.functions.invoke('asistente-ventas', {
    body: { pregunta, contexto }
  })

  if (error || data?.error) {
    throw new Error(data?.error || error?.message || 'Error desconocido al consultar IA')
  }

  // La APi de Anthropic suele retornar en content[0].text
  if (data?.content && data.content.length > 0) {
    return data.content[0].text
  }

  return 'Uy, algo salió raro. Intente otra vez.'
}
