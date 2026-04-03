// CuentasPanel.tsx — Panel de cuentas abiertas (comandas / ventas por rondas)
//
// Solo visible para dueño y encargado.
// Permite crear, ver y seleccionar cuentas abiertas para acumular productos.

import { useState } from 'react'
import { X, Plus, ChevronRight, Trash2, ClipboardList } from 'lucide-react'
import {
  useCuentasAbiertas,
  abrirCuenta,
  eliminarCuenta,
  sugerirNombreCuenta,
} from '../../hooks/useCuentasAbiertas'
import { formatCOP } from '../../utils/moneda'
import type { CuentaAbierta } from '../../db/schema'

// ─── Props ────────────────────────────────────────────────────────────────────

interface CuentasPanelProps {
  cuentaActivaId: number | null
  sesionCajaId: number | undefined
  onSeleccionarCuenta: (cuenta: CuentaAbierta) => void
  onClose: () => void
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CuentasPanel({
  cuentaActivaId,
  sesionCajaId,
  onSeleccionarCuenta,
  onClose,
}: CuentasPanelProps) {
  const cuentas = useCuentasAbiertas()

  const [nombreNueva,    setNombreNueva]    = useState('')
  const [mostrarFormNueva, setMostrarFormNueva] = useState(false)
  const [creando,        setCreando]        = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState<number | null>(null)

  const handleAbrirFormNueva = async () => {
    const sugerido = await sugerirNombreCuenta()
    setNombreNueva(sugerido)
    setMostrarFormNueva(true)
  }

  const handleCrear = async () => {
    if (!nombreNueva.trim()) return
    setCreando(true)
    try {
      const id = await abrirCuenta(nombreNueva, sesionCajaId)
      // Seleccionar la nueva cuenta de inmediato
      const nueva: CuentaAbierta = {
        id,
        nombre: nombreNueva.trim(),
        items: [],
        total: 0,
        estado: 'abierta',
        sesionCajaId,
        creadaEn: new Date(),
        actualizadoEn: new Date(),
      }
      onSeleccionarCuenta(nueva)
      setMostrarFormNueva(false)
      setNombreNueva('')
      onClose()
    } finally {
      setCreando(false)
    }
  }

  const handleEliminar = async (id: number) => {
    await eliminarCuenta(id)
    setConfirmEliminar(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-borde shrink-0">
          <div className="flex items-center gap-3">
            <ClipboardList size={20} className="text-primario" />
            <div>
              <h2 className="font-display font-bold text-lg text-texto leading-tight">
                Cuentas abiertas
              </h2>
              {cuentas && cuentas.length > 0 && (
                <p className="text-xs text-suave">
                  {cuentas.length} cuenta{cuentas.length !== 1 ? 's' : ''} activa{cuentas.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl
                       text-suave hover:text-texto hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Lista de cuentas */}
        <div className="flex-1 overflow-y-auto">
          {!cuentas ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-primario/30 border-t-primario rounded-full animate-spin" />
            </div>
          ) : cuentas.length === 0 && !mostrarFormNueva ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-suave/50">
              <ClipboardList size={40} strokeWidth={1} />
              <div className="text-center">
                <p className="text-sm font-medium">Sin cuentas abiertas</p>
                <p className="text-xs mt-1">Crea una para acumular pedidos</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-borde/30">
              {cuentas.map((cuenta) => {
                const esActiva = cuenta.id === cuentaActivaId
                const cantItems = cuenta.items.reduce((s, i) => s + i.cantidad, 0)
                return (
                  <div
                    key={cuenta.id}
                    className={[
                      'flex items-center gap-3 px-4 py-3.5 transition-colors',
                      esActiva ? 'bg-primario/5' : 'hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {/* Info de la cuenta */}
                    <button
                      type="button"
                      onClick={() => { onSeleccionarCuenta(cuenta); onClose() }}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <div className={[
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg',
                        esActiva ? 'bg-primario/15' : 'bg-gray-100',
                      ].join(' ')}>
                        {cuenta.nombre.startsWith('Mesa') ? '🍺' :
                         cuenta.nombre.toLowerCase().includes('barra') ? '🪑' : '👤'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-texto truncate">{cuenta.nombre}</p>
                          {esActiva && (
                            <span className="text-[10px] font-bold text-primario bg-primario/10 px-1.5 py-0.5 rounded-full shrink-0">
                              ACTIVA
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-suave mt-0.5">
                          {cantItems === 0
                            ? 'Sin productos aún'
                            : `${Math.round(cantItems * 10) / 10} producto${cantItems !== 1 ? 's' : ''} · ${formatCOP(cuenta.total)}`}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-suave/50 shrink-0" />
                    </button>

                    {/* Botón eliminar */}
                    {confirmEliminar === cuenta.id ? (
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEliminar(cuenta.id!)}
                          className="h-7 px-2.5 rounded-lg text-xs font-bold bg-peligro text-white active:scale-95"
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmEliminar(null)}
                          className="h-7 px-2.5 rounded-lg text-xs border border-borde text-suave"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmEliminar(cuenta.id!)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg
                                   text-suave/40 hover:text-peligro hover:bg-peligro/8 transition-colors shrink-0"
                        title="Eliminar cuenta"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Formulario nueva cuenta */}
          {mostrarFormNueva && (
            <div className="px-4 py-4 border-t border-borde bg-fondo/50 flex flex-col gap-3">
              <p className="text-sm font-semibold text-texto">Nueva cuenta</p>
              <input
                type="text"
                value={nombreNueva}
                onChange={(e) => setNombreNueva(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCrear()}
                placeholder="Mesa 1, Don Carlos, La barra…"
                autoFocus
                maxLength={40}
                className="w-full h-11 px-3 border border-borde rounded-xl text-base text-texto
                           focus:outline-none focus:ring-2 focus:ring-primario/40 focus:border-primario
                           placeholder:text-suave"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setMostrarFormNueva(false); setNombreNueva('') }}
                  className="flex-1 h-10 border border-borde text-suave rounded-xl text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCrear}
                  disabled={!nombreNueva.trim() || creando}
                  className="flex-1 h-10 bg-primario text-white rounded-xl text-sm font-semibold
                             hover:bg-primario-hover active:scale-95 transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {creando ? 'Creando…' : 'Crear y abrir'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-borde shrink-0">
          {!mostrarFormNueva && (
            <button
              type="button"
              onClick={handleAbrirFormNueva}
              className="w-full h-12 bg-primario text-white rounded-xl font-display font-bold
                         flex items-center justify-center gap-2
                         hover:bg-primario-hover active:scale-95 transition-all"
            >
              <Plus size={18} />
              Nueva cuenta
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
