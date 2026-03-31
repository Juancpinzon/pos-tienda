/**
 * useCapacitor — Detecta si la app corre en entorno nativo (Android/iOS) o web.
 * Uso: const { isNative, platform } = useCapacitor()
 */
import { useMemo } from 'react';

// Detección segura: Capacitor puede no estar disponible en el build web
const getCapacitor = () => {
  if (typeof window !== 'undefined' && (window as Window & { Capacitor?: { isNativePlatform: () => boolean; getPlatform: () => string } }).Capacitor) {
    return (window as Window & { Capacitor?: { isNativePlatform: () => boolean; getPlatform: () => string } }).Capacitor!;
  }
  return null;
};

export type Platform = 'android' | 'ios' | 'web';

interface UseCapacitorReturn {
  /** True cuando corre dentro de un WebView nativo de Capacitor */
  isNative: boolean;
  /** Plataforma actual: 'android', 'ios' o 'web' */
  platform: Platform;
  /** True cuando corre en Android nativo */
  isAndroid: boolean;
  /** True cuando corre en iOS nativo */
  isIOS: boolean;
}

export function useCapacitor(): UseCapacitorReturn {
  return useMemo(() => {
    const cap = getCapacitor();
    const isNative = cap?.isNativePlatform() ?? false;
    const rawPlatform = cap?.getPlatform() ?? 'web';
    const platform = (['android', 'ios', 'web'].includes(rawPlatform)
      ? rawPlatform
      : 'web') as Platform;

    return {
      isNative,
      platform,
      isAndroid: platform === 'android',
      isIOS: platform === 'ios',
    };
  }, []);
}
