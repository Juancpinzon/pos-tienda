/**
 * Componente de estado vacío reutilizable con ilustración emoji.
 * Cumple con el principio de UX: siempre dar contexto cuando no hay datos.
 */
export function EstadoVacio({
  emoji,
  titulo,
  descripcion,
  accion,
}: {
  emoji: string
  titulo: string
  descripcion?: string
  accion?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 gap-3 text-center">
      <span className="text-5xl leading-none">{emoji}</span>
      <p className="font-display font-bold text-base text-texto">{titulo}</p>
      {descripcion && (
        <p className="text-sm text-suave max-w-xs leading-relaxed">{descripcion}</p>
      )}
      {accion && <div className="mt-1">{accion}</div>}
    </div>
  )
}
