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
Todo funciona sin internet. La sincronización es un bonus, no un requisito.
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

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Razón |
|------|-----------|-------|
| Frontend framework | React 18 + TypeScript | Ecosistema, velocidad de desarrollo |
| Styling | Tailwind CSS v3 | Clases utilitarias, consistencia |
| Componentes UI | shadcn/ui | Accesibles, customizables, sin overhead |
| Base de datos local | Dexie.js (wrapper de IndexedDB) | Offline-first, queries rápidas, sin servidor |
| Estado global | Zustand | Liviano, simple, predecible |
| Formularios | react-hook-form + Zod | Validación tipo-segura |
| Build tool | Vite | Velocidad de desarrollo |
| Instalación como app | PWA (Vite PWA plugin) | Se instala como app nativa desde el navegador |
| Icons | Lucide React | Consistentes, ligeros |
| Números/moneda | numeral.js | Formateo de pesos colombianos |

**NO usar:** Supabase, Firebase, ni ningún servicio en la nube. Todo es local.

---

## 📁 Estructura del Proyecto

```
pos-tienda/
├── public/
│   ├── manifest.json          # PWA manifest
│   └── icons/                 # Iconos para instalar app
├── src/
│   ├── db/
│   │   ├── schema.ts          # Definición de tablas Dexie
│   │   ├── database.ts        # Instancia singleton de Dexie
│   │   └── seed.ts            # Carga inicial de 400 productos
│   ├── stores/
│   │   ├── ventaStore.ts      # Estado de la venta activa
│   │   ├── cajaStore.ts       # Estado de la sesión de caja
│   │   └── uiStore.ts         # Estado de modales y navegación
│   ├── hooks/
│   │   ├── useProductos.ts    # Búsqueda y CRUD de productos
│   │   ├── useFiados.ts       # Gestión de cartera
│   │   ├── useVentas.ts       # Registro de transacciones
│   │   └── useCaja.ts         # Sesiones de caja
│   ├── components/
│   │   ├── pos/               # Pantalla principal de venta
│   │   │   ├── BuscadorProducto.tsx
│   │   │   ├── GridProductosRapidos.tsx
│   │   │   ├── LineaVenta.tsx
│   │   │   ├── ResumenVenta.tsx
│   │   │   └── ModalCobro.tsx
│   │   ├── fiado/             # Módulo de cartera
│   │   │   ├── ListaClientes.tsx
│   │   │   ├── CuentaCliente.tsx
│   │   │   └── ModalNuevoPago.tsx
│   │   ├── productos/         # Gestión de inventario
│   │   │   ├── ListaProductos.tsx
│   │   │   ├── FormProducto.tsx
│   │   │   └── CategoriaChip.tsx
│   │   ├── caja/              # Sesiones de caja
│   │   │   ├── AbrirCaja.tsx
│   │   │   ├── CerrarCaja.tsx
│   │   │   └── ResumenCaja.tsx
│   │   └── shared/            # Componentes reutilizables
│   │       ├── TecladoNumerico.tsx
│   │       ├── ConfirmDialog.tsx
│   │       └── MonedaDisplay.tsx
│   ├── pages/
│   │   ├── POSPage.tsx        # Pantalla principal (ruta /)
│   │   ├── FiadosPage.tsx     # Cartera de clientes (ruta /fiados)
│   │   ├── ProductosPage.tsx  # Gestión de productos (ruta /productos)
│   │   ├── CajaPage.tsx       # Resumen de caja (ruta /caja)
│   │   └── ReportesPage.tsx   # Reportes básicos (ruta /reportes)
│   ├── types/
│   │   └── index.ts           # Todos los tipos TypeScript
│   ├── utils/
│   │   ├── moneda.ts          # Formateo de pesos COP
│   │   ├── fecha.ts           # Utilidades de fecha
│   │   └── impresion.ts       # Generador de recibos (texto plano)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── CLAUDE.md                  # Este archivo
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
  nombre: string;           // "Lácteos", "Granos", "Bebidas", etc.
  emoji: string;            // "🥛", "🌾", "🥤"
  orden: number;            // Para ordenar en la UI
}

export interface Producto {
  id?: number;
  nombre: string;
  categoriaId: number;
  precio: number;           // Precio en pesos COP (sin decimales)
  precioCompra?: number;    // Costo (opcional, para margen)
  codigoBarras?: string;    // Código EAN si tiene
  stockActual?: number;     // null = no controla stock
  stockMinimo?: number;     // Para alertas
  unidad: 'unidad' | 'gramo' | 'mililitro' | 'porcion';
  esFantasma: boolean;      // true = producto no catalogado
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface Cliente {
  id?: number;
  nombre: string;           // Solo nombre, nada más obligatorio
  telefono?: string;        // Opcional
  direccion?: string;       // Opcional
  limiteCredito?: number;   // En COP. null = sin límite
  totalDeuda: number;       // Calculado, se actualiza con cada fiado
  activo: boolean;
  creadoEn: Date;
}

export interface SesionCaja {
  id?: number;
  montoApertura: number;    // Efectivo con que se abre la caja
  montoCierre?: number;     // Efectivo al cerrar
  totalVentas: number;      // Calculado al cerrar
  totalEfectivo: number;
  totalFiado: number;
  totalGastos: number;
  abiertaEn: Date;
  cerradaEn?: Date;
  estado: 'abierta' | 'cerrada';
  notas?: string;
}

export interface Venta {
  id?: number;
  sesionCajaId: number;
  clienteId?: number;       // null = cliente anónimo (mostrador)
  subtotal: number;
  descuento: number;
  total: number;
  tipoPago: 'efectivo' | 'fiado' | 'transferencia' | 'mixto';
  efectivoRecibido?: number;
  cambio?: number;
  estado: 'completada' | 'anulada';
  notas?: string;
  creadaEn: Date;
}

export interface DetalleVenta {
  id?: number;
  ventaId: number;
  productoId?: number;      // null = producto fantasma
  nombreProducto: string;   // Snapshot del nombre al momento de vender
  cantidad: number;         // Puede ser fraccionado (0.5, 250)
  precioUnitario: number;   // Snapshot del precio al momento de vender
  descuento: number;
  subtotal: number;
  esProductoFantasma: boolean;
}

export interface MovimientoFiado {
  id?: number;
  clienteId: number;
  ventaId?: number;         // null = pago directo de deuda
  tipo: 'cargo' | 'pago';
  monto: number;
  descripcion: string;
  creadoEn: Date;
  sesionCajaId?: number;
}

export interface GastoCaja {
  id?: number;
  sesionCajaId: number;
  descripcion: string;      // "Cambio de bombillo", "Bolsas plásticas"
  monto: number;
  tipo: 'hormiga' | 'proveedor' | 'servicio' | 'otro';
  creadoEn: Date;
}

export interface ConfigTienda {
  id?: number;              // Siempre 1 (singleton)
  nombreTienda: string;
  direccion?: string;
  telefono?: string;
  nit?: string;
  mensajeRecibo?: string;
  monedaSimbol: string;     // "$"
  impuestoIVA: number;      // 0 = no aplica IVA
  permitirStockNegativo: boolean;  // true para tiendas sin control estricto
  limiteFiadoPorDefecto: number;   // COP. 0 = sin límite por defecto
}

// ─── Módulo de Proveedores y Compras (v2) ─────────────────────────────────────

export interface Proveedor {
  id?: number;
  nombre: string;           // "Lácteos El Campo", "Distribuidora Colanta"
  telefono?: string;
  contacto?: string;        // Nombre del vendedor
  diasVisita?: string;      // "Lunes y Jueves"
  saldoPendiente: number;   // Lo que le debo al proveedor
  activo: boolean;
  creadoEn: Date;
}

export interface CompraProveedor {
  id?: number;
  proveedorId: number;
  sesionCajaId?: number;
  total: number;
  pagado: number;           // Puede pagar parcial
  saldo: number;            // total - pagado
  tipoPago: 'contado' | 'credito' | 'mixto';
  notas?: string;           // "Factura #1234"
  creadaEn: Date;
}

export interface DetalleCompra {
  id?: number;
  compraId: number;
  productoId?: number;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;   // Precio de costo
  subtotal: number;
}

export interface PagoProveedor {
  id?: number;
  proveedorId: number;
  compraId?: number;        // null = abono general
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
1. Tendero busca producto (por nombre o código de barras)
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

---

## 🎨 Sistema de Diseño

### Paleta de Colores

```css
/* Colores principales - inspirados en la tienda de barrio */
--color-primario: #2D6A4F;        /* Verde tienda */
--color-primario-hover: #1B4332;
--color-acento: #F77F00;          /* Naranja cálido */
--color-acento-hover: #D62828;
--color-fondo: #FAFAF7;           /* Blanco cálido */
--color-superficie: #FFFFFF;
--color-borde: #E8E8E0;
--color-texto: #1A1A1A;
--color-texto-suave: #6B7280;
--color-peligro: #DC2626;
--color-exito: #16A34A;
--color-advertencia: #D97706;
--color-fiado: #7C3AED;           /* Morado para fiado */
```

### Tipografía

- **Display/Títulos**: `font-family: 'Nunito', sans-serif` — redondeado, amigable
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

## 📦 Seed Data — 400 Productos Iniciales

El archivo `src/db/seed.ts` debe contener una carga inicial de productos comunes.

### Categorías a incluir:

| ID | Nombre | Emoji |
|----|--------|-------|
| 1 | Lácteos | 🥛 |
| 2 | Carnes y Embutidos | 🥩 |
| 3 | Panadería | 🍞 |
| 4 | Granos y Harinas | 🌾 |
| 5 | Bebidas | 🥤 |
| 6 | Snacks y Dulces | 🍬 |
| 7 | Aseo Personal | 🧴 |
| 8 | Aseo Hogar | 🧹 |
| 9 | Frutas y Verduras | 🥬 |
| 10 | Cigarrillos | 🚬 |
| 11 | Enlatados | 🥫 |
| 12 | Condimentos | 🧂 |
| 13 | Varios | 📦 |

### Muestra de productos por categoría (el seed completa 400):

```typescript
// Lácteos
{ nombre: 'Leche Entera 1L', categoriaId: 1, precio: 4200, unidad: 'unidad' },
{ nombre: 'Leche Deslactosada 1L', categoriaId: 1, precio: 4600, unidad: 'unidad' },
{ nombre: 'Kumis 200ml', categoriaId: 1, precio: 2100, unidad: 'unidad' },
{ nombre: 'Yogurt Natural 200g', categoriaId: 1, precio: 2500, unidad: 'unidad' },
{ nombre: 'Queso Campesino (x100g)', categoriaId: 1, precio: 3200, unidad: 'gramo' },
{ nombre: 'Queso Doble Crema (x100g)', categoriaId: 1, precio: 3800, unidad: 'gramo' },
{ nombre: 'Mantequilla 125g', categoriaId: 1, precio: 5200, unidad: 'unidad' },

// Panadería
{ nombre: 'Pan Tajado Bimbo', categoriaId: 3, precio: 7500, unidad: 'unidad' },
{ nombre: 'Mogolla', categoriaId: 3, precio: 500, unidad: 'unidad' },
{ nombre: 'Almojábana', categoriaId: 3, precio: 1500, unidad: 'unidad' },
{ nombre: 'Pandequeso', categoriaId: 3, precio: 1200, unidad: 'unidad' },

// Granos
{ nombre: 'Arroz Diana 500g', categoriaId: 4, precio: 3200, unidad: 'unidad' },
{ nombre: 'Arroz Diana 1kg', categoriaId: 4, precio: 5800, unidad: 'unidad' },
{ nombre: 'Frijol Bola Roja 500g', categoriaId: 4, precio: 4500, unidad: 'unidad' },
{ nombre: 'Lenteja 500g', categoriaId: 4, precio: 3800, unidad: 'unidad' },
{ nombre: 'Harina de Trigo 1kg', categoriaId: 4, precio: 4200, unidad: 'unidad' },
{ nombre: 'Azúcar 1kg', categoriaId: 4, precio: 4800, unidad: 'unidad' },

// Bebidas
{ nombre: 'Gaseosa Coca-Cola 400ml', categoriaId: 5, precio: 3200, unidad: 'unidad' },
{ nombre: 'Agua Cristal 600ml', categoriaId: 5, precio: 2000, unidad: 'unidad' },
{ nombre: 'Postobón Manzana 400ml', categoriaId: 5, precio: 2800, unidad: 'unidad' },
{ nombre: 'Jugo Hit 330ml', categoriaId: 5, precio: 2500, unidad: 'unidad' },

// ... completar hasta 400 productos en seed.ts
```

---

## 🖥️ Pantallas y Navegación

### Layout principal (PWA)

```
┌─────────────────────────────────────────────────────┐
│  [🏪 Logo/Nombre Tienda]        [Caja: $45.200] 💰  │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│  Nav     │   CONTENIDO PRINCIPAL                    │
│  lateral │                                          │
│  (íconos)│                                          │
│          │                                          │
│  🏪 POS  │                                          │
│  📒 Fiado│                                          │
│  📦 Prod │                                          │
│  💰 Caja │                                          │
│  📊 Rep  │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

### Pantalla POS (pantalla principal)

```
┌─────────────────────────────────────────────────────────────┐
│  [🔍 Buscar producto o código...]              [+ Fantasma]  │
├──────────────────────────────┬──────────────────────────────┤
│                              │                              │
│  GRID PRODUCTOS RÁPIDOS      │  CARRITO DE VENTA            │
│  (los más vendidos)          │                              │
│  ┌────────┐ ┌────────┐       │  Leche Entera 1L             │
│  │  🥛    │ │  🍞    │       │  1 x $4.200         $4.200  │
│  │ Leche  │ │  Pan   │       │  ─────────────────────────  │
│  │ $4.200 │ │  $500  │       │  Mogolla                     │
│  └────────┘ └────────┘       │  2 x $500           $1.000  │
│  ┌────────┐ ┌────────┐       │  ─────────────────────────  │
│  │  🥚    │ │  🧴    │       │                              │
│  │ Huevo  │ │Shampo  │       │                              │
│  │  $700  │ │$5.900  │       │  ─────────────────────────  │
│  └────────┘ └────────┘       │  TOTAL:           $5.200    │
│                              │                              │
│  [Ver más productos...]      │  [🗑️ Limpiar]  [💰 COBRAR]  │
└──────────────────────────────┴──────────────────────────────┘
```

---

## ⚙️ Configuración Vite + PWA

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'POS Tienda',
        short_name: 'POS',
        description: 'Punto de Venta para Tienda de Barrio',
        theme_color: '#2D6A4F',
        background_color: '#FAFAF7',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
          }
        ]
      }
    })
  ]
})
```

---

## 🚀 Orden de Construcción para Claude Code

Construir exactamente en este orden. Cada fase debe funcionar antes de pasar a la siguiente.

### Fase 0: Scaffolding (30 min)
- [ ] `npm create vite@latest pos-tienda -- --template react-ts`
- [ ] Instalar dependencias: `dexie dexie-react-hooks zustand react-hook-form zod numeral react-router-dom lucide-react`
- [ ] Instalar dev: `vite-plugin-pwa @types/numeral`
- [ ] Configurar Tailwind + shadcn/ui
- [ ] Configurar `vite.config.ts` con PWA
- [ ] Crear estructura de carpetas completa

### Fase 1: Base de Datos (1h)
- [ ] Implementar `src/db/schema.ts` con todas las interfaces
- [ ] Implementar `src/db/database.ts` con Dexie singleton
- [ ] Implementar `src/db/seed.ts` con 400 productos
- [ ] Escribir hook `useSeed()` para poblar DB en primer uso

### Fase 2: POS Core (2h)
- [ ] `BuscadorProducto.tsx` con debounce y búsqueda por nombre/código
- [ ] `GridProductosRapidos.tsx` con los 12 más vendidos
- [ ] `ventaStore.ts` (Zustand): estado del carrito
- [ ] `LineaVenta.tsx` con controles de cantidad y eliminar
- [ ] `ResumenVenta.tsx` con total formateado
- [ ] `ModalCobro.tsx` con opciones Efectivo/Fiado/Transferencia
- [ ] `TecladoNumerico.tsx` para ingresar billetes y cambio

### Fase 3: Fiados (1.5h)
- [ ] `useFiados.ts` hook con CRUD completo
- [ ] `ListaClientes.tsx` con búsqueda y deuda total
- [ ] `CuentaCliente.tsx` con historial de movimientos
- [ ] `ModalNuevoPago.tsx` para abonar a deuda

### Fase 4: Gestión de Productos (1h)
- [ ] `useProductos.ts` hook con CRUD completo
- [ ] `ListaProductos.tsx` con filtro por categoría
- [ ] `FormProducto.tsx` para crear/editar producto

### Fase 5: Caja y Reportes (1h)
- [ ] `useCaja.ts` hook para sesiones de caja
- [ ] `AbrirCaja.tsx` y `CerrarCaja.tsx`
- [ ] `ResumenCaja.tsx` con totales del día
- [ ] `ReportesPage.tsx` con ventas por día y productos más vendidos

### Fase 6: Pulido (30 min)
- [ ] Configuración de la tienda (nombre, NIT, mensaje recibo)
- [ ] Generador de recibo en texto (para imprimir o compartir por WhatsApp)
- [ ] Modo oscuro opcional
- [ ] Icono e instalación PWA

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
```

---

## 🔮 Roadmap Futuro (No construir ahora)

- Sincronización con servidor para respaldo en la nube
- Lector de código de barras con cámara del celular
- Integración con impresoras térmicas Bluetooth
- Módulo de proveedores y órdenes de compra
- Multi-tienda (para el tendero que tiene 2 locales)
- App móvil nativa (si la PWA no es suficiente)

---

*Este documento es la fuente de verdad del proyecto.*
*Versión: 1.0 — Creado con Claude Sonnet para Juan Camilo*
