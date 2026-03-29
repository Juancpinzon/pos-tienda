import { Delete } from 'lucide-react'

interface TecladoNumericoProps {
  /** Valor actual como string de dígitos, sin formato. Ej: "45000" */
  valor: string
  onChange: (valor: string) => void
  className?: string
}

const TECLAS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '000', '0', '⌫'] as const

/**
 * Teclado numérico táctil para ingreso de montos.
 * El valor siempre es un string de dígitos sin separadores.
 */
export function TecladoNumerico({ valor, onChange, className = '' }: TecladoNumericoProps) {
  const presionar = (tecla: string) => {
    if (tecla === '⌫') {
      onChange(valor.slice(0, -1))
      return
    }
    if (tecla === '000') {
      // No agregar ceros si el campo está vacío
      if (!valor) return
      onChange(valor + '000')
      return
    }
    // Evitar cero inicial doble ("00" → solo "0")
    if (valor === '0' && tecla === '0') return
    // Reemplazar el cero inicial solitario
    const nuevo = valor === '0' ? tecla : valor + tecla
    // Límite de 9 dígitos (~$999.999.999)
    if (nuevo.length > 9) return
    onChange(nuevo)
  }

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {TECLAS.map((tecla) => (
        <button
          key={tecla}
          type="button"
          onPointerDown={(e) => {
            e.preventDefault() // Evita que el input pierda focus en iPad
            presionar(tecla)
          }}
          className={[
            'h-14 rounded-xl font-display font-bold text-xl select-none',
            'transition-all active:scale-90 active:brightness-90',
            tecla === '⌫'
              ? 'bg-red-50 text-peligro hover:bg-red-100'
              : 'bg-gray-100 text-texto hover:bg-gray-200',
          ].join(' ')}
        >
          {tecla === '⌫' ? <Delete size={20} className="mx-auto" /> : tecla}
        </button>
      ))}
    </div>
  )
}
