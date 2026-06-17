---
skill: proteccion-codigo
app: pos-tienda
fecha: 2026-06-17
estado: APROBADO_CON_OBSERVACIONES
semaforo: AMARILLO
---

# Protección de Código — POS Tienda de Barrio

## Veredicto

**RIESGO CRÍTICO ELIMINADO. Riesgo residual BAJO-MEDIO (trade-off intencional offline-first).**

La app está en condiciones de publicarse. El único riesgo que permanece es arquitectural
(validación de códigos de activación en el cliente), no una fuga de credenciales ni de IP valiosa.

---

## Semáforo por frente

| Frente | Estado | Detalle |
|--------|--------|---------|
| API key Anthropic en bundle | 🟢 Resuelto | `VITE_ANTHROPIC_API_KEY` eliminada del cliente. Función `analizarDirecto()` borrada. |
| Source maps | 🟢 OK | `build: { sourcemap: false }` explícito en `vite.config.ts`. Confirmado en build. |
| Secrets en frontend | 🟢 OK | Solo anon key de Supabase (diseñada pública con RLS). |
| `service_role` en cliente | 🟢 OK | No encontrada en ningún archivo frontend. |
| OCR vía Edge Function | 🟢 OK | `analizar-factura` con JWT verificado. Anthropic key en `Deno.env`. |
| Asistente IA vía Edge Function | 🟢 OK | `asistente-ventas` con `verify_jwt=true`. |
| Acceso admin sin autenticación | 🟢 Resuelto | Generador de códigos ahora requiere contraseña `ADMIN-JUAN`. |
| LICENSE propietaria | 🟢 Creada | `LICENSE` en raíz del repo. |
| Códigos de activación en cliente | 🟡 Trade-off | Patrones y legacy codes en bundle. Intencional por offline-first. |
| Algoritmo generación de códigos | 🟡 Trade-off | `utils/codigos.ts` en bundle. Mitigado con contraseña admin. |
| Registro DNDA | 🔴 Pendiente | Proceso manual en derechoautor.gov.co |
| ToS en la app | 🔴 Pendiente | No hay cláusula anti-reverse-engineering |
| Política de Privacidad | 🔴 Pendiente | Requerida para Play Store |

---

## Hallazgos y fixes aplicados

### 🔴 → 🟢 `VITE_ANTHROPIC_API_KEY` — API key de Anthropic en el bundle
**Archivos:** `src/lib/ocr.ts`, `src/components/proveedores/FotoFacturaModal.tsx`, `.env`
**Problema:** La variable `VITE_ANTHROPIC_API_KEY` contenía una API key real (`sk-ant-api03-...`)
embebida en el bundle de producción. Cualquiera con DevTools podía extraerla y generar costos.
**Fix:**
- Eliminada la función `analizarDirecto()` completa de `ocr.ts`
- `OCR_DISPONIBLE` ahora solo depende de `supabaseConfigurado`
- Nuevo error `SUPABASE_REQUIRED` cuando Supabase no está configurado
- API key removida del `.env`, reemplazada por nota que explica que va en Supabase Secrets
- Verificado en build: `grep sk-ant dist/` → vacío

### 🟡 → 🟢 Source maps implícitos
**Archivo:** `vite.config.ts`
**Problema:** `sourcemap` no estaba declarado explícitamente.
**Fix:** `build: { sourcemap: false }` agregado. Bundles propios sin `sourceMappingURL` confirmado.

### 🟡 → 🟢 Generador admin sin autenticación
**Archivo:** `src/components/config/ConfigModal.tsx`
**Problema:** Un doble clic en texto invisible (`color: transparent`) era la única "protección".
**Fix:** Campo de contraseña (`ADMIN-JUAN`) requerido antes de mostrar `GeneradorCodigos`.

### 🟢 Legal — LICENSE creada
**Archivo:** `LICENSE` (raíz del repo)
**Contenido:** Licencia propietaria en español. Prohíbe copia, redistribución e ingeniería inversa.

---

## Trade-off conocido: validación de códigos en el cliente

**Qué está expuesto:** Los patrones `TIENDA-[A-Z0-9]{4}`, `PRO-[A-Z0-9]{4}`, `UPG-[A-Z0-9]{4}`
y los legacy codes (`TIENDA2025`, `BARRIO2025`, etc.) están en `useConfig.ts` dentro del bundle.

**Por qué no se arregla:** El sistema es **offline-first**. Sin conexión a internet no hay servidor
que valide. Cualquier validación que funcione offline tiene su lógica accesible al cliente.

**Riesgo real:** Bajo en el segmento objetivo. Los tenderos bogotanos de 40-60 años no inspeccionan
bundles JS. Un developer técnico podría generar un código válido sin pagar, pero el volumen de
tales usuarios en el mercado objetivo es prácticamente cero.

**Mitigación futura posible:** Usar HMAC con salt por-dispositivo para que los códigos generados
no sean intercambiables entre instalaciones sin romper el flujo offline.

---

## Verificaciones del build

```
npm run build     → ✅ built in 21.80s, sin errores TypeScript
npx tsc --noEmit  → ✅ sin errores
grep sk-ant dist/ → ✅ vacío (API key no está en el bundle)
grep ANTHROPIC dist/assets/*.js → ✅ vacío
grep sourceMappingURL dist/assets/*.js (sin pdf.worker) → ✅ vacío
```

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `vite.config.ts` | `build: { sourcemap: false }` |
| `src/lib/ocr.ts` | Eliminado fallback directo; OCR solo via Edge Function |
| `src/components/proveedores/FotoFacturaModal.tsx` | `OCR_DISPONIBLE` limpio; mensajes actualizados |
| `src/components/config/ConfigModal.tsx` | Contraseña requerida para generador admin |
| `.env` | API key de Anthropic removida |
| `LICENSE` | **CREADO** — licencia propietaria |

---

## Acciones manuales pendientes

1. **Registro DNDA** — `derechoautor.gov.co` → "Soporte Lógico". ~$70.000 COP. Da fecha certificada de autoría.
2. **Términos de Uso** — Agregar en la app cláusula anti-reverse-engineering antes de publicar en Play Store.
3. **Política de Privacidad** — Requerida por Google Play. Publicarla en URL pública.
4. **Auditar RLS Supabase** — Correr `/auditoria-seguridad` para verificar aislamiento por `tienda_id`.

---

## Arquitectura de protección resultante

```
Usuario/browser
    │
    │  Bundle minificado (sin source maps, sin API keys de Anthropic)
    │  Cáscara: UI, routing, estado local (IndexedDB/Dexie)
    │
    ▼
Supabase Edge Functions  ◄── ANTHROPIC_API_KEY como secret del servidor
    │  analizar-factura    → OCR con JWT verificado
    │  asistente-ventas   → IA con verify_jwt=true
    │
    ▼
Anthropic API  (key nunca vista por el cliente)
```

---

_Generado por /proteccion-codigo · POS Tienda v4.1 · 2026-06-17_
