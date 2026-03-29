interface CategoriaChipProps {
  emoji: string
  nombre: string
  /** Contador opcional de productos en esta categoría */
  count?: number
  selected?: boolean
  onClick?: () => void
}

/**
 * Chip de filtro por categoría con emoji + nombre + contador opcional.
 * Toque mínimo garantizado por h-9 (36px) + padding horizontal generoso.
 */
export function CategoriaChip({ emoji, nombre, count, selected, onClick }: CategoriaChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 px-3 h-9 rounded-full border text-sm font-medium',
        'shrink-0 transition-all active:scale-95 select-none',
        selected
          ? 'bg-primario text-white border-primario shadow-sm'
          : 'bg-white text-texto border-borde hover:border-primario/60 hover:text-primario',
      ].join(' ')}
    >
      <span className="text-base leading-none">{emoji}</span>
      <span className="leading-none">{nombre}</span>
      {count !== undefined && (
        <span
          className={[
            'text-xs rounded-full px-1.5 leading-5 font-bold ml-0.5 min-w-[20px] text-center',
            selected ? 'bg-white/25 text-white' : 'bg-gray-100 text-suave',
          ].join(' ')}
        >
          {count}
        </span>
      )}
    </button>
  )
}
