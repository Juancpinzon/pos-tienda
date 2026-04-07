import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { Empleado, PeriodoNomina, LiquidacionPrestaciones } from '../db/schema'

export function useNomina() {
  const empleados = useLiveQuery(() => 
    db.empleados.filter(e => e.activo).sortBy('nombre')
  )

  const crearEmpleado = async (empleado: Omit<Empleado, 'id' | 'creadoEn'>) => {
    return await db.empleados.add({
      ...empleado,
      creadoEn: new Date()
    })
  }

  const actualizarEmpleado = async (id: number, cambios: Partial<Empleado>) => {
    return await db.empleados.update(id, cambios)
  }

  const archivarEmpleado = async (id: number) => {
    return await db.empleados.update(id, { activo: false })
  }

  const crearPeriodoNomina = async (periodo: Omit<PeriodoNomina, 'id' | 'creadoEn'>) => {
    return await db.periodosNomina.add({
      ...periodo,
      creadoEn: new Date()
    })
  }

  const listarPeriodosNomina = (empleadoId: number) => {
    // Retorna queries reactivos. No es await, debe ser usado dentro de un componente si se quiere reactivo.
    // Pero lo común en la app es que el componente declare el `useLiveQuery` en sí.
    // Vamos a retornar métodos asíncronos para facilidad, o arrays si se prefiere.
    // Dado que the prompt dice "Agrega a useNomina las funciones..." we will just define async getters or provide queries.
    return db.periodosNomina
      .where('empleadoId').equals(empleadoId)
      .reverse()
      .sortBy('fechaInicio')
  }

  const marcarPagado = async (periodoId: number) => {
    return await db.periodosNomina.update(periodoId, { 
      estado: 'pagado',
      fechaPago: new Date()
    })
  }

  // Helper para traer los adelantos pendientes (descontadoEn = undefined)
  const getAdelantosPendientes = async (empleadoId: number) => {
    // Si no indexamos descontadoEn de forma útil para esto, podemos traer todos y filtrar
    const adelantos = await db.adelantosEmpleado
      .where('empleadoId').equals(empleadoId)
      .toArray()
    return adelantos.filter(a => !a.descontadoEn)
  }

  const calcularPrestacionesEmpleado = async (empleadoId: number, año: number) => {
    const empleado = await db.empleados.get(empleadoId)
    if (!empleado) return []

    const fechaIngreso = new Date(empleado.fechaIngreso)
    const inicioAno = new Date(año, 0, 1)
    const fechaEfectiva = fechaIngreso > inicioAno ? fechaIngreso : inicioAno

    const finS1 = new Date(año, 5, 30) // 30 jun
    const finS2 = new Date(año, 11, 31) // 31 dic
    const inicioS2 = new Date(año, 6, 1) // 1 jul

    const diffDays = (d1: Date, d2: Date) => Math.max(0, Math.floor((d2.getTime() - d1.getTime()) / 86400000) + 1)

    const diasS1 = fechaEfectiva <= finS1 ? diffDays(fechaEfectiva, finS1) : 0
    
    const fechaEfectivaS2 = fechaEfectiva > inicioS2 ? fechaEfectiva : inicioS2
    const diasS2 = fechaEfectivaS2 <= finS2 ? diffDays(fechaEfectivaS2, finS2) : 0

    const diasAnio = diasS1 + diasS2

    const liquidacionesDB = await db.liquidacionesPrestaciones
      .where('empleadoId').equals(empleadoId)
      .toArray()

    const primaS1 = Math.round((empleado.salario * Math.min(diasS1, 180)) / 360)
    const primaS2 = Math.round((empleado.salario * Math.min(diasS2, 180)) / 360)
    const cesantias = Math.round((empleado.salario * Math.min(diasAnio, 360)) / 360)
    const intereses = Math.round((cesantias * Math.min(diasAnio, 360) * 0.12) / 360)

    const crearRegistroVirtual = (tipo: LiquidacionPrestaciones['tipo'], periodo: string, base: number, dias: number, monto: number): LiquidacionPrestaciones => {
      const dbReg = liquidacionesDB.find(l => l.tipo === tipo && l.periodo === periodo)
      if (dbReg) return dbReg
      return {
        empleadoId,
        tipo,
        periodo,
        baseCalculo: base,
        diasCalculo: dias,
        monto,
        estado: 'pendiente',
        creadoEn: new Date()
      }
    }

    return [
      crearRegistroVirtual('prima', `${año}-S1`, empleado.salario, diasS1, primaS1),
      crearRegistroVirtual('prima', `${año}-S2`, empleado.salario, diasS2, primaS2),
      crearRegistroVirtual('cesantias', `${año}`, empleado.salario, diasAnio, cesantias),
      crearRegistroVirtual('intereses_cesantias', `${año}`, cesantias, diasAnio, intereses),
    ].filter(p => p.monto > 0)
  }

  const registrarPagoPrestacion = async (prestacion: LiquidacionPrestaciones) => {
    // Si ya tiene ID, es que ya estaba registrada, solo actualizamos? Normalmente no debería pasar si es una nueva
    if (prestacion.id) {
      return await db.liquidacionesPrestaciones.update(prestacion.id, {
        estado: 'pagado',
        fechaPago: prestacion.fechaPago || new Date(),
      })
    } else {
      return await db.liquidacionesPrestaciones.add({
        ...prestacion,
        estado: 'pagado',
        fechaPago: prestacion.fechaPago || new Date(),
      })
    }
  }

  return {
    empleados,
    crearEmpleado,
    actualizarEmpleado,
    archivarEmpleado,
    crearPeriodoNomina,
    listarPeriodosNomina,
    marcarPagado,
    getAdelantosPendientes,
    calcularPrestacionesEmpleado,
    registrarPagoPrestacion
  }
}
