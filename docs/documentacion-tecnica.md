# POS Tienda — Documentación Técnica

> Versión 4.1 — Abril 2026 | Repositorio: github.com/Juancpinzon/pos-tienda

---

## Stack tecnológico

| Capa | Tecnología | Versión | Propósito |
|------|-----------|---------|-----------|
| Framework | React + TypeScript | 18 / 5.x | UI y lógica de negocio |
| Styling | Tailwind CSS | v3 | Clases utilitarias |
| Componentes | shadcn/ui + base-ui | — | Accesibles, sin overhead |
| DB local | Dexie.js (IndexedDB) | 3.x | Offline-first, fuente de verdad |
| Estado global | Zustand | 4.x | Carrito, caja, auth |
| Formularios | react-hook-form + Zod | — | Validación tipo-segura |
| Build | Vite + Vite PWA | 5.x | Build rápido + service worker |
| Nube | Supabase | — | Auth, sync, Edge Functions |
| Deploy | Vercel | — | Push a main = deploy automático |
| Android | Capacitor | 5.x | APK desde el mismo código React |
| Barcode | @zxing/library | — | Escaneo por cámara |
| IA | Claude API (Anthropic) | claude-3-5-haiku | OCR facturas + asistente ventas |

---

## Instalación y desarrollo local

### Requisitos previos

```
Node.js 18+
npm 9+
Git
Cuenta Supabase (opcional — la app funciona sin ella)
```

### Comandos

```bash
git clone https://github.com/Juancpinzon/pos-tienda
cd pos-tienda
npm install
cp .env.example .env   # Llenar variables
npm run dev            # http://localhost:5173

npm run build          # Build producción
npm run preview        # Simular PWA instalada
npx cap sync android   # Sincronizar con Capacitor
npx cap open android   # Abrir Android Studio

# Deploy
git add . && git commit -m "mensaje" && git push origin main
# Vercel despliega automáticamente al hacer push a main
```

### Variables de entorno

```env
# Supabase — OPCIONAL (sin esto la app es 100% offline)
VITE_SUPABASE_URL=https://kzyebyztrlupzoyvqyhq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Anthropic — NUNCA en frontend, solo en Edge Functions como secret
ANTHROPIC_API_KEY=sk-ant-...
```

> **CRÍTICO**: La `ANTHROPIC_API_KEY` nunca va en el frontend. Solo vive en las Edge Functions de Supabase como secret.

---

## Arquitectura general

```
┌─────────────────────────────────────────────────────┐
│  CLIENTE (React PWA / Capacitor Android)            │
│                                                     │
│  Dexie.js (IndexedDB) ←→ Zustand stores            │
│         ↕                                           │
│  lib/sync.ts (auto-sync bidireccional)              │
└──────────────────┬──────────────────────────────────┘
                   │ HTTPS (solo si hay internet)
┌──────────────────▼──────────────────────────────────┐
│  SUPABASE                                           │
│  ├── Auth (JWT, roles: dueño/encargado/cajero)      │
│  ├── PostgreSQL (mirror de Dexie en nube)           │
│  ├── Edge Functions (proxy Anthropic API)           │
│  │   ├── analizar-factura  (OCR, verify_jwt: true)  │
│  │   └── asistente-ventas  (IA, verify_jwt: true)   │
│  └── RLS (Row Level Security por tienda)            │
└─────────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  VERCEL — pos-tienda-ten.vercel.app                 │
│  Push a main → deploy automático                    │
└─────────────────────────────────────────────────────┘
```

> **Regla fundamental**: Dexie/IndexedDB es la fuente de verdad local. Supabase es el backup en nube. Nunca al revés.

---

## Schema de base de datos (Dexie v14)

```typescript
// Tablas e índices principales
categorias              ++id
productos               ++id, categoriaId, codigoBarras, activo
clientes                ++id, nombre, activo
sesionCaja              ++id, estado, abiertaEn
ventas                  ++id, sesionCajaId, clienteId, creadaEn
detalleVenta            ++id, ventaId, productoId
movimientosFiado        ++id, clienteId, ventaId, creadoEn
gastosCaja              ++id, sesionCajaId
configTienda            ++id
proveedores             ++id, activo
comprasProveedor        ++id, proveedorId, creadaEn
detalleCompra           ++id, compraId
pagosProveedor          ++id, proveedorId
cuentasAbiertas         ++id, estado
empleados               ++id, activo, nombre
periodosNomina          ++id, empleadoId, estado
liquidacionPrestaciones ++id, empleadoId, tipo, estado
adelantosEmpleado       ++id, empleadoId
pedidosDomicilio        ++id, ventaId, estado, clienteTelefono
catalogoPublico         ++id
auditoriaAnulaciones    ++id, ventaId, usuarioRol, creadoEn
mermas                  ++id, productoId, tipo, sesionCajaId
movimientosStock        ++id, productoId, deviceId, sincronizado
```

### Reglas del schema

1. Nunca modificar el schema sin incrementar la versión de Dexie y agregar migración
2. `stockActual` se sincroniza por movimientos delta (`MovimientoStock`), nunca por valor absoluto
3. `configTienda` siempre tiene `id=1` (singleton)
4. `auditoriaAnulaciones` es inmutable — ningún registro se edita ni borra
5. `planActivo` en configTienda: `"basico" | "pro"` — default `"basico"` en instalaciones nuevas

---

## Estructura de archivos

```
src/
├── db/
│   ├── schema.ts          # Interfaces TypeScript de todas las tablas
│   ├── database.ts        # Instancia Dexie singleton + migraciones
│   └── seed.ts            # 2.632 productos en 41 categorías
├── stores/
│   ├── ventaStore.ts      # Carrito activo — SIEMPRE usar para el carrito
│   ├── cajaStore.ts       # Sesión de caja activa
│   ├── uiStore.ts         # Estado de modales y navegación
│   ├── authStore.ts       # Usuario autenticado y rol
│   └── themeStore.ts      # Modo claro/oscuro/sistema
├── hooks/                 # ÚNICA forma de acceder a Dexie desde componentes
│   ├── useProductos.ts    useVentas.ts    useFiados.ts
│   ├── useCaja.ts         useStock.ts     useProveedores.ts
│   ├── useConfig.ts       useSeed.ts      useDomicilios.ts
│   ├── useNomina.ts       useMermas.ts
│   └── ...
├── lib/
│   ├── supabase.ts        # Cliente + flag supabaseConfigurado
│   ├── sync.ts            # Auto-sync con resolverConflictos()
│   ├── asistente.ts       # Contexto + proxy para IA
│   └── notificaciones.ts  # Motor de alertas push
├── components/
│   ├── pos/    fiado/    productos/    proveedores/
│   ├── caja/   stock/    reportes/     config/
│   ├── domicilios/   nomina/   inventario/
│   └── shared/       # ConfirmDialog, ProGuard, etc.
├── pages/             # Una página por ruta
└── utils/
    ├── moneda.ts      # formatCOP() — SIEMPRE usar esto
    ├── fecha.ts       # Utilidades de fecha
    ├── nomina.ts      # SMMLV, fórmulas prestaciones
    └── impresion.ts   # ESC/POS para impresora térmica
```

---

## Rutas disponibles

| Ruta | Página | Roles |
|------|--------|-------|
| `/` | POSPage — ventas | dueño, encargado, cajero |
| `/fiados` | Cartera de clientes | dueño, encargado, cajero |
| `/productos` | CRUD de productos | dueño |
| `/inventario` | Stock, mermas, caducidad | dueño |
| `/proveedores` | Compras y pagos | dueño, encargado |
| `/caja` | Apertura y cierre | dueño, encargado |
| `/reportes` | Métricas + IA + auditoría | dueño |
| `/historial` | Todas las ventas | dueño, encargado, cajero |
| `/pedido` | Lista de pedido predictiva | dueño, encargado |
| `/domicilios` | Panel kanban domicilios | dueño, encargado (Plan Pro) |
| `/nomina` | Empleados y colillas | dueño, encargado |
| `/multi-tienda` | Dashboard consolidado | dueño +2 tiendas |
| `/catalogo/:slug` | Catálogo público | **público sin auth** |
| `/entrega/:token` | Confirmar entrega repartidor | **público sin auth** |

---

## Edge Functions (Supabase)

### analizar-factura
- **Propósito**: OCR de facturas de proveedores via Claude Vision API
- **Auth**: `verify_jwt: true` — requiere JWT válido
- **Versión**: 12

### asistente-ventas
- **Propósito**: Asistente IA para análisis de ventas
- **Modelo**: `claude-3-5-haiku-20241022`
- **Auth**: `verify_jwt: true` — requiere JWT válido
- **Versión**: 2

### Redesplegar funciones

```bash
supabase functions deploy analizar-factura
supabase functions deploy asistente-ventas
```

---

## Fórmulas de negocio irrompibles

### Precio de venta (margen sobre venta, NO sobre costo)

```typescript
// CORRECTO — margen sobre precio de venta
PV = PC / (1 - %utilidad / 100)

// Ejemplo: costo $3.500 con 30% de utilidad
// PV = 3500 / 0.70 = $5.000

// INCORRECTO — nunca usar markup
// PV = PC * (1 + %margen)
```

### Nómina — Colombia 2025

```typescript
SMMLV_2025           = 1_423_500  // Editable en ConfigTienda
SUBSIDIO_TRANSPORTE  = 200_000    // Solo salarios <= 2 SMMLV

IBC = max(salario, SMMLV)
deduccionSalud    = IBC * 0.04
deduccionPension  = IBC * 0.04
totalDeduccionesSS = IBC * 0.08

prima              = (salario * diasTrabajados) / 360
cesantias          = (salario * diasTrabajados) / 360
interesesCesantias = cesantias * 0.12 * (dias / 360)
```

### Sincronización de stock (anti race condition)

```typescript
// NUNCA sincronizar valor absoluto de stockActual
// SIEMPRE sincronizar movimientos (delta)
stockActual += delta  // delta negativo = venta, positivo = compra

// Estrategias por tabla:
// ventas/detalleVenta  → conservar-ambos (inmutables)
// movimientosStock     → suma-movimientos (delta)
// clientes/config      → last-write-wins (timestamp)
```

---

## Feature flags — Plan Demo / Básico / Pro

```typescript
const { esDemo, esBasico, esPro } = useConfig()

// Conteo demo
const { ventasDemo, ventasRestantesDemo, demoAgotado } = useConfig()

// Activar Plan Básico
await activarPlanBasico("TIENDA2025")  // retorna boolean

// Activar Plan Pro  
await activarPlanPro("PROTIENDA2025") // retorna boolean

// Códigos Básico válidos:
["TIENDA2025", "BARRIO2025", "POSBASICO2025", "TENDERO2025", "TIENDA2026"]

// Códigos Pro válidos:
["PROTIENDA2025", "DOMICILIOS2025", "UPGRADE2025"]

// Rutas bloqueadas en demo agotado:
// Al intentar nueva venta → abre ModalActivarBasico
```

## Lector de barras USB

El componente BuscadorProducto.tsx maneja dos modos de escaneo:

**Modo cámara**: @zxing/library — handleCodigoDetectado() — sin cambios

**Modo USB (teclado)**:
```typescript
// Detección por velocidad de escritura
// >6 chars en <100ms → probable lector USB
// Procesa automáticamente después de 150ms

// handleKeyDown: Enter → procesarBusquedaUnica()
// 1 resultado → agrega al carrito + limpia campo + re-enfoca
// 0 resultados → abre modal fantasma pre-llenado
// N resultados → muestra dropdown para elección manual
```

Re-enfoque automático:
- Al montar POSPage: autoFocus en el campo
- Post-venta: re-enfoque con 80ms delay
- Post-modal: re-enfoque automático

## Modelo comercial

| Plan | Precio | Activación | Acceso |
|------|--------|-----------|--------|
| Demo | Gratis | Sin código | 50 ventas, todas las funciones |
| Básico | $500.000 COP único | Código requerido | Sin límite, sin domicilios |
| Pro | $900.000 COP único | Código Pro | Sin límite + domicilios |
| Upgrade B→Pro | $450.000 COP | Código upgrade | Activa domicilios |

---

## Reglas de código

| # | Regla |
|---|-------|
| 01 | TypeScript `strict: true` — sin `any` explícitos |
| 02 | Comentarios de lógica de negocio en español. Nombres de componentes y hooks en inglés |
| 03 | Moneda: SIEMPRE `formatCOP()` de `utils/moneda.ts` — nunca formatear manualmente |
| 04 | Acceso a DB: SIEMPRE por hooks. Nunca Dexie directo desde componentes |
| 05 | Carrito: SIEMPRE `ventaStore`. Nunca estado local para el carrito |
| 06 | Confirmaciones destructivas: `ConfirmDialog` — nunca `window.confirm` |
| 07 | Notificaciones: toast (sonner) — nunca `window.alert` |
| 08 | APIs nativas: verificar `useCapacitor()` antes de llamar plugins |
| 09 | Offline first: toda funcionalidad nueva debe funcionar sin Supabase configurado |
| 10 | Touch targets: mínimo 60px de altura. Fuente mínima 15px |
| 11 | Vercel build: usar `vite build` — NO `tsc -b && vite build` |
| 12 | `dexie-react-hooks` bug: no usar `useLiveQuery` — usar `liveQuery + useState + useEffect` |

---

## Known issues y workarounds

| Problema | Causa | Workaround |
|----------|-------|------------|
| Spinner infinito en componentes | `dexie-react-hooks@1.1.7` bug con React Router v7 + StrictMode | Reemplazar `useLiveQuery` con `liveQuery + useState + useEffect` |
| `node_modules` en GitHub | Windows file permissions en git | `git filter-branch --force` para reescribir historial |
| CORS con Anthropic API | No se puede llamar desde el browser | Supabase Edge Function como proxy |
| Anon key nueva no funciona | Formato `sb_publishable_` no compatible | Usar formato legacy `eyJ...` del dashboard |
| Build falla en Vercel | `tsc -b` lanza errores que Vercel trata como fatales | Usar solo `vite build` en el build command |

---

## Roadmap pendiente

- [ ] Play Store — Android Studio requerido (Fase 25)
- [ ] Impresora térmica Bluetooth — completar flujo ESC/POS
- [ ] DIAN — Factura electrónica
- [ ] PILA / nómina electrónica
- [ ] Bot WhatsApp Business para domicilios
- [ ] App del repartidor (vista simplificada)

---

*POS Tienda v4.1 — Repositorio: github.com/Juancpinzon/pos-tienda*
*Actualizado: 10 abril 2026 — Juan Camilo Pinzón*
