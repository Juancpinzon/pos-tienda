// mapeoSKU.ts — Motor de aprendizaje de nombres de proveedor → producto interno
//
// Flujo:
//   1. OCR lee "LCH ENT 1.1" de una factura
//   2. buscarMapeo("LCH ENT 1.1") → devuelve { productoId: 42, nombre: "Leche Entera 1L" }
//      si ya existe un mapeo guardado
//   3. Si no hay mapeo: sugerirProducto("LCH ENT 1.1") busca en el catálogo por
//      similaridad de palabras clave y devuelve candidatos ordenados por relevancia
//   4. El tendero confirma → guardarMapeo("LCH ENT 1.1", 42)
//   5. La próxima vez que llegue esa factura, el paso 2 resuelve automáticamente
//
// El algoritmo de sugerencia es intencionalmente simple:
//   - Normaliza a minúsculas, quita tildes y signos de puntuación
//   - Divide en tokens (palabras)
//   - Cuenta cuántos tokens del nombre del proveedor aparecen en el nombre del producto
//   - Prioriza mapeos ya guardados por vecesUsado

import { db } from '../db/database'
import type { MapeoSKU, Producto } from '../db/schema'

// ─── Normalización ────────────────────────────────────────────────────────────

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quitar tildes
    .replace(/[^a-z0-9\s]/g, ' ')      // quitar puntuación
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizar(texto: string): string[] {
  return normalizar(texto).split(' ').filter((t) => t.length >= 2)
}

// Cuántos tokens de `a` aparecen en `b` (proporción)
function scoreSimilaridad(a: string, b: string): number {
  const tokensA = tokenizar(a)
  const normB   = normalizar(b)
  if (tokensA.length === 0) return 0
  const coincidencias = tokensA.filter((t) => normB.includes(t)).length
  return coincidencias / tokensA.length
}

// ─── Buscar mapeo existente ───────────────────────────────────────────────────

export interface ResultadoMapeo {
  id: number
  productoId: number
  nombreProducto: string
  vecesUsado: number
  exacto: boolean   // true = coincidencia exacta; false = coincidencia parcial
}

/**
 * Busca un mapeo para el nombre que viene de la factura.
 * 1° intenta coincidencia exacta (normalizada).
 * 2° si no hay, busca el mapeo con mayor similaridad (score > 0.5).
 */
export async function buscarMapeo(nombreProveedor: string): Promise<ResultadoMapeo | null> {
  const normBuscado = normalizar(nombreProveedor)

  const todos = await db.mapeosSKU.toArray()

  // Coincidencia exacta normalizada
  const exacto = todos.find((m) => normalizar(m.nombreProveedor) === normBuscado)
  if (exacto?.id !== undefined) {
    return {
      id: exacto.id,
      productoId: exacto.productoId,
      nombreProducto: exacto.nombreProducto,
      vecesUsado: exacto.vecesUsado,
      exacto: true,
    }
  }

  // Coincidencia parcial: mapeo cuyo nombreProveedor tiene score > 0.5 con la búsqueda
  const conScore = todos.map((m) => ({
    m,
    score: scoreSimilaridad(nombreProveedor, m.nombreProveedor) *
           scoreSimilaridad(m.nombreProveedor, nombreProveedor),
  }))

  const mejorParcial = conScore
    .filter(({ score }) => score > 0.5)
    .sort((a, b) => b.score - a.score || b.m.vecesUsado - a.m.vecesUsado)[0]

  if (mejorParcial?.m.id !== undefined) {
    return {
      id: mejorParcial.m.id,
      productoId: mejorParcial.m.productoId,
      nombreProducto: mejorParcial.m.nombreProducto,
      vecesUsado: mejorParcial.m.vecesUsado,
      exacto: false,
    }
  }

  return null
}

// ─── Sugerir productos del catálogo ──────────────────────────────────────────

export interface SugerenciaProducto {
  producto: Producto
  score: number     // 0–1, mayor = más relevante
  desdeMapa: boolean
}

/**
 * Busca en el catálogo los productos más similares al texto de la factura.
 * Devuelve hasta `limite` sugerencias ordenadas por relevancia.
 * Primero devuelve productos que ya tienen un mapeo (desde mapas guardados).
 */
export async function sugerirProducto(
  nombreProveedor: string,
  limite = 5,
): Promise<SugerenciaProducto[]> {
  const [productos, mapeos] = await Promise.all([
    db.productos.filter((p) => p.activo && !p.esFantasma).toArray(),
    db.mapeosSKU.toArray(),
  ])

  // Mapa: productoId → vecesUsado en mapeos previos
  const mapaVeces: Record<number, number> = {}
  for (const m of mapeos) {
    mapaVeces[m.productoId] = (mapaVeces[m.productoId] ?? 0) + m.vecesUsado
  }

  const resultados: SugerenciaProducto[] = productos
    .map((p) => {
      const scoreNombre  = scoreSimilaridad(nombreProveedor, p.nombre)
      const scoreInverso = scoreSimilaridad(p.nombre, nombreProveedor)
      // Score combinado: promedio geométrico + bonus por mapeos previos
      const base  = Math.sqrt(scoreNombre * scoreInverso)
      const bonus = p.id !== undefined && mapaVeces[p.id] ? 0.1 : 0
      return {
        producto: p,
        score: Math.min(1, base + bonus),
        desdeMapa: p.id !== undefined && (mapaVeces[p.id] ?? 0) > 0,
      }
    })
    .filter((r) => r.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)

  return resultados
}

// ─── Guardar / actualizar mapeo ───────────────────────────────────────────────

/**
 * Crea un mapeo nuevo o actualiza el existente incrementando vecesUsado.
 * También actualiza el snapshot del nombre del producto.
 */
export async function guardarMapeo(
  nombreProveedor: string,
  productoId: number,
): Promise<void> {
  const ahora = new Date()
  const normBuscado = normalizar(nombreProveedor)

  // Buscar por nombre normalizado (exacto)
  const todos      = await db.mapeosSKU.toArray()
  const existente  = todos.find((m) => normalizar(m.nombreProveedor) === normBuscado)
  const producto   = await db.productos.get(productoId)
  if (!producto) return

  if (existente?.id !== undefined) {
    await db.mapeosSKU.update(existente.id, {
      productoId,
      nombreProducto: producto.nombre,
      vecesUsado: existente.vecesUsado + 1,
      actualizadoEn: ahora,
    })
  } else {
    await db.mapeosSKU.add({
      nombreProveedor: nombreProveedor.trim(),
      productoId,
      nombreProducto: producto.nombre,
      vecesUsado: 1,
      creadoEn: ahora,
      actualizadoEn: ahora,
    })
  }
}

// ─── CRUD para la pantalla de administración ──────────────────────────────────

export async function listarMapeos(): Promise<MapeoSKU[]> {
  return db.mapeosSKU.orderBy('vecesUsado').reverse().toArray()
}

export async function eliminarMapeo(id: number): Promise<void> {
  await db.mapeosSKU.delete(id)
}

export async function actualizarMapeo(
  id: number,
  cambios: Partial<Pick<MapeoSKU, 'nombreProveedor' | 'productoId' | 'nombreProducto'>>,
): Promise<void> {
  await db.mapeosSKU.update(id, { ...cambios, actualizadoEn: new Date() })
}
