// Hook para el estado de sincronización — muestra 🟢 / 🟡 / 🔴 en el header

import { useState, useEffect } from 'react'
import { supabaseConfigurado } from '../lib/supabase'
import { getLastSyncAt } from '../lib/sync'

export type EstadoSync = 'sincronizado' | 'pendiente' | 'sin_internet' | 'desactivado'

interface SyncStatus {
  estado: EstadoSync
  ultimaSync: Date | null
  online: boolean
}

export function useSyncStatus(): SyncStatus {
  const [online, setOnline] = useState(navigator.onLine)
  const [ultimaSync, setUltimaSync] = useState<Date | null>(getLastSyncAt)

  useEffect(() => {
    const handleOnline  = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    // Actualizar ultimaSync cada 15s para que el indicador refresque
    const interval = setInterval(() => {
      setUltimaSync(getLastSyncAt())
    }, 15_000)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  if (!supabaseConfigurado) {
    return { estado: 'desactivado', ultimaSync: null, online }
  }

  if (!online) {
    return { estado: 'sin_internet', ultimaSync, online }
  }

  if (!ultimaSync) {
    return { estado: 'pendiente', ultimaSync: null, online }
  }

  // Si la última sync fue hace menos de 2 minutos → sincronizado
  const hace2Min = new Date(Date.now() - 2 * 60_000)
  if (ultimaSync > hace2Min) {
    return { estado: 'sincronizado', ultimaSync, online }
  }

  return { estado: 'pendiente', ultimaSync, online }
}
