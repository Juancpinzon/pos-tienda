// Hook para detectar el evento de instalación PWA y mostrar el banner.
// En entorno Capacitor (app nativa) este hook no tiene efecto.
import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWAInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [instalada, setInstalada] = useState(false)

  useEffect(() => {
    // Detectar si ya está instalada (modo standalone)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalada(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalada(true))

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const instalar = async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') setInstalada(true)
    setPromptEvent(null)
  }

  const descartar = () => setPromptEvent(null)

  return { puedeInstalar: !!promptEvent && !instalada, instalar, descartar }
}
