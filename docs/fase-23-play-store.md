# Fase 23 — Publicación en Google Play Store
## POS Tienda de Barrio (com.postienda.app)

---

## Prerrequisitos

| Herramienta | Versión mínima | Descarga |
|-------------|---------------|---------|
| Android Studio | Hedgehog 2023.1+ | [developer.android.com](https://developer.android.com/studio) |
| JDK | 17 (incluido en Android Studio) | Automático |
| Node.js | 18+ | Ya instalado |
| Cuenta Google Play Console | — | $25 USD único pago |

---

## 1. Flujo de trabajo diario (después del setup inicial)

Cada vez que tengas cambios en el código:

```bash
# 1. Build del proyecto React
npm run build

# 2. Sincronizar con Android (copia dist/ al WebView)
npx cap sync android

# 3. Abrir Android Studio (opcional, para correr en emulador)
npx cap open android
```

---

## 2. Setup inicial (solo una vez)

### 2.1 Abrir en Android Studio

```bash
npx cap open android
```

Android Studio se abre con el proyecto en `android/`. Espera a que termine el Gradle sync (barra de progreso inferior).

### 2.2 Verificar en emulador

1. **Tools → Device Manager** → Crear emulador API 34 (Android 14)
2. Presionar ▶ **Run** — la app debe cargar el WebView con el POS
3. Verificar que el POS funciona offline dentro de la app

---

## 3. Generar APK firmado (para distribuir)

### 3.1 Crear Keystore (solo una vez — ¡GUARDAR EN LUGAR SEGURO!)

```bash
# En Android Studio: Build → Generate Signed Bundle/APK
# O por línea de comandos:
keytool -genkey -v -keystore pos-tienda-release.keystore \
  -alias pos-tienda -keyalg RSA -keysize 2048 -validity 10000
```

> ⚠️ **CRÍTICO**: Guarda `pos-tienda-release.keystore` y sus contraseñas. Sin este archivo no podrás actualizar la app en Play Store.

### 3.2 Configurar firma en Android Studio

1. `Build → Generate Signed Bundle/APK`
2. Seleccionar **Android App Bundle (.aab)** (recomendado para Play Store)
3. Seleccionar el keystore creado
4. Flavor: `release`
5. Click **Finish** — genera `android/app/release/app-release.aab`

### 3.3 APK para distribución directa (sin Play Store)

1. Igual al paso anterior pero seleccionar **APK**
2. El archivo queda en `android/app/release/app-release.apk`
3. Para instalar directo en celular: habilitar "Instalar apps de fuentes desconocidas"

---

## 4. Publicar en Google Play Store

### 4.1 Crear cuenta en Play Console

1. Ir a [play.google.com/console](https://play.google.com/console)
2. Pagar $25 USD (pago único)
3. Completar el perfil de desarrollador

### 4.2 Crear la aplicación

1. **Crear app** → Nombre: "POS Tienda de Barrio"
2. Idioma predeterminado: Español (Colombia)
3. App o Juego: **App**
4. Gratis o de pago: **Gratis**

### 4.3 Completar ficha de Play Store

| Campo | Contenido sugerido |
|-------|-------------------|
| Nombre corto | POS Tienda |
| Descripción corta | Punto de venta para tiendas de barrio — funciona sin internet |
| Descripción larga | Sistema de punto de venta diseñado para tenderos colombianos. Registra ventas en efectivo, a crédito (fiado) y por transferencia. Funciona completamente sin internet. Gestiona tu inventario, clientes y caja diaria desde tu celular. |
| Categoría | Negocios |
| Icono | 512×512 px (usar `/public/icons/icon-512.png`) |
| Screenshots | Mínimo 2 de teléfono (1080×1920 px recomendado) |
| Feature Graphic | 1024×500 px |

### 4.4 Subir el AAB

1. `Producción → Crear nueva versión`
2. Subir `app-release.aab`
3. Notas de la versión: "Primera versión — POS offline para tiendas de barrio"
4. Review → **Guardar**

### 4.5 Configuración de contenido

- **Clasificación de contenido**: Completar el cuestionario (app de negocios, sin violencia ni contenido adulto)
- **Política de privacidad**: Necesaria si manejas datos de usuarios
  - Mínimo: "Esta app almacena datos localmente en el dispositivo. No enviamos información a servidores externos sin tu consentimiento."
- **Público objetivo**: Mayores de 13 años / Todos

### 4.6 Enviar para revisión

1. Revisar todos los requisitos (Play Console muestra alertas)
2. Click **Enviar para revisión**
3. Tiempo de revisión: **3-7 días hábiles** (primera vez puede ser hasta 14 días)

---

## 5. Permisos Android requeridos

Los siguientes permisos se configuran automáticamente en `android/app/src/main/AndroidManifest.xml` por los plugins de Capacitor:

```xml
<!-- Notificaciones push -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>

<!-- Bluetooth para impresoras térmicas -->
<uses-permission android:name="android.permission.BLUETOOTH"/>
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"/>

<!-- Internet → Supabase sync cuando hay wifi -->
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
```

> Verifica que estos permisos están en el AndroidManifest.xml después de `npx cap sync`.

---

## 6. Actualizaciones futuras

```bash
# Cada actualización:
npm run build
npx cap sync android
# Android Studio → Build → Generate Signed Bundle/APK
# Play Console → Producción → Crear nueva versión → subir nuevo .aab
```

Las actualizaciones en Play Store se aprueban en 2-4 horas (vs. semanas en App Store).

---

## 7. Distribución alternativa sin Play Store

Para instalar directo sin pasar por Play Store:

```bash
# Conectar celular por USB (con depuración USB activada)
npx cap run android --target [DEVICE_ID]

# O copiar el APK y enviar por WhatsApp al tendero
```

---

*Documento generado en Fase 23 — Marzo 2026*
