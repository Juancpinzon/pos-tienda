import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import type { Empleado, PeriodoNomina } from '../db/schema'

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

  return {
    empleados,
    crearEmpleado,
    actualizarEmpleado,
    archivarEmpleado,
    crearPeriodoNomina,
    listarPeriodosNomina,
    marcarPagado,
    getAdelantosPendientes
  }
}
