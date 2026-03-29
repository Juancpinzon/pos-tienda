import numeral from 'numeral'

// Registrar locale colombiano (puntos como separador de miles, sin decimales)
if (!numeral.locales['co']) {
  numeral.register('locale', 'co', {
    delimiters: { thousands: '.', decimal: ',' },
    abbreviations: { thousand: 'k', million: 'M', billion: 'B', trillion: 'T' },
    ordinal: () => '',
    currency: { symbol: '$' },
  })
}
numeral.locale('co')

/**
 * Formatea un número como pesos colombianos sin decimales.
 * Ejemplos: 4200 → "$4.200"  |  50000 → "$50.000"  |  1200000 → "$1.200.000"
 */
export function formatCOP(valor: number): string {
  return numeral(valor).format('$0,0')
}

/**
 * Parsea un string de entrada numérica (sin formato) a número entero.
 * El TecladoNumerico siempre trabaja con strings sin separadores.
 * Ejemplo: "4200" → 4200  |  "" → 0
 */
export function parsearEntero(texto: string): number {
  const n = parseInt(texto.replace(/\D/g, ''), 10)
  return isNaN(n) ? 0 : n
}
