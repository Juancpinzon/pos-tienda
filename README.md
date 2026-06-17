# POS Tienda de Barrio 🏪

Sistema de punto de venta **offline-first** para tiendas de barrio colombianas.
Funciona sin internet. Se instala como app en Android desde el navegador (PWA) o como APK nativo (Capacitor).

[![Demo](https://img.shields.io/badge/demo-en%20vivo-16a34a)](https://pos-tienda-ten.vercel.app)
[![Deploy](https://img.shields.io/badge/deploy-vercel-000000?logo=vercel)](https://vercel.com)
[![License: Proprietary](https://img.shields.io/badge/licencia-propietario-dc2626)](./LICENSE)

---

## ¿Qué resuelve?

Los POS tradicionales fallan en tiendas de barrio porque:

1. **Bloquean ventas** si el producto no está en el sistema
2. **Piden cédula o correo** para registrar un fiado
3. **Requieren internet estable** para funcionar
4. **Tienen interfaces** diseñadas para cajeros de supermercado, no para tenderos

Este sistema resuelve exactamente esos 4 problemas.

---

## Demo en vivo

**[pos-tienda-ten.vercel.app](https://pos-tienda-ten.vercel.app)**

Abrir en Chrome móvil → instalar como app desde el menú del navegador. El modo demo incluye 50 ventas gratuitas con todas las funciones activas.

---

## Stack tecnológico

| Capa | Tecnología | Razón |
|------|-----------|-------|
| Framework | React 18 + TypeScript | Ecosistema, velocidad |
| Styling | Tailwind CSS v3 + shadcn/ui | Accesible, sin overhead |
| DB local | **Dexie.js (IndexedDB)** | Offline-first — fuente de verdad |
| Estado global | Zustand | Liviano, predecible |
| Build | Vite 6 + Vite PWA | Build rápido + service worker |
| Nube | Supabase | Auth, sync, Edge Functions |
| Deploy | Vercel | Push a `main` = deploy automático |
| Android | Capacitor 8 | APK desde el mismo código React |
| IA | Claude API via Edge Functions | OCR facturas + asistente ventas |

---

## Inicio rápido

### Requisitos previos

```
Node.js 18+
npm 9+
```

### Instalación

```bash
git clone https://github.com/Juancpinzon/pos-tienda
cd pos-tienda
npm install
npm run dev            # → http://localhost:5173
```

La app funciona completa sin configurar Supabase. Para habilitar sync en nube y autenticación:

```env
# .env (crear en la raíz del proyecto)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Comandos principales

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción → dist/
npm run preview      # Preview del build (simula PWA instalada)

# Android
npx cap sync android # Sincronizar código con Capacitor
npx cap open android # Abrir en Android Studio

# Deploy (automático vía Vercel)
git push origin main
```

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────┐
│  Cliente  (React PWA / Capacitor Android)                │
│                                                          │
│  Dexie.js (IndexedDB)  ←→  Zustand stores               │
│  ← fuente de verdad local →                              │
│         ↕  lib/sync.ts (auto-sync bidireccional)         │
└──────────────────────┬───────────────────────────────────┘
                       │  HTTPS (solo si hay internet)
┌──────────────────────▼───────────────────────────────────┐
│  Supabase                                                │
│  ├── Auth  (JWT · roles: dueño / encargado / cajero)     │
│  ├── PostgreSQL  (mirror de IndexedDB en nube)           │
│  ├── Edge Functions                                      │
│  │   ├── validar-codigo    (activa Plan Básico / Pro)    │
│  │   ├── analizar-factura  (OCR via Claude Vision)       │
│  │   └── asistente-ventas  (IA análisis de ventas)       │
│  └── RLS  (Row Level Security por tienda)                │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────┐
│  Vercel — pos-tienda-ten.vercel.app                      │
│  Push a main → deploy automático                         │
└──────────────────────────────────────────────────────────┘
```

> **Regla fundamental:** IndexedDB es la fuente de verdad. Supabase es el backup en nube. La app funciona 100% sin internet.

---

## Funcionalidades

| Módulo | Descripción |
|--------|-------------|
| **POS** | Venta en <3 toques, productos fantasma, precios volátiles, lector USB/cámara |
| **Fiados** | Cartera sin datos obligatorios — solo el nombre del cliente |
| **Inventario** | Stock, mermas, alertas de caducidad, pedido predictivo |
| **Proveedores** | Compras con OCR de facturas, historial de pagos a crédito |
| **Caja** | Apertura/cierre diario, gastos, conciliación de transferencias |
| **Reportes** | Métricas, auditoría inmutable de anulaciones, asistente IA |
| **Domicilios** | Kanban, link único para repartidor, catálogo público *(Plan Pro)* |
| **Nómina** | Empleados, colillas PDF, prestaciones sociales Colombia |
| **Multi-tienda** | Dashboard consolidado para dueños con 2+ locales |

---

## Modelo de planes

| Plan | Precio | Activación | Ventas |
|------|--------|-----------|--------|
| Demo | Gratis | Sin código | 50 |
| Básico | $500.000 COP único | `TIENDA-XXXX` | Ilimitadas |
| Pro | $900.000 COP único | `PRO-XXXX` | Ilimitadas + domicilios |
| Upgrade B→Pro | $450.000 COP único | `UPG-XXXX` | — |

Los códigos se validan server-side vía la Edge Function `validar-codigo` (los patrones nunca están en el bundle del cliente).

---

## Estructura del proyecto

```
src/
├── db/
│   ├── schema.ts        # Interfaces TypeScript de todas las tablas
│   ├── database.ts      # Instancia Dexie singleton + migraciones
│   └── seed.ts          # 2.712 productos en 41 categorías
├── stores/              # Zustand: ventaStore, cajaStore, authStore, uiStore
├── hooks/               # Acceso a Dexie (NUNCA desde componentes directamente)
├── lib/
│   ├── supabase.ts      # Cliente + flag supabaseConfigurado
│   ├── sync.ts          # Sync bidireccional con resolución de conflictos
│   └── notificaciones.ts
├── components/          # UI organizada por módulo
├── pages/               # Una página por ruta
└── utils/
    ├── moneda.ts        # formatCOP() — siempre usar esto para pesos
    ├── nomina.ts        # SMMLV, fórmulas prestaciones Colombia
    └── impresion.ts     # ESC/POS para impresoras térmicas
```

---

## Documentación adicional

- [Documentación técnica](./docs/documentacion-tecnica.md) — arquitectura, schema, reglas de código, known issues
- [Manual del tendero](./docs/manual-tendero.md) — cómo usar el POS (lenguaje no técnico)
- [Guía de deploy](./docs/guia-deploy.md) — Vercel, Supabase, Edge Functions paso a paso
- [Guía Play Store](./docs/fase-23-play-store.md) — publicar en Google Play

---

## Principios de diseño

1. **Nunca bloquear una venta** — si el producto no existe, vender igual como "fantasma"
2. **El fiado es de primera clase** — tan rápido como cobrar en efectivo
3. **Offline primero, siempre** — Supabase es un bonus, no un requisito
4. **Interfaz para manos, no para ratones** — botones mínimo 60px, texto mínimo 15px
5. **Precios volátiles son la norma** — cambiar precio en la venta es flujo principal

---

## Licencia

Propietario — © 2026 Juan Camilo Pinzón. Todos los derechos reservados.
Repositorio: [github.com/Juancpinzon/pos-tienda](https://github.com/Juancpinzon/pos-tienda)
