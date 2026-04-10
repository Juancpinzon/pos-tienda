import { AlertTriangle, Clock, Trash2, TrendingDown } from 'lucide-react'
import { useProductosPorVencer, type ProductoPorVencer } from '../../hooks/useStock'
import { useState } from 'react'
import { FormProducto } from '../productos/FormProducto'
import { ModalRegistrarMerma } from './ModalRegistrarMerma'

export function AlertasCaducidad() {
  const productosPorVencer = useProductosPorVencer()
  const [productoEditar, setProductoEditar] = useState<ProductoPorVencer | null>(null)
  const [mostrarModalMerma, setMostrarModalMerma] = useState(false)
  const [productoMerma, setProductoMerma] = useState<ProductoPorVencer | null>(null)

  if (!productosPorVencer || productosPorVencer.length === 0) return null

  // Filtrar solo los críticos o vencidos para el banner principal
  const criticosOVencidos = productosPorVencer.filter(p => p.estadoCaducidad !== 'proximo')
  
  if (criticosOVencidos.length === 0) return null

  return (
    <div className="flex flex-col gap-3 mb-5">
      <div className="flex items-center gap-2 px-1">
        <AlertTriangle size={16} className="text-peligro" />
        <h3 className="text-sm font-bold text-texto uppercase tracking-wider">Alertas de Caducidad</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {criticosOVencidos.map((p) => (
          <TarjetaAlertaCaducidad 
            key={p.id} 
            producto={p} 
            onRemate={() => setProductoEditar(p)}
            onMerma={() => {
              setProductoMerma(p)
              setMostrarModalMerma(true)
            }}
          />
        ))}
      </div>

      {/* Ver todos si hay más de los críticos */}
      {productosPorVencer.length > criticosOVencidos.length && (
        <p className="text-center text-xs text-suave py-1 italic">
          Hay {productosPorVencer.length - criticosOVencidos.length} productos adicionales que vencen este mes.
        </p>
      )}

      {/* Modales */}
      {productoEditar && (
        <FormProducto 
          producto={productoEditar} 
          onClose={() => setProductoEditar(null)} 
        />
      )}

      {mostrarModalMerma && (
        <ModalRegistrarMerma 
          productoInicial={productoMerma}
          onClose={() => {
            setMostrarModalMerma(false)
            setProductoMerma(null)
          }} 
        />
      )}
    </div>
  )
}

function TarjetaAlertaCaducidad({ 
  producto, 
  onRemate, 
  onMerma 
}: { 
  producto: ProductoPorVencer, 
  onRemate: () => void, 
  onMerma: () => void 
}) {
  const esVencido = producto.estadoCaducidad === 'vencido'
  const colorBase = esVencido ? 'border-peligro bg-red-50' : 'border-advertencia bg-amber-50'
  const colorTexto = esVencido ? 'text-peligro' : 'text-advertencia'
  const Icono = esVencido ? AlertTriangle : Clock

  return (
    <div className={`rounded-2xl border ${colorBase} p-4 flex flex-col gap-3 shadow-sm`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-suave mb-0.5">
            {esVencido ? '⚠️ PRODUCTO VENCIDO' : '⏳ VENCE PRONTO'}
          </p>
          <h4 className="font-display font-bold text-texto text-base">{producto.nombre}</h4>
          <p className="text-xs text-suave">
            Lote: {producto.loteNumero || '—'} · Stock: <span className="font-bold text-texto">{producto.stockActual}</span>
          </p>
        </div>
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${esVencido ? 'bg-peligro/10' : 'bg-advertencia/10'}`}>
          <Icono size={20} className={colorTexto} />
        </div>
      </div>

      <div className="flex items-center gap-2 py-1 px-3 rounded-lg bg-white/50 border border-current border-opacity-10">
        <Clock size={14} className={colorTexto} />
        <p className={`text-sm font-semibold ${colorTexto}`}>
          {esVencido 
            ? `Venció hace ${Math.abs(producto.diasParaVencer)} días` 
            : `Vence en ${producto.diasParaVencer} días (${new Date(producto.fechaVencimiento!).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })})`
          }
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1">
        <button
          onClick={onMerma}
          className="h-10 px-3 bg-white text-peligro border border-peligro/30 rounded-xl text-xs font-bold
                     flex items-center justify-center gap-1.5 hover:bg-peligro/5 transition-colors"
        >
          <Trash2 size={13} />
          Registrar Merma
        </button>
        {!esVencido && (
          <button
            onClick={onRemate}
            className="h-10 px-3 bg-primario text-white rounded-xl text-xs font-bold
                       flex items-center justify-center gap-1.5 hover:bg-primario-hover transition-colors"
          >
            <TrendingDown size={13} />
            Hacer Remate
          </button>
        )}
        {esVencido && (
          <div className="h-10 flex items-center justify-center text-[10px] text-suave italic text-center leading-tight">
            No apto para la venta. Debe retirarse.
          </div>
        )}
      </div>
    </div>
  )
}
