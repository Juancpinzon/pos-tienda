import { z } from 'zod'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useNomina } from '../../hooks/useNomina'
import { db } from '../../db/database'

const empleadoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  salario: z.number({ invalid_type_error: 'Debe ser un número' }).min(0, 'No puede ser negativo'),
  fechaIngreso: z.string().min(1, 'La fecha es obligatoria'),
  tipoContrato: z.enum(['indefinido', 'fijo', 'obra_labor']),
  cedula: z.string().optional(),
  cargo: z.string().optional(),
  telefono: z.string().optional()
})

type EmpleadoForm = z.infer<typeof empleadoSchema>

interface Props {
  onClose: () => void
  empleadoId?: number
}

export function FormEmpleado({ onClose, empleadoId }: Props) {
  const { crearEmpleado, actualizarEmpleado, smmlv } = useNomina()
  const salarioDefaultAplicado = useRef(false)

  const form = useForm<EmpleadoForm>({
    resolver: zodResolver(empleadoSchema),
    defaultValues: {
      nombre: '',
      salario: 0,
      fechaIngreso: new Date().toISOString().split('T')[0],
      tipoContrato: 'indefinido',
      cedula: '',
      cargo: '',
      telefono: ''
    }
  })

  // Aplica smmlv como salario inicial solo cuando es un empleado nuevo y config cargó
  useEffect(() => {
    if (!empleadoId && smmlv > 0 && !salarioDefaultAplicado.current) {
      form.setValue('salario', smmlv, { shouldDirty: false })
      salarioDefaultAplicado.current = true
    }
  }, [smmlv, empleadoId, form])

  useEffect(() => {
    if (empleadoId) {
      db.empleados.get(empleadoId).then((emp) => {
        if (emp) {
          form.reset({
            nombre: emp.nombre,
            salario: emp.salario,
            fechaIngreso: typeof emp.fechaIngreso === 'string' 
              ? (emp.fechaIngreso as string).split('T')[0] 
              : emp.fechaIngreso.toISOString().split('T')[0],
            tipoContrato: emp.tipoContrato,
            cedula: emp.cedula || '',
            cargo: emp.cargo || '',
            telefono: emp.telefono || ''
          })
        }
      })
    }
  }, [empleadoId, form])

  const onSubmit = async (data: EmpleadoForm) => {
    try {
      const payload = {
        ...data,
        salario: Number(data.salario),
        fechaIngreso: new Date(data.fechaIngreso + 'T12:00:00'),
      }

      if (empleadoId) {
        await actualizarEmpleado(empleadoId, payload)
        toast.success('Empleado actualizado exitosamente')
      } else {
        await crearEmpleado({ ...payload, activo: true })
        toast.success('Empleado guardado exitosamente')
      }
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar')
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 px-2 sm:px-4 pb-4 sm:pb-0">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b border-borde shrink-0">
          <h2 className="font-display font-bold text-lg text-texto">
            {empleadoId ? 'Editar empleado' : 'Nuevo empleado'}
          </h2>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-fondo rounded-full text-suave">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-suave uppercase ml-1">Nombre completo *</label>
            <input 
              {...form.register('nombre')} 
              className="w-full bg-fondo border border-borde rounded-xl px-4 py-3 text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none transition-all placeholder:text-suave/50"
              placeholder="Ej. Carlos Pérez"
              autoFocus
            />
            {form.formState.errors.nombre && <p className="text-xs text-peligro px-1">{form.formState.errors.nombre.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-suave uppercase ml-1">Salario mensual *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suave/50">$</span>
                <input 
                  type="number"
                  {...form.register('salario', { valueAsNumber: true })} 
                  className="w-full bg-fondo border border-borde rounded-xl pl-8 pr-4 py-3 text-texto focus:border-primario focus:ring-1 focus:ring-primario outline-none"
                />
              </div>
              {form.formState.errors.salario && <p className="text-xs text-peligro px-1">{form.formState.errors.salario.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-suave uppercase ml-1">Fecha Ingreso *</label>
              <input 
                type="date"
                {...form.register('fechaIngreso')} 
                className="w-full bg-fondo border border-borde rounded-xl px-3 py-3 text-texto focus:border-primario outline-none"
              />
              {form.formState.errors.fechaIngreso && <p className="text-xs text-peligro px-1">{form.formState.errors.fechaIngreso.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-suave uppercase ml-1">Tipo contrato *</label>
            <select 
              {...form.register('tipoContrato')} 
              className="w-full bg-fondo border border-borde rounded-xl px-4 py-3 text-texto focus:border-primario outline-none appearance-none"
            >
              <option value="indefinido">Indefinido</option>
              <option value="fijo">Término fijo</option>
              <option value="obra_labor">Obra o labor</option>
            </select>
          </div>

          <div className="pt-2 border-t border-borde/50">
            <p className="text-[10px] font-bold text-suave uppercase tracking-wider mb-3">Datos opcionales</p>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-suave uppercase ml-1">Cédula</label>
                <input 
                  {...form.register('cedula')} 
                  className="w-full bg-fondo border border-borde rounded-xl px-3 py-2 text-sm text-texto focus:border-primario outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-suave uppercase ml-1">Teléfono</label>
                <input 
                  type="tel"
                  {...form.register('telefono')} 
                  className="w-full bg-fondo border border-borde rounded-xl px-3 py-2 text-sm text-texto focus:border-primario outline-none"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-suave uppercase ml-1">Cargo</label>
              <input 
                {...form.register('cargo')} 
                placeholder="Ej. Cajero, Auxiliar..."
                className="w-full bg-fondo border border-borde rounded-xl px-3 py-2 text-sm text-texto focus:border-primario outline-none"
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-borde flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-texto bg-fondo rounded-xl font-bold">
              Cancelar
            </button>
            <button type="submit" disabled={form.formState.isSubmitting} className="flex-1 py-3 bg-primario text-white rounded-xl font-bold flex justify-center disabled:opacity-50">
              {form.formState.isSubmitting ? '...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
