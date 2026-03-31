/**
 * usePushNotifications — Notificaciones push con soporte dual:
 * - Nativo (Android): usa @capacitor/push-notifications
 * - Web (PWA): usa la Web Push API + Service Worker
 *
 * Regla: nunca bloquear la app si las notificaciones no están disponibles.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCapacitor } from './useCapacitor';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unavailable';

interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface UsePushNotificationsReturn {
  permission: PermissionStatus;
  isRegistered: boolean;
  /** Solicita permiso y registra el dispositivo para recibir notificaciones */
  requestPermission: () => Promise<PermissionStatus>;
  /** Envía una notificación local (sin servidor) — útil para alertas de stock */
  sendLocal: (payload: PushNotificationPayload) => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { isNative, isAndroid } = useCapacitor();
  const [permission, setPermission] = useState<PermissionStatus>('prompt');
  const [isRegistered, setIsRegistered] = useState(false);
  const initializedRef = useRef(false);

  // ─── Inicialización ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (isNative && isAndroid) {
      initNative();
    } else {
      initWeb();
    }
  }, [isNative, isAndroid]);

  // ─── Nativo: @capacitor/push-notifications ─────────────────────────────────

  const initNative = async () => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      const status = await PushNotifications.checkPermissions();
      setPermission(status.receive as PermissionStatus);

      if (status.receive === 'granted') {
        await PushNotifications.register();
        setIsRegistered(true);
      }

      // Listener: registro exitoso
      await PushNotifications.addListener('registration', (token) => {
        console.log('[PushNotif] Token nativo:', token.value);
        setIsRegistered(true);
      });

      // Listener: error de registro
      await PushNotifications.addListener('registrationError', (err) => {
        console.error('[PushNotif] Error registro:', err.error);
      });

      // Listener: notificación recibida con app abierta
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[PushNotif] Recibida:', notification);
      });
    } catch (error) {
      console.warn('[PushNotif] Plugin nativo no disponible:', error);
      setPermission('unavailable');
    }
  };

  const requestPermissionNative = useCallback(async (): Promise<PermissionStatus> => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const result = await PushNotifications.requestPermissions();
      const status = result.receive as PermissionStatus;
      setPermission(status);

      if (status === 'granted') {
        await PushNotifications.register();
        setIsRegistered(true);
      }
      return status;
    } catch {
      return 'unavailable';
    }
  }, []);

  const sendLocalNative = useCallback(async (payload: PushNotificationPayload): Promise<void> => {
    // En Capacitor no hay "local notifications" incluidas por defecto sin
    // @capacitor/local-notifications. Usamos la Web Notification API como fallback
    // ya que el WebView la soporta en Android.
    sendLocalWeb(payload);
  }, []);

  // ─── Web: Web Push API ──────────────────────────────────────────────────────

  const initWeb = async () => {
    if (!('Notification' in window)) {
      setPermission('unavailable');
      return;
    }
    const current = Notification.permission;
    setPermission(current === 'default' ? 'prompt' : (current as PermissionStatus));
    if (current === 'granted') setIsRegistered(true);
  };

  const requestPermissionWeb = useCallback(async (): Promise<PermissionStatus> => {
    if (!('Notification' in window)) return 'unavailable';
    const result = await Notification.requestPermission();
    const status = result === 'default' ? 'prompt' : (result as PermissionStatus);
    setPermission(status);
    if (status === 'granted') setIsRegistered(true);
    return status;
  }, []);

  const sendLocalWeb = (payload: PushNotificationPayload) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: payload.data,
    });
  };

  // ─── API pública unificada ──────────────────────────────────────────────────

  const requestPermission = useCallback(async (): Promise<PermissionStatus> => {
    if (isNative && isAndroid) return requestPermissionNative();
    return requestPermissionWeb();
  }, [isNative, isAndroid, requestPermissionNative, requestPermissionWeb]);

  const sendLocal = useCallback(async (payload: PushNotificationPayload): Promise<void> => {
    if (isNative && isAndroid) return sendLocalNative(payload);
    sendLocalWeb(payload);
  }, [isNative, isAndroid, sendLocalNative]);

  return { permission, isRegistered, requestPermission, sendLocal };
}
