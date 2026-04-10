/**
 * Utilidades y fórmulas para el módulo de nómina.
 * Basado en la normativa colombiana actual.
 *
 * NOTA: SMMLV y subsidio de transporte se leen desde ConfigTienda
 * (editables por el dueño cada enero). No hay constantes hardcodeadas aquí.
 */

/**
 * Calcula las deducciones de seguridad social a cargo del empleado.
 * @param salario   Salario base del período (proporcional a días trabajados)
 * @param smmlv     Salario Mínimo Mensual Legal Vigente (leído de ConfigTienda)
 */
export function calcularDeduccionesSS(salario: number, smmlv: number) {
  // El IBC (Ingreso Base de Cotización) tiene como piso el salario mínimo
  const ibc = Math.max(salario, smmlv);
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
