// Modal para completar los detalles de un pedido a domicilio
// Se abre justo después de confirmar una venta con canal='domicilio'

import { useState } from 'react'
import { X, MapPin, Phone, User, Bike, CheckCircle2 } from 'lucide-react'
import { usePedidosDomicilio } from '../../hooks/useDomicilios'
import { formatCOP } from '../../utils/moneda'
import toast from 'react-hot-toast'

interface ModalPedidoDomicilioProps {
  ventaId: number
  totalVenta: number
  /** Dirección capturada en el selector rápido del ModalCobro */
  direccionInicial?: string
  /** Nombre del cliente si era fiado */
  nombreClienteInicial?: string
  onGuardado: () => void
  onSaltar: () => void
}

const INPUT_CLS =
  'w-full h-14 px-3 border border-borde rounded-xl text-sm text-texto ' +
  'focus:outline-none focus:ring-2 focus:ring-acento/40 focus:border-acento ' +
  'placeholder:text-suave'

export function ModalPedidoDomicilio({
  ventaId,
  totalVenta,
  direccionInicial = '',
  nombreClienteInicial = '',
  onGuardado,
  onSaltar,
}: ModalPedidoDomicilioProps) {
  const { crearPedido } = usePedidosDomicilio()

  const [nombre,      setNombre]      = useState(nombreClienteInicial)
  const [telefono,    setTelefono]    = useState('')
  const [direccion,   setDireccion]   = useState(direccionInicial)
  const [barrio,      setBarrio]      = useState('')
  const [indicaciones,setIndicaciones]= useState('')
  const [repartidor,  setRepartidor]  = useState('')
  const [costoEnvio,  setCostoEnvio]  = useState('5000')
  const [guardando,   setGuardando]   = useState(false)

  const handleGuardar = async () => {
    if (!nombre.trim()) {
      toast.error('Ingresa el nombre del cliente')
      return
    }
    if (!direccion.trim()) {
      toast.error('Ingresa la dirección de entrega')
      return
    }

    setGuardando(true)
    try {
      await crearPedido({
        ventaId,
        nombre: nombre.trim(),
        telefono: telefono.trim() || undefined,
        direccion: direccion.trim(),
        barrio: barrio.trim() || undefined,
        indicaciones: indicaciones.trim() || undefined,
        repartidor: repartidor.trim() || undefined,
        costoEnvio: parseInt(costoEnvio.replace(/\D/g, ''), 10) || 0,
        estado: 'pendiente',
        sesionCajaId: undefined,
      })
      toast.success('Pedido registrado')
      onGuardado()
    } catch {
      toast.error('Error al guardar el pedido')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-borde shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛵</span>
            <div>
              <h3 className="font-display font-bold text-base text-texto">Datos del domicilio</h3>
              <p className="text-xs text-suave">Venta {formatCOP(totalVenta)} · Registra dónde entregar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSaltar}
            className="w-9 h-9 flex items-center justify-center rounded-xl
                       text-suave hover:text-texto hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">

          {/* Nombre */}
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave pointer-events-none" />
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del cliente *"
              className={`${INPUT_CLS} pl-9`}
              autoFocus
            />
          </div>

          {/* Teléfono */}
          <div className="relative">
            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave pointer-events-none" />
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Teléfono (opcional)"
              className={`${INPUT_CLS} pl-9`}
            />
          </div>

          {/* Dirección */}
          <div className="relative">
            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave pointer-events-none" />
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Dirección de entrega *"
              className={`${INPUT_CLS} pl-9`}
            />
          </div>

          {/* Barrio */}
          <input
            type="text"
            value={barrio}
            onChange={(e) => setBarrio(e.target.value)}
            placeholder="Barrio o sector (opcional)"
            className={INPUT_CLS}
          />

          {/* Indicaciones */}
          <textarea
            value={indicaciones}
            onChange={(e) => setIndicaciones(e.target.value)}
            placeholder="Indicaciones: apto, color de puerta, punto de referencia…"
            rows={2}
            className="w-full px-3 py-3 border border-borde rounded-xl text-sm text-texto resize-none
                       focus:outline-none focus:ring-2 focus:ring-acento/40 focus:border-acento
                       placeholder:text-suave"
          />

          {/* Repartidor + Costo envío */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Bike size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-suave pointer-events-none" />
              <input
                type="text"
                value={repartidor}
                onChange={(e) => setRepartidor(e.target.value)}
                placeholder="Repartidor"
                className="w-full h-14 pl-9 pr-3 border border-borde rounded-xl text-sm text-texto
                           focus:outline-none focus:ring-2 focus:ring-acento/40 focus:border-acento
                           placeholder:text-suave"
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suave text-sm font-medium pointer-events-none">$</span>
              <input
                type="number"
                value={costoEnvio}
                onChange={(e) => setCostoEnvio(e.target.value)}
                placeholder="Envío"
                min={0}
                step={500}
                className="w-full h-14 pl-7 pr-3 border border-borde rounded-xl text-sm text-texto moneda
                           focus:outline-none focus:ring-2 focus:ring-acento/40 focus:border-acento
                           placeholder:text-suave"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-borde flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando}
            className="w-full h-14 bg-acento text-white rounded-xl font-display font-bold text-base
                       flex items-center justify-center gap-2
                       hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
          >
            {guardando
              ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <CheckCircle2 size={20} />}
            {guardando ? 'Guardando…' : 'Registrar pedido'}
          </button>
          <button
            type="button"
            onClick={onSaltar}
            className="w-full h-11 border border-borde text-suave rounded-xl text-sm font-semibold
                       hover:bg-fondo active:scale-95 transition-all"
          >
            Saltar por ahora
          </button>
        </div>
      </div>
    </div>
  )
}
