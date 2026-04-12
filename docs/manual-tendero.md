# POS Tienda de Barrio — Manual del Tendero

> Versión 4.1 — Abril 2026

---

## Contenido

1. Primeros pasos
2. Hacer una venta
3. Fiados y cartera
4. Productos e inventario
5. Caja diaria
6. Domicilios *(Solo Plan Pro)*
7. Proveedores y compras
8. Reportes
9. Empleados y nómina
10. Preguntas frecuentes

---

## 1. Primeros pasos

### Cómo instalar el POS en su celular

1. Abra el navegador Chrome en su celular Android
2. Vaya a **pos-tienda-ten.vercel.app**
3. Toque el botón "Instalar app" que aparece abajo, o use el menú del navegador → "Agregar a pantalla de inicio"
4. La app queda en su pantalla como cualquier otra aplicación

> **El POS funciona sin internet.** Aunque no tenga señal, puede seguir vendiendo normalmente.

### Configurar su tienda

1. Toque el ícono de engranaje ⚙️ en la parte superior derecha
2. Ingrese el nombre de su tienda, teléfono y NIT (opcional)
3. Escriba un mensaje para el recibo de sus clientes
4. Toque "Guardar"

### Planes disponibles

| Plan | Precio | Límite | Incluye |
|------|--------|--------|---------|
| Demo | Gratis | 50 ventas | Todas las funciones para probar |
| Básico | $500.000 COP (único) | Sin límite | Ventas, fiados, inventario, reportes |
| Pro | $900.000 COP (único) | Sin límite | Todo el básico + domicilios |
| Upgrade B→Pro | $450.000 COP | — | Activación con código |

### Activar el POS

#### Activar el Plan Básico
1. Al completar 50 ventas de prueba, el sistema le pedirá el código
2. También puede activarlo antes: Configuración → "Mi Plan" → "Activar POS"
3. Ingrese el código que le dio el instalador
4. Toast de confirmación: "POS activado — uso ilimitado habilitado"

#### El banner de demo
Mientras esté en modo demo verá un banner en la parte superior que muestra cuántas ventas le quedan. Desaparece al activar.

---

## 2. Hacer una venta

### Venta en 3 toques

1. Busque el producto por nombre o escanee el código de barras con la cámara
2. Seleccione la cantidad. Si vende por peso (cilantro, queso), puede ingresar directamente el valor en pesos que quiere el cliente
3. Toque "Cobrar" → elija cómo paga el cliente → confirme

> **Si el producto no está registrado**, toque "Vender sin registrar", ingrese el precio y listo. La venta nunca se bloquea.

### Formas de pago

| Forma de pago | Qué hace el sistema |
|---------------|---------------------|
| Efectivo | Calcula el cambio automáticamente |
| Nequi / Daviplata / Dale | Registra y pide verificar que llegó el dinero |
| Fiado | Registra la deuda en la cuenta del cliente |
| Mixto | Parte en efectivo, parte transferencia |

### Cambiar el precio durante la venta

1. Agregue el producto al carrito
2. Toque el precio en el carrito para editarlo
3. Ingrese el nuevo precio — solo aplica para esta venta

> Ideal para productos con precio variable como frutas y verduras.

### Lector de código de barras USB

#### Usar un lector USB en PC o portátil
Si tiene un lector de código de barras USB conectado al computador:
1. El lector funciona como un teclado — no necesita configuración
2. Abra el POS en Chrome y el campo de búsqueda queda listo automáticamente
3. Escanee el producto — aparece y se agrega al carrito solo
4. El campo se limpia para el siguiente escaneo

El POS detecta automáticamente si el código llegó de un lector (muy rápido) o si lo escribió usted (más lento) y actúa en consecuencia.

---

## 3. Fiados y cartera

### Registrar un fiado

1. En el modal de cobro, toque "Fiado"
2. Busque el cliente por nombre. Si es nuevo, créelo al vuelo — solo necesita el nombre
3. Confirme — la deuda queda registrada automáticamente

### Cobrar una deuda

1. Vaya a la sección "Fiados" en el menú
2. Busque el cliente y toque su nombre
3. Toque "Registrar pago" e ingrese el monto (puede ser parcial)
4. Confirme — el sistema actualiza la deuda del cliente

---

## 4. Productos e inventario

### Agregar un producto nuevo

1. Vaya a "Productos" en el menú
2. Toque el botón "+" en la esquina inferior derecha
3. Ingrese nombre, precio de venta y categoría. El costo es opcional pero ayuda a calcular su ganancia
4. Guarde — el producto ya aparece en el buscador del POS

> Si ingresa el porcentaje de ganancia deseado, el sistema calcula el precio de venta automáticamente.

### Alertas de stock bajo

1. En "Stock", verá los productos que están por debajo del mínimo
2. Un punto rojo en el ícono de Stock le avisa cuando hay productos agotados
3. En "Pedido", el sistema genera automáticamente la lista de lo que debe pedir según las ventas recientes, con prioridad: **Urgente** (menos de 3 días), **Pronto** (3-7 días), **Planificar** (7-15 días)

### Registrar un producto vencido o dañado (merma)

1. Vaya a "Stock" → toque "Registrar merma"
2. Seleccione el producto y el motivo (vencido, dañado, consumo interno)
3. Ingrese la cantidad perdida — el sistema descuenta del inventario y registra la pérdida en sus reportes

### Alertas de caducidad

El sistema le avisa 5 días antes de que venza un producto. En la pantalla de Stock verá las tarjetas de alerta con colores:
- 🔴 Rojo: ya venció
- 🟠 Naranja: vence hoy o mañana
- 🟡 Amarillo: vence en 3-5 días

---

## 5. Caja diaria

### Abrir la caja en la mañana

1. Vaya a "Caja" en el menú
2. Ingrese el efectivo con que empieza el día
3. Toque "Abrir caja" — todas las ventas del día quedan registradas en esta sesión

### Cerrar la caja al final del día

1. Cuente el efectivo físico que tiene en caja
2. Ingrese ese monto en "Cerrar caja"
3. El sistema muestra el resumen del día: ventas totales, efectivo, fiados, diferencia

> Si hay transferencias sin verificar, el sistema se lo avisará antes de cerrar. Confirme que el dinero llegó.

---

## 6. Domicilios *(Solo Plan Pro)*

### Activar el servicio de domicilios

1. Vaya a Configuración → "Mi Plan" → "Upgrade a Plan Pro"
2. Ingrese el código que le dio el instalador
3. Configure su número de WhatsApp y costo de envío por defecto

### Registrar un pedido a domicilio

1. Haga la venta normalmente. En el modal de cobro, seleccione "Domicilio"
2. Ingrese los datos del cliente: nombre, teléfono, dirección
3. El sistema genera un link único para el repartidor — compártalo por WhatsApp
4. Cuando el repartidor entregue, confirma desde su celular tocando "Entregué"

> En "Domicilios" puede ver el estado de todos los pedidos del día en tiempo real.

### Catálogo público para sus clientes

1. En Configuración → "Domicilios", active el catálogo y escriba un nombre corto (ej: "tienda-juan")
2. Comparta el link o el código QR con sus clientes
3. El cliente ve los productos disponibles y hace el pedido por WhatsApp

---

## 7. Proveedores y compras

### Registrar una compra al proveedor

1. Vaya a "Proveedores" en el menú
2. Seleccione el proveedor o créelo si es nuevo
3. Toque "Nueva compra" — puede fotografiar la factura y el sistema la lee automáticamente
4. Confirme los productos y cantidades, ingrese si pagó de contado o a crédito

---

## 8. Reportes

| Reporte | Para qué sirve |
|---------|----------------|
| Ventas del día / semana / mes | Ver cuánto ha vendido en cada período |
| Utilidad neta | Cuánto ganó después de costos y mermas |
| Productos más vendidos | Saber qué tiene que tener siempre en stock |
| Cartera morosa | Ver qué clientes llevan más de 30 días sin pagar |
| Auditoría de anulaciones | Ver quién anuló ventas, cuándo y por qué |
| Asistente IA | Preguntarle al sistema sobre sus ventas en lenguaje natural |

---

## 9. Empleados y nómina

### Registrar un empleado

1. Vaya a "Empleados" en el menú
2. Toque "Nuevo empleado" — solo necesita nombre, salario y fecha de ingreso
3. Cédula y cargo son opcionales

### Generar colilla de pago

1. Seleccione el empleado → "Nueva nómina"
2. El sistema calcula salud, pensión y deducciones automáticamente
3. Ajuste bonificaciones o días si es necesario
4. Toque "Generar colilla" → descargue el PDF o compártalo por WhatsApp

### Prestaciones sociales

El sistema calcula y le avisa cuándo deben pagarse:
- **Prima**: antes del 30 de junio y 20 de diciembre
- **Cesantías**: consignar antes del 14 de febrero
- **Intereses de cesantías**: pagar antes del 31 de enero

---

## 10. Preguntas frecuentes

**¿Qué hago si se va la luz o el internet?**
El POS sigue funcionando normalmente sin internet. Cuando vuelva la conexión, todo se sincroniza automáticamente a la nube.

**¿Cómo anulo una venta?**
Vaya a "Historial" → busque la venta → toque "Anular". El sistema le pedirá el motivo obligatoriamente. Solo el dueño puede ver el registro de anulaciones.

**¿Cómo instalo el POS en otro celular?**
Abra Chrome en el nuevo celular, vaya a pos-tienda-ten.vercel.app, inicie sesión con su correo y contraseña. Todos sus datos se sincronizan automáticamente.

**¿Cómo activo el Plan Pro?**
Vaya a Configuración → "Mi Plan" → "Upgrade a Plan Pro". Ingrese el código que le dio el instalador. Si no tiene el código, contáctenos por WhatsApp.

**¿Qué pasa si borro la app?**
Si usa la versión con Supabase (nube), sus datos están guardados en el servidor y puede recuperarlos iniciando sesión. Si usa el modo offline puro, los datos viven en el celular — no los borre sin hacer respaldo primero.

**¿Por qué aparece un punto rojo en Stock?**
Hay productos por debajo del mínimo configurado. Vaya a "Pedido" para ver qué debe comprar.

**¿El sistema calcula el precio de venta automáticamente?**
Sí. Al ingresar el costo del producto y el porcentaje de ganancia, el sistema calcula el precio correcto. La ganancia del 30% significa que de cada $100 que vende, $30 son suyos.

**¿Funciona en un PC o portátil?**
Sí. Abra Chrome, vaya a pos-tienda-ten.vercel.app y Chrome le ofrecerá instalarlo como app. Puede conectar un lector de código de barras USB y funciona exactamente igual que en celular.

**¿Cuántas ventas puedo hacer en el modo demo?**
El modo demo permite 50 ventas completas para que pruebe todas las funciones. Después necesita activar con el código de su instalador.

---

*POS Tienda de Barrio — pos-tienda-ten.vercel.app*
*Versión 4.1 — Abril 2026 — Juan Camilo Pinzón*
