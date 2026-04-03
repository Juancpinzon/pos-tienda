# CLAUDE.md — POS Tienda de Barrio 🏪

## Sistema de Punto de Venta para Tiendas de Barrio Latinoamericanas

> **Lee este documento completo antes de escribir una sola línea de código.**
> Este es el ADN del proyecto. Cada decisión técnica y de UX tiene una razón de ser.

---

## 🧠 Contexto del Negocio (Por qué existe este proyecto)

Este POS fue diseñado para el **tendero bogotano real**: una persona de 40-60 años que lleva décadas anotando en un cuaderno, que tiene 3 filas de clientes a las 7am, que vende media libra de queso y fía el desayuno al vecino de toda la vida.

Los sistemas POS tradicionales **fallan** en este contexto porque:

1. Bloquean ventas por "producto no registrado en sistema"
2. Piden cédula o correo para registrar un fiado
3. Requieren internet estable para funcionar
4. Tienen interfaces diseñadas para cajeros de supermercado, no para tenderos

**Este sistema resuelve exactamente esos 4 problemas.**

---

## 🎯 Principios de Diseño Irrompibles

Estos principios NO se negocian, bajo ninguna circunstancia:

### 1. NUNCA bloquear una venta

Si un producto no está registrado → vender igual, capturando solo el precio ("producto fantasma").
Si el sistema falla → el tendero debe poder seguir cobrando.

### 2. El Fiado es un ciudadano de primera clase

No es un hack ni un parche. Es una funcionalidad core.
Registrar un fiado debe ser tan rápido como cobrar en efectivo.
NO se piden documentos, correos ni datos formales. Solo el nombre del cliente.

### 3. Offline primero, siempre

Todo funciona sin internet. La sincronización con Supabase es un bonus, no un requisito.
Usar IndexedDB (Dexie.js) como fuente de verdad local.

### 4. Interfaz para manos, no para ratones

Botones mínimo 60px de alto. Texto mínimo 16px.
Funciona bien en tablet de 7 pulgadas y en celular.
Flujo principal de venta: máximo 3 toques para completar una transacción.

### 5. Precios volátiles son la norma

El precio de un aguacate cambia todos los días.
Cambiar el precio de un producto durante una venta es una operación de primer nivel, no una excepción.

### 6. La fórmula de precio de venta es sobre el precio de venta, no sobre el costo

El tendero piensa en "ganancia del 30%" como: de cada $100 que vende, $30 son ganancia.
**Fórmula irrompible:** `PV = PC / (1 - %utilidad/100)`

- Ejemplo: costo $3.500 con 30% → PV = $3.500 / 0.70 = **$5.000**
- NO usar: PV = PC × (1 + %margen) — esa es la fórmula del margen sobre costo (markup), NO la del margen sobre venta.
  Esta fórmula aplica en FormProducto y en las alertas de precio de NuevaCompraModal.
  El porcentaje de utilidad por defecto es **30%**.

---

## 🛠️ Stack Tecnológico Actual

| Capa                 | Tecnología                        | Razón                                          |
| -------------------- | --------------------------------- | ---------------------------------------------- |
| Frontend framework   | React 18 + TypeScript             | Ecosistema, velocidad de desarrollo            |
| Styling              | Tailwind CSS v3                   | Clases utilitarias, consistencia               |
| Componentes UI       | shadcn/ui + base-ui               | Accesibles, customizables, sin overhead        |
| Base de datos local  | Dexie.js (wrapper de IndexedDB)   | Offline-first, queries rápidas, sin servidor   |
| Estado global        | Zustand                           | Liviano, simple, predecible                    |
| Formularios          | react-hook-form + Zod             | Validación tipo-segura                         |
| Build tool           | Vite                              | Velocidad de desarrollo                        |
| Instalación como app | PWA (Vite PWA plugin)             | Se instala como app nativa desde el navegador  |
| App nativa Android   | Capacitor                         | APK desde mismo código React                   |
| Icons                | Lucide React                      | Consistentes, ligeros                          |
| Números/moneda       | numeral.js                        | Formateo de pesos colombianos                  |
| Sincronización nube  | Supabase (PostgreSQL + Auth)      | Multi-usuario, backup, sync entre dispositivos |
| Lector de barras     | @zxing/library                    | Escaneo por cámara del celular                 |
| Bluetooth            | @capacitor-community/bluetooth-le | Impresoras térmicas ESC/POS                    |
| Push notifications   | @capacitor/push-notifications     | Alertas de stock, recordatorios                |

**Deploy:** Vercel — push a `main` = deploy automático
**Repositorio:** github.com/Juancpinzon/pos-tienda
**URL producción:** pos-tienda-ten.vercel.app

---

## 📁 Estructura del Proyecto (Estado Actual)

```
pos-tienda/
├── public/
│   ├── manifest.json              # PWA manifest
│   └── icons/                     # Iconos para instalar app
├── src/
│   ├── db/
│   │   ├── schema.ts              # Definición de tablas Dexie
│   │   ├── database.ts            # Instancia singleton de Dexie
│   │   └── seed.ts                # Carga inicial de 400 productos
│   ├── stores/
│   │   ├── ventaStore.ts          # Estado de la venta activa
│   │   ├── cajaStore.ts           # Estado de la sesión de caja
│   │   ├── uiStore.ts             # Estado de modales y navegación
│   │   ├── authStore.ts           # Autenticación y perfiles (Supabase)
│   │   └── themeStore.ts          # Modo oscuro/claro/sistema
│   ├── hooks/
│   │   ├── useProductos.ts        # Búsqueda y CRUD de productos
│   │   ├── useFiados.ts           # Gestión de cartera
│   │   ├── useVentas.ts           # Registro de transacciones
│   │   ├── useCaja.ts             # Sesiones de caja
│   │   ├── useStock.ts            # Control de stock y alertas
│   │   ├── useProveedores.ts      # Gestión de proveedores y compras
│   │   ├── useConfig.ts           # Configuración de la tienda
│   │   ├── useSeed.ts             # Poblar DB en primer uso
│   │   ├── useSyncStatus.ts       # Estado de sincronización Supabase
│   │   ├── useTiendasDueno.ts     # Multi-tienda (cargar/cambiar tiendas)
│   │   ├── useOnboarding.ts       # Tour guiado para nuevos usuarios
│   │   ├── usePWAInstall.ts       # Prompt de instalación PWA
│   │   ├── useCapacitor.ts        # Detección nativo vs. web (Fase 23)
│   │   ├── usePushNotifications.ts # Push dual: nativo + web (Fase 22-23)
│   │   └── useBluetooth.ts        # BLE dual: nativo + web (Fase 23)
│   ├── lib/
│   │   ├── supabase.ts            # Cliente Supabase + flag supabaseConfigurado
│   │   ├── sync.ts                # Auto-sync bidireccional con Supabase
│   │   └── notificaciones.ts      # Lógica de notificaciones
│   ├── components/
│   │   ├── pos/                   # Pantalla principal de venta
  │   │   └── ModalNotaVenta.tsx # Preview nota de venta (Fase 24)
│   │   ├── fiado/                 # Módulo de cartera
│   │   ├── productos/             # Gestión de inventario
│   │   ├── proveedores/           # Módulo de proveedores
│   │   ├── stock/                 # Alertas y control de stock
│   │   ├── reportes/              # Gráficos y reportes
│   │   ├── caja/                  # Sesiones de caja
│   │   ├── config/                # ConfigModal + ajustes de tienda
│   │   ├── onboarding/            # TourOverlay para nuevos usuarios
│   │   └── shared/                # Componentes reutilizables
│   ├── pages/
│   │   ├── POSPage.tsx            # Pantalla principal (ruta /)
│   │   ├── FiadosPage.tsx         # Cartera de clientes (/fiados)
│   │   ├── ProductosPage.tsx      # Gestión de productos (/productos)
│   │   ├── InventarioPage.tsx     # Control de stock (/inventario)
│   │   ├── ProveedoresPage.tsx    # Proveedores y compras (/proveedores)
│   │   ├── CajaPage.tsx           # Resumen de caja (/caja)
│   │   ├── ReportesPage.tsx       # Reportes del negocio (/reportes)
│   │   ├── HistorialVentasPage.tsx# Historial de ventas (/historial)
│   │   ├── ListaPedidoPage.tsx    # Lista de pedido a proveedor (/pedido)
│   │   ├── DashboardMultitienda.tsx # Vista general multi-tienda (/multi-tienda)
│   │   ├── LoginPage.tsx          # Login Supabase (/login)
│   │   └── RegisterPage.tsx       # Registro de tienda (/registro)
│   ├── types/
│   │   └── index.ts               # Todos los tipos TypeScript
│   ├── utils/
│   │   ├── moneda.ts              # formatCOP() — SIEMPRE usar esto
│   │   ├── fecha.ts               # Utilidades de fecha
│   │   └── impresion.ts           # Generador de recibos ESC/POS
│   ├── App.tsx                    # Routing, layout, auth gate
│   ├── main.tsx
│   └── index.css
├── android/                       # Proyecto Android (Capacitor, Fase 23)
├── docs/
│   └── fase-23-play-store.md      # Guía publicación Play Store
├── capacitor.config.ts            # Configuración Capacitor (Fase 23)
├── supabase/                      # Edge functions y migraciones
├── CLAUDE.md                      # Este archivo
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 💾 Schema de Base de Datos (Dexie / IndexedDB)

Este es el modelo de datos definitivo. No modificar sin actualizar este documento primero.

```typescript
// src/db/schema.ts

export interface Categoria {
  id?: number;
  nombre: string; // "Lácteos", "Granos", "Bebidas", etc.
  emoji: string; // "🥛", "🌾", "🥤"
  orden: number; // Para ordenar en la UI
}

export interface Producto {
  id?: number;
  nombre: string;
  categoriaId: number;
  precio: number; // Precio en pesos COP (sin decimales)
  precioCompra?: number; // Costo (opcional, para margen)
  codigoBarras?: string; // Código EAN si tiene
  stockActual?: number; // null = no controla stock
  stockMinimo?: number; // Para alertas
  unidad: "unidad" | "gramo" | "mililitro" | "porcion";
  esFantasma: boolean; // true = producto no catalogado
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface Cliente {
  id?: number;
  nombre: string; // Solo nombre, nada más obligatorio
  telefono?: string; // Opcional
  direccion?: string; // Opcional
  limiteCredito?: number; // En COP. null = sin límite
  totalDeuda: number; // Calculado, se actualiza con cada fiado
  activo: boolean;
  creadoEn: Date;
}

export interface SesionCaja {
  id?: number;
  montoApertura: number; // Efectivo con que se abre la caja
  montoCierre?: number; // Efectivo al cerrar
  totalVentas: number; // Calculado al cerrar
  totalEfectivo: number;
  totalFiado: number;
  totalGastos: number;
  abiertaEn: Date;
  cerradaEn?: Date;
  estado: "abierta" | "cerrada";
  notas?: string;
}

export interface Venta {
  id?: number;
  sesionCajaId: number;
  clienteId?: number; // null = cliente anónimo (mostrador)
  subtotal: number;
  descuento: number;
  total: number;
  tipoPago: "efectivo" | "fiado" | "transferencia" | "mixto";
  efectivoRecibido?: number;
  cambio?: number;
  estado: "completada" | "anulada";
  notas?: string;
  creadaEn: Date;
}

export interface DetalleVenta {
  id?: number;
  ventaId: number;
  productoId?: number; // null = producto fantasma
  nombreProducto: string; // Snapshot del nombre al momento de vender
  cantidad: number; // Puede ser fraccionado (0.5, 250)
  precioUnitario: number; // Snapshot del precio al momento de vender
  descuento: number;
  subtotal: number;
  esProductoFantasma: boolean;
}

export interface MovimientoFiado {
  id?: number;
  clienteId: number;
  ventaId?: number; // null = pago directo de deuda
  tipo: "cargo" | "pago";
  monto: number;
  descripcion: string;
  creadoEn: Date;
  sesionCajaId?: number;
}

export interface GastoCaja {
  id?: number;
  sesionCajaId: number;
  descripcion: string; // "Cambio de bombillo", "Bolsas plásticas"
  monto: number;
  tipo: "hormiga" | "proveedor" | "servicio" | "otro";
  creadoEn: Date;
}

export interface ConfigTienda {
  id?: number; // Siempre 1 (singleton)
  nombreTienda: string;
  direccion?: string;
  telefono?: string;
  nit?: string;
  mensajeRecibo?: string;
  monedaSimbol: string; // "$"
  impuestoIVA: number; // 0 = no aplica IVA
  permitirStockNegativo: boolean; // true para tiendas sin control estricto
  limiteFiadoPorDefecto: number; // COP. 0 = sin límite por defecto
}

// ─── Módulo de Proveedores y Compras ──────────────────────────────────────────

export interface Proveedor {
  id?: number;
  nombre: string; // "Lácteos El Campo", "Distribuidora Colanta"
  telefono?: string;
  contacto?: string; // Nombre del vendedor
  diasVisita?: string; // "Lunes y Jueves"
  saldoPendiente: number; // Lo que le debo al proveedor
  activo: boolean;
  creadoEn: Date;
}

export interface CompraProveedor {
  id?: number;
  proveedorId: number;
  sesionCajaId?: number;
  total: number;
  pagado: number; // Puede pagar parcial
  saldo: number; // total - pagado
  tipoPago: "contado" | "credito" | "mixto";
  notas?: string; // "Factura #1234"
  creadaEn: Date;
}

export interface DetalleCompra {
  id?: number;
  compraId: number;
  productoId?: number;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number; // Precio de costo
  subtotal: number;
}

export interface PagoProveedor {
  id?: number;
  proveedorId: number;
  compraId?: number; // null = abono general
  monto: number;
  sesionCajaId?: number;
  notas?: string;
  creadoEn: Date;
}
```

---

## 🔄 Flujos de Negocio Críticos

### Flujo 1: Venta Normal (< 30 segundos)

```
1. Tendero busca producto (por nombre o código de barras con la cámara)
   → Si no existe: opción "Vender como fantasma" con precio manual
2. Selecciona cantidad
   → Opción de fraccionado si el producto es por peso/gramo
   → Opción de cambiar precio "al vuelo" (precio volátil)
3. Agrega al carrito
4. Repite para todos los productos
5. Toca "Cobrar"
   → Modal de cobro: Efectivo / Fiado / Transferencia
   → Si Efectivo: teclado numérico grande para ingresar billete
   → Muestra cambio automáticamente
6. Confirmar → Venta guardada → Ticket en pantalla
```

### Flujo 2: Venta a Fiado

```
1. En el modal de cobro, seleccionar "Fiado"
2. Buscar cliente por nombre (autocompletar)
   → Si no existe: crear cliente al vuelo (solo nombre)
3. Sistema verifica límite de crédito
   → Si supera límite: advertencia (pero NO bloquea, el tendero decide)
4. Confirmar → Crea Venta + MovimientoFiado(tipo='cargo')
5. Actualiza totalDeuda del cliente
```

### Flujo 3: Cobrar un Fiado

```
1. Ir a módulo Fiados
2. Buscar cliente
3. Ver historial de deuda
4. Ingresar monto del pago (puede ser parcial)
5. Confirmar → Crea MovimientoFiado(tipo='pago')
6. Actualiza totalDeuda del cliente
```

### Flujo 4: Producto Fantasma

```
1. Tendero busca producto → No aparece en sistema
2. Toca "Vender sin registrar"
3. Ingresa descripción corta (opcional) y PRECIO (obligatorio)
4. Se agrega al carrito como DetalleVenta con esProductoFantasma=true
5. Al finalizar la jornada, el tendero puede revisar fantasmas y registrarlos
```

### Flujo 5: Apertura y Cierre de Caja

```
APERTURA:
1. Al iniciar el día, ingresar efectivo inicial (base de caja)
2. Crea SesionCaja(estado='abierta')
3. Todas las ventas del día quedan ligadas a esta sesión

CIERRE:
1. Tendero cuenta el efectivo físico
2. Ingresa monto contado
3. Sistema muestra: ventas totales, efectivo esperado, diferencia
4. Confirmar → SesionCaja(estado='cerrada')
5. Genera resumen del día
```

### Flujo 6: Multi-Tienda (Dueño con 2+ locales)

```
1. Dueño inicia sesión con Supabase Auth
2. Sistema detecta sus tiendas en propietarios_tienda
3. Selector en el header permite cambiar entre tiendas
4. Cada tienda tiene su propia DB local en Dexie
5. Dashboard multi-tienda muestra resumen consolidado
```

---

## 🎨 Sistema de Diseño

### Paleta de Colores

```css
/* Colores principales - inspirados en la tienda de barrio */
--color-primario: #1e3a5f; /* Azul oscuro (actualizado) */
--color-primario-hover: #162d4a;
--color-acento: #f77f00; /* Naranja cálido */
--color-acento-hover: #d62828;
--color-fondo: #f8f9fa; /* Blanco casi blanco */
--color-superficie: #ffffff;
--color-borde: #e8e8e0;
--color-texto: #1a1a1a;
--color-texto-suave: #6b7280;
--color-peligro: #dc2626;
--color-exito: #16a34a;
--color-advertencia: #d97706;
--color-fiado: #7c3aed; /* Morado para fiado */
```

### Tipografía

- **Display/Títulos**: `font-family: 'Geist Variable', sans-serif` — moderna y legible
- **Cuerpo**: `font-family: 'Inter', sans-serif` — legible en pantallas pequeñas
- **Números/Moneda**: `font-family: 'JetBrains Mono', monospace` — alineación de decimales

### Tamaños mínimos para touch

```css
/* REGLA DE ORO: Nada táctil menor a esto */
--min-touch-height: 56px;
--min-touch-width: 56px;
--font-size-min: 15px;
--font-size-producto: 18px;
--font-size-precio: 24px;
--font-size-total: 36px;
```

---

## 🖥️ Pantallas y Navegación (Estado Actual)

### Rutas disponibles

| Ruta            | Página                                        | Roles              |
| --------------- | --------------------------------------------- | ------------------ |
| `/`             | POSPage — POS principal                       | dueño, empleado    |
| `/fiados`       | FiadosPage — Cartera de clientes              | dueño, empleado    |
| `/productos`    | ProductosPage — CRUD de productos             | dueño              |
| `/inventario`   | InventarioPage — Stock y alertas              | dueño              |
| `/proveedores`  | ProveedoresPage — Compras a proveedores       | dueño              |
| `/caja`         | CajaPage — Apertura/cierre de caja            | dueño              |
| `/reportes`     | ReportesPage — Métricas del negocio           | dueño              |
| `/historial`    | HistorialVentasPage — Todas las ventas        | dueño, empleado    |
| `/pedido`       | ListaPedidoPage — Lista de pedido a proveedor | dueño              |
| `/multi-tienda` | DashboardMultitienda — Vista consolidada      | dueño (+2 tiendas) |

### Sistema de roles

- **dueño**: Acceso total. Ve configuración, reportes, proveedores, inventario.
- **empleado**: Solo puede vender y ver fiados e historial. No ve caja ni reportes.
- Sin Supabase configurado: acceso total sin autenticación (modo offline puro).

---

## ⚙️ Variables de Entorno

```env
# Supabase (opcional — sin esto la app funciona 100% offline)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Anthropic (para features de IA futuras)
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

Si `VITE_SUPABASE_URL` no está configurado, `supabaseConfigurado = false` y la app salta el auth gate.

---

## 📱 Capacitor Android (Fase 23)

El directorio `android/` contiene el proyecto nativo generado por Capacitor.

```typescript
// capacitor.config.ts
{
  appId: 'com.postienda.app',
  appName: 'POS Tienda',
  webDir: 'dist',
  server: { androidScheme: 'https' }
}
```

### Comandos Capacitor

```bash
# Después de cada cambio en el código React:
npm run build
npx cap sync android

# Abrir en Android Studio:
npx cap open android
```

Ver guía completa de publicación en `docs/fase-23-play-store.md`.

---

## 🚀 Fases Completadas

### Fase 0: Scaffolding ✅

- Vite + React + TypeScript + Tailwind + shadcn/ui + PWA

### Fase 1: Base de Datos ✅

- Dexie singleton, schema completo, seed de 400 productos

### Fase 2: POS Core ✅

- BuscadorProducto, GridProductosRapidos, ventaStore, ModalCobro, TecladoNumerico

### Fase 3: Fiados ✅

- useFiados, ListaClientes, CuentaCliente, ModalNuevoPago

### Fase 4: Gestión de Productos ✅

- useProductos, ListaProductos, FormProducto con fórmula de margen correcta

### Fase 5: Caja y Reportes ✅

- useCaja, AbrirCaja, CerrarCaja, ResumenCaja, ReportesPage con métricas

### Fase 6: Pulido PWA ✅

- ConfigModal (nombre tienda, NIT, mensaje recibo), generador de recibos, instalación PWA

### Fase 7: Módulo de Proveedores ✅

- useProveedores, ProveedoresPage, NuevaCompraModal, historial de compras y pagos

### Fase 8: Control de Stock ✅

- useStock, InventarioPage, alertas de stock mínimo, badge en navegación

### Fase 9: Modo Oscuro ✅

- themeStore (claro/oscuro/sistema), toggle en header, persistido en localStorage

### Fase 10: Lector de Código de Barras ✅

- @zxing/library integrado en BuscadorProducto, escaneo por cámara del celular

### Fase 11: Lista de Pedido ✅

- ListaPedidoPage auto-genera la lista de reabastecimiento según stock bajo

### Fase 12: Historial de Ventas ✅

- HistorialVentasPage con filtros por fecha, anulación de ventas

### Fase 13: Supabase Auth ✅

- LoginPage, RegisterPage, authStore, roles dueño/empleado, guard de rutas

### Fase 14: Sincronización Supabase ✅

- lib/sync.ts, startAutoSync/stopAutoSync, pullFromSupabase, IndicadorSync en header

### Fase 15: Multi-Tienda ✅

- useTiendasDueno, DashboardMultitienda, SelectorTienda en header

### Fase 16: Onboarding / Tour ✅

- useOnboarding, TourOverlay con data-tour attributes, tour interactivo para nuevos usuarios

### Fase 17: Configuración Avanzada ✅

- ConfigModal extendida: logo tienda, footer recibo, límite de fiado por defecto

### Fase 18: Reportes Avanzados ✅

- Gráficos de ventas por día, productos más vendidos, margen de utilidad

### Fase 19: Gestos y UX Móvil ✅

- BannerInstalacion, pull-to-refresh, navegación optimizada para celular

### Fase 20: Gestión de Empleados ✅

- Invitar empleados vía Supabase, asignación de roles, acceso restringido

### Fase 21: Lista de Pedido Avanzada ✅

- Generación automática de pedido por proveedor, compartir por WhatsApp

### Fase 22: Notificaciones Push 🔄 (En progreso)

- usePushNotifications.ts creado con soporte dual nativo/web
- Pendiente: integración completa con alertas de stock y recordatorios de fiado

### Fase 23: Capacitor Android ✅

- capacitor.config.ts, android/ generado y sincronizado
- useCapacitor.ts: detección de plataforma nativa vs. web
- usePushNotifications.ts: dual @capacitor/push-notifications + Web Push API
- useBluetooth.ts: dual @capacitor-community/bluetooth-le + Web Bluetooth API
- docs/fase-23-play-store.md: guía de publicación en Play Store

### Fase 24: Nota de Venta — Régimen Simple ✅

- src/lib/notaVenta.ts: generarNotaVenta (HTML), generarPDF (html2canvas+jsPDF), generarTextoNotaVenta, compartirNotaPorWhatsApp, descargarPDF
- src/db/schema.ts: nueva interfaz ConfigFiscal (ultimoConsecutivo, prefijo, campos DIAN futuros)
- src/db/database.ts: tabla configFiscal (versión 5), consecutivo persistido
- src/components/pos/ModalNotaVenta.tsx: preview HTML en iframe, botones Descargar PDF y WhatsApp
- src/components/pos/ModalCobro.tsx: PantallaExito con botón "📄 Ver nota de venta" + consecutivo auto-generado
- src/pages/HistorialVentasPage.tsx: botón "📄 Nota de venta" en cada venta del historial
- src/components/config/ConfigModal.tsx: sección Facturación con prefijo, consecutivo actual y aviso Régimen Simple

### Fase 26: Asistente IA para Tendero ✅
- src/lib/asistente.ts: prepararContexto (ventas, stock, morosos), consultarIA proxy
- src/components/reportes/AsistenteIA.tsx: Chat flotante para consultas en la PWA
- supabase/functions/asistente-ventas/index.ts: Proxy a Anthropic con claude-3-5-haiku-20241022 y System Prompt local
- Integrado directamente en ReportesPage.tsx exclusivo para el dueño

---

## 🚨 Reglas de Código

1. **TypeScript estricto**: `"strict": true` en tsconfig. Sin `any` explícitos.
2. **Comentarios en español**: Los comentarios de lógica de negocio van en español.
3. **Nombres de componentes y hooks**: en inglés (convención React).
4. **Formateo de pesos**: SIEMPRE usar la función `formatCOP()` de `utils/moneda.ts`. Nunca formatear moneda manualmente.
5. **Acceso a DB**: SIEMPRE a través de hooks (`useProductos`, `useFiados`, etc.). Nunca acceder a Dexie directamente desde componentes.
6. **Estado de venta**: SIEMPRE a través de `ventaStore`. Nunca estado local para el carrito.
7. **Sin confirms del browser**: Para confirmaciones destructivas, usar el componente `ConfirmDialog`.
8. **Sin alerts del browser**: Para notificaciones, usar toast (sonner o react-hot-toast).
9. **Capacitor**: Usar `useCapacitor()` antes de llamar cualquier API nativa. Nunca asumir que el plugin existe sin verificar.
10. **Offline first**: Cualquier nueva funcionalidad debe funcionar sin internet. Supabase es opcional siempre.

---

## 📋 Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar en desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build (simula instalación PWA)
npm run preview

# Sincronizar con Android después de cambios
npx cap sync android

# Abrir en Android Studio
npx cap open android

# Deploy: push a main = Vercel deploy automático
git add . && git commit -m "mensaje" && git push origin main
```

---

## 🔮 Roadmap (Pendiente)

- Completar Fase 22: integración completa de notificaciones push (alertas de stock mínimo, recordatorios de fiado vencido)
- Integración con impresoras térmicas Bluetooth (usar `useBluetooth.ts` ya creado)
- Publicar en Google Play Store (ver `docs/fase-23-play-store.md`)
- IA conversacional para análisis de ventas (usar VITE_ANTHROPIC_API_KEY)
- Facturación electrónica DIAN (cuando sea obligatorio — preparado en ConfigFiscal)

---

_Este documento es la fuente de verdad del proyecto._
_Versión: 2.0 — Actualizado Marzo 2026 — Juan Camilo Pinzón_
