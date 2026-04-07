/**
 * Utilidades y fórmulas para el módulo de nómina.
 * Basado en la normativa colombiana actual.
 */

export const SMMLV_2025 = 1_423_500;
export const SUBSIDIO_TRANSPORTE_2025 = 200_000;

export function calcularDeduccionesSS(salario: number) {
  // El IBC (Ingreso Base de Cotización) tiene como piso el salario mínimo
  const ibc = Math.max(salario, SMMLV_2025);
  const salud = ibc * 0.04;
  const pension = ibc * 0.04;
  return { salud, pension, total: salud + pension };
}

export function calcularPrima(salario: number, diasTrabajados: number): number {
  return (salario * diasTrabajados) / 360;
}

export function calcularCesantias(salario: number, diasTrabajados: number): number {
  return (salario * diasTrabajados) / 360;
}

export function calcularInteresesCesantias(cesantias: number, diasTrabajados: number): number {
  return (cesantias * 0.12 * diasTrabajados) / 360;
}

export function calcularVacaciones(salario: number, diasVacaciones: number): number {
  return (salario * diasVacaciones) / 360;
}
