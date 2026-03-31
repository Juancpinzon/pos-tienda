import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.postienda.app',
  appName: 'POS Tienda',
  webDir: 'dist',
  // Permite que el Service Worker de la PWA funcione dentro del WebView nativo
  server: {
    androidScheme: 'https',
    // En desarrollo local, descomentar para apuntar al dev server:
    // url: 'http://192.168.1.X:5173',
    // cleartext: true,
  },
  plugins: {
    // Pantalla de splash nativa
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#1E3A5F',
      splashFullScreen: true,
      splashImmersive: true,
    },
    // Notificaciones push nativas (Android)
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  // Configuración específica Android
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // true solo en desarrollo
  },
};

export default config;
