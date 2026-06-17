# Guía de Deploy — POS Tienda de Barrio

> Para uso interno. Cubre Vercel, Supabase, Edge Functions y Android.
> Actualizado: junio 2026

---

## Índice

1. [Prerequisitos](#1-prerequisitos)
2. [Vercel — Deploy web / PWA](#2-vercel--deploy-web--pwa)
3. [Supabase — Base de datos en nube](#3-supabase--base-de-datos-en-nube)
4. [Edge Functions](#4-edge-functions)
5. [Variables de entorno (referencia completa)](#5-variables-de-entorno)
6. [Capacitor Android](#6-capacitor-android)
7. [Flujo de deploy habitual](#7-flujo-de-deploy-habitual)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisitos

```
Node.js 18+
npm 9+
Git
Supabase CLI   → npm install -g supabase
Vercel CLI     → npm install -g vercel   (solo para deploys manuales)
```

Cuentas necesarias:
- [vercel.com](https://vercel.com) — cuenta gratuita sirve
- [supabase.com](https://supabase.com) — cuenta gratuita sirve para producción con tráfico bajo
- [github.com/Juancpinzon/pos-tienda](https://github.com/Juancpinzon/pos-tienda) — acceso push a `main`

---

## 2. Vercel — Deploy web / PWA

### Configuración del proyecto

El proyecto ya está conectado a Vercel. El deploy es automático: **push a `main` = nuevo deploy en ~60 segundos**.

URL de producción: **[pos-tienda-ten.vercel.app](https://pos-tienda-ten.vercel.app)**

### Configuración en el dashboard de Vercel

| Campo | Valor |
|-------|-------|
| Framework Preset | Vite |
| Build Command | `vite build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Node.js Version | 18.x |

> **CRÍTICO:** El build command debe ser `vite build`, NO `tsc -b && vite build`.
> `tsc -b` lanza warnings como errores en Vercel y rompe el build.

### Variables de entorno en Vercel

Ir a: Vercel Dashboard → pos-tienda → Settings → Environment Variables

```
VITE_SUPABASE_URL          → URL del proyecto Supabase
VITE_SUPABASE_ANON_KEY     → Anon key (formato eyJ..., NO el formato sb_publishable_)
```

Las variables `VITE_` son públicas (quedan en el bundle del cliente). La `ANTHROPIC_API_KEY` **nunca** va aquí — vive en Supabase como secret de Edge Functions.

### Deploy manual (si el automático falla)

```bash
npm run build
vercel --prod
```

---

## 3. Supabase — Base de datos en nube

### Proyecto activo

- **URL:** `https://kzyebyztrlupzoyvqyhq.supabase.co`
- **Dashboard:** [supabase.com/dashboard/project/kzyebyztrlupzoyvqyhq](https://supabase.com/dashboard/project/kzyebyztrlupzoyvqyhq)

### Aplicar migraciones nuevas

Las migraciones viven en `supabase/migrations/`. Para aplicar una migración nueva a producción:

**Opción A — Supabase CLI (recomendada):**
```bash
supabase link --project-ref kzyebyztrlupzoyvqyhq
supabase db push
```

**Opción B — SQL Editor manual:**
1. Ir al dashboard de Supabase → SQL Editor → New query
2. Pegar el contenido del archivo `.sql`
3. Run

Las migraciones son idempotentes (`IF NOT EXISTS`, `IF EXISTS`) — se pueden correr más de una vez sin daño.

### Migraciones aplicadas

| Archivo | Descripción |
|---------|-------------|
| `20260617_02_fix_tiendas_insert.sql` | Fix constraint INSERT en tabla tiendas |
| `20260617_seguridad_y_roles.sql` | Agrega rol `encargado`, tabla `codigos_activacion`, fix RLS `mapeos_sku` |

### Autenticación

Supabase Auth está configurado con:
- Email/password
- Roles en tabla `usuarios`: `dueno`, `empleado`, `encargado`
- RLS por `tienda_id` en todas las tablas sensibles

### Obtener las keys

Ir al dashboard → Settings → API:
- `URL` → `VITE_SUPABASE_URL`
- `anon key` (formato `eyJ...`) → `VITE_SUPABASE_ANON_KEY`

> Usar el formato legacy `eyJ...`, NO el nuevo formato `sb_publishable_...` — este último no es compatible con la versión de supabase-js usada.

---

## 4. Edge Functions

Las Edge Functions viven en `supabase/functions/`. Todas requieren JWT válido para invocarlas.

### Funciones disponibles

| Función | Propósito | Modelo IA | Auth |
|---------|-----------|-----------|------|
| `validar-codigo` | Valida código de activación server-side | — | JWT manual |
| `analizar-factura` | OCR de facturas via Claude Vision | claude-opus-4 | JWT manual |
| `asistente-ventas` | Asistente IA análisis de ventas | claude-3-5-haiku-20241022 | JWT manual |

### Secrets requeridos en Edge Functions

Ir al dashboard → Edge Functions → Manage secrets:

```
ANTHROPIC_API_KEY    → sk-ant-...   (nunca en Vercel ni en .env del cliente)
SUPABASE_SERVICE_ROLE_KEY → (ya disponible automáticamente en las funciones)
```

### Desplegar una función

```bash
# Linkear proyecto (solo primera vez)
supabase link --project-ref kzyebyztrlupzoyvqyhq

# Desplegar función individual
supabase functions deploy validar-codigo
supabase functions deploy analizar-factura
supabase functions deploy asistente-ventas

# Desplegar todas
supabase functions deploy
```

### Probar una función localmente

```bash
supabase start          # Levanta stack local
supabase functions serve validar-codigo --env-file ./supabase/.env.local
```

```bash
# Ejemplo de llamada con curl
curl -X POST http://localhost:54321/functions/v1/validar-codigo \
  -H "Authorization: Bearer <jwt-del-usuario>" \
  -H "Content-Type: application/json" \
  -d '{"codigo": "TIENDA-K7M2"}'

# Respuesta esperada:
# {"valido": true, "plan": "basico"}
```

---

## 5. Variables de entorno

### Tabla completa

| Variable | Dónde vive | Obligatoria | Descripción |
|----------|-----------|-------------|-------------|
| `VITE_SUPABASE_URL` | Vercel + `.env` local | No | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Vercel + `.env` local | No | Anon key (formato `eyJ...`) |
| `ANTHROPIC_API_KEY` | Supabase Edge Functions secrets | Sí (para OCR y IA) | API key de Anthropic |
| `SUPABASE_SERVICE_ROLE_KEY` | Disponible automáticamente en Edge Functions | — | Inyectada por Supabase |

### .env local de ejemplo

```env
# Supabase — sin estas variables la app funciona offline
VITE_SUPABASE_URL=https://kzyebyztrlupzoyvqyhq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> El `.env` no se commitea. Está en `.gitignore`.

---

## 6. Capacitor Android

### Flujo después de cambios en el código React

```bash
npm run build          # Genera el dist/ actualizado
npx cap sync android   # Copia dist/ al proyecto Android + actualiza plugins
npx cap open android   # Abre Android Studio para compilar el APK
```

### Primera vez (si el directorio android/ no existe o está corrupto)

```bash
npx cap add android
npx cap sync android
```

### Configuración

```typescript
// capacitor.config.ts
{
  appId: 'com.postienda.app',
  appName: 'POS Tienda',
  webDir: 'dist',
  server: { androidScheme: 'https' }
}
```

### Publicar en Play Store

Ver guía completa en [docs/fase-23-play-store.md](./fase-23-play-store.md).

---

## 7. Flujo de deploy habitual

### Cambio de código (más común)

```bash
# 1. Hacer los cambios
npm run dev            # Verificar localmente

# 2. Commit y push
git add src/           # Nunca git add -A (puede incluir .env)
git commit -m "feat: descripción del cambio"
git push origin main   # → Vercel despliega automáticamente
```

### Agregar una migración de BD

```bash
# 1. Crear el archivo de migración
# Nombrar: supabase/migrations/YYYYMMDDHHMMSS_descripcion.sql
# Escribir SQL idempotente (usar IF NOT EXISTS, IF EXISTS)

# 2. Aplicar en producción
supabase db push
# O manualmente en SQL Editor del dashboard

# 3. Commitear el archivo de migración
git add supabase/migrations/
git commit -m "chore: migración descripción"
git push origin main
```

### Actualizar una Edge Function

```bash
# 1. Editar el archivo en supabase/functions/nombre/index.ts

# 2. Desplegar
supabase functions deploy nombre

# 3. Commitear
git add supabase/functions/
git commit -m "feat: actualizar función nombre"
git push origin main
```

---

## 8. Troubleshooting

### Build falla en Vercel con errores TypeScript

**Causa:** El build command era `tsc -b && vite build` y `tsc -b` trata warnings como errores.

**Fix:** Cambiar el build command en Vercel a solo `vite build`.

### La anon key no funciona

**Causa:** El formato `sb_publishable_...` (nuevo) no es compatible con `@supabase/supabase-js@2.x`.

**Fix:** Usar el formato legacy `eyJ...` disponible en Settings → API del dashboard de Supabase.

### CORS al llamar Anthropic API desde el navegador

**Causa:** Anthropic no permite llamadas directas desde browsers (CORS bloqueado).

**Fix:** Siempre invocar via Edge Function (`supabase.functions.invoke('asistente-ventas', ...)`).

### `node_modules/` aparece en GitHub

**Causa:** Windows file permissions en git pueden romper `.gitignore` en ciertos casos.

**Fix:**
```bash
git rm -r --cached node_modules
git commit -m "chore: remove node_modules from tracking"
```

### Spinner infinito en componentes con Dexie

**Causa:** `dexie-react-hooks@1.1.7` tiene un bug con React Router v7 + StrictMode.

**Fix:** No usar `useLiveQuery`. Usar el patrón manual:
```typescript
const [data, setData] = useState([])
useEffect(() => {
  const sub = liveQuery(() => db.tabla.toArray()).subscribe(setData)
  return () => sub.unsubscribe()
}, [])
```

### Edge Function devuelve 401

**Causa:** Token JWT expirado o no incluido en el header.

**Fix:** Verificar que el cliente tiene sesión activa:
```typescript
const { data: { session } } = await supabase.auth.getSession()
if (!session) redirect('/login')
// Después llamar la función — supabase-js incluye el JWT automáticamente
```

### Dexie no persiste entre recargas en desarrollo

**Causa:** Vite HMR a veces no preserva IndexedDB si hay cambios en `database.ts`.

**Fix:** Abrir DevTools → Application → IndexedDB → borrar la DB → recargar.

---

*POS Tienda — Guía de Deploy*
*Actualizado: junio 2026 — Juan Camilo Pinzón*
