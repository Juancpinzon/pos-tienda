# Auditoría de Arquitectura y Seguridad — POS Tienda
**Fecha:** 2026-06-17
**Sesión:** Auditoría completa + implementación del plan de mejora

---

## Diagnóstico inicial

Se hizo un análisis exhaustivo del codebase (React 18 + TypeScript + Dexie + Zustand + Supabase + Vite PWA + Capacitor).

### Fortalezas confirmadas
- Separación correcta: componentes → hooks → Dexie (sin acceso directo desde componentes)
- RLS ya estaba implementado en todas las tablas de Supabase (no era el bug temido)
- 17 migraciones de Dexie ordenadas con upgrade logic
- Zustand limpio, sin duplicación entre stores
- PWA + Service Worker bien configurados (offline-first real)

### Bugs y deuda técnica encontrados

| Severidad | Problema | Archivo |
|-----------|----------|---------|
| 🔴 Seguridad | Códigos de activación visibles en el bundle del cliente | `src/hooks/useConfig.ts` |
| 🔴 Seguridad | Política RLS de `mapeos_sku` usaba columna `user_id` inexistente | `supabase/schema.sql` |
| 🔴 Seguridad | `usuarios.rol` no incluía `encargado` en el CHECK constraint | `supabase/schema.sql` |
| 🟠 Integridad | N+1 queries en historial de ventas (1 query por cliente por venta) | `src/hooks/useVentas.ts` |
| 🟠 Integridad | Batch sync usaba N updates individuales en vez de una transacción atómica | `src/lib/sync.ts` |
| 🟡 Performance | Sin code splitting — 18 páginas en el bundle inicial | `src/App.tsx` |
| 🟡 Performance | Sin paginación en historial de ventas (carga toda la tabla en memoria) | pendiente |
| 🟡 Deuda | `ConfigModal.tsx` con 1830 líneas (god component) | pendiente |

---

## Cambios implementados

### Fase 1 — Seguridad

**`supabase/functions/validar-codigo/index.ts`** *(nuevo)*
- Edge Function que valida códigos de activación server-side
- Rate limiting: máx 10 intentos por hora por usuario (tabla `rate_limits`)
- CORS restringido a orígenes permitidos (configurable via secret `ALLOWED_ORIGINS`)
- Consulta tabla `codigos_activacion` (códigos individuales) antes de fallback a patrones
- Rechaza códigos ya usados por otra tienda
- Patrones y códigos legacy nunca llegan al bundle del cliente

**`src/hooks/useConfig.ts`**
- Agregada función `validarCodigoConServidor`
- `activarPlanPro` y `activarPlanBasico` ahora llaman a la Edge Function cuando hay conexión
- Fallback automático a validación local si offline o Supabase no configurado

**`supabase/migrations/20260617_seguridad_y_roles.sql`** *(nuevo, ya ejecutado en producción)*
- Fix constraint `usuarios_rol_check`: agrega `'encargado'`
- Fix política `mapeos_sku`: reemplaza columna inexistente por `get_tienda_id()`
- Crea tabla `codigos_activacion` (solo accesible via `service_role`)
- Índices en `movimientos_stock(tienda_id, creado_en DESC)` y `detalles_venta(tienda_id, venta_local_id)`

**`supabase/schema.sql`**
- Sincronizado: constraint de rol incluye `encargado`, política `mapeos_sku` corregida, tabla `codigos_activacion` agregada

### Fase 2 — Integridad de datos

**`src/hooks/useVentas.ts`**
- Fix N+1: de `N × 2` queries a 2 queries bulk + join en memoria
- Usa `anyOf(clienteIds)` y `anyOf(ventaIds)` — con 500 ventas: de ~1000 queries a 2

**`src/lib/sync.ts`** (dos fixes)
- `pushMovimientosStock`: reemplazó `Promise.all(N × update)` por `where('id').anyOf(ids).modify()`
- `pushVentas`: mismo fix para el estampado de `deviceId`
- Ambos son ahora una sola transacción Dexie atómica

### Fase 3 — Performance

**`src/App.tsx`**
- 5 rutas estáticas (críticas): `POSPage`, `FiadosPage`, `CatalogoPublicoPage`, `LoginPage`, `RegisterPage`
- 10 rutas lazy con `React.lazy` + `Suspense`: `ProductosPage`, `CajaPage`, `ReportesPage`, `ProveedoresPage`, `InventarioPage`, `HistorialVentasPage`, `ListaPedidoPage`, `NominaPage`, `DomiciliosPage`, `DashboardMultitienda`
- Spinner de fallback centrado mientras carga cada página

---

## Estado de despliegue

| Componente | Estado |
|------------|--------|
| Edge Function `validar-codigo` | ✅ Desplegada en producción |
| Migración SQL | ✅ Ejecutada en producción |
| Cambios de código | ✅ Compilados sin errores TypeScript |
| Deploy Vercel | Pendiente — push a `main` cuando el usuario lo decida |

---

## Pendiente para próximas sesiones

- **`rate_limits` table** — la Edge Function la referencia pero aún no se creó en BD; agregarla a la migración o crear una nueva
- **Paginación** en `useVentasPeriodo` — carga toda la tabla; se siente a los 6-9 meses de uso intenso
- **Refactor `ConfigModal`** (1830 líneas) — extraer en 6 tabs independientes
- **Migración a UUIDs** como PK en Dexie — elimina hash collision en sync multi-dispositivo; cambio invasivo
- **Dashboard de salud del sync** — cuántos registros pendientes, último push exitoso
