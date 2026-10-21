# Manual del panel de administración

Guía para quien maneja la tienda. No hace falta saber de computación: cada tarea tiene sus pasos, uno por uno.

> **Dónde entrar:** escribí en el navegador la dirección de tu tienda seguida de `/admin/`. Por ejemplo, `https://tutienda.com.ar/admin/`. Guardala en favoritos.

---

## 1. Entrar al panel

1. Abrí la dirección del panel.
2. Escribí tu **email** y tu **contraseña** y tocá **Ingresar**.
3. Vas a ver arriba una fila de botones: *Resumen, Productos, Stock, Pedidos, Clientes, Categorías, Configuración*. En la compu aparecen en una columna a la izquierda. Tocás el que necesites.

**Para salir:** botón **Cerrar sesión**. Hacelo siempre si usás una compu que no es tuya.

**Si te olvidaste la contraseña:** entrá a la página *Mi cuenta* de tu tienda y tocá **Olvidé mi contraseña**. Te llega un mail con un enlace para elegir una nueva.

**Si ves "Tu cuenta no tiene permisos de administración":** estás usando una cuenta que no es la de administrador. Cerrá sesión y entrá con la correcta.

---

## 2. Ver cómo viene la tienda (pestaña *Resumen*)

Es la pantalla de inicio del panel. Muestra:
- **Ventas del mes**: cuánto vendiste este mes (no cuenta los pedidos cancelados).
- **Pedidos pendientes**: los que todavía no atendiste.
- **Productos** y **Sin stock**: cuántos productos tenés y cuántos se quedaron sin unidades.
- Un **gráfico de barras** con las ventas de los últimos 6 meses.
- Los **5 productos más vendidos**.
- Cuántos pedidos hay en cada estado.

---

## 3. Cargar un producto nuevo (con fotos)

1. Tocá **Productos** y después **+ Nuevo producto**.
2. Completá los datos:
   - **Nombre**: como lo van a ver tus clientes.
   - **Categoría**: elegí una de la lista (si no hay ninguna, primero creala, ver el punto 6).
   - **Precio**: solo números, sin puntos ni signo $. Ejemplo: `8500`.
   - **Emoji**: un dibujito que se muestra si el producto todavía no tiene foto.
   - **Descripción corta**: una línea que aparece en el catálogo.
   - **Descripción larga**: el detalle completo (medidas, materiales, cuidados). Opcional.
   - **Orden**: un número para ordenar la lista (el más chico va primero). Si no te importa, dejá 0.
3. Tildá lo que corresponda:
   - **Disponible**: si lo destildás, el producto **se oculta** de la tienda (sin borrarlo).
   - **Destacado**: lo muestra en la página de inicio.
4. **Stock**: escribí cuántas unidades tenés. (Si el producto tiene modelos, ver el punto 4.)
5. **Fotos:** tocá la zona punteada y elegí las fotos de tu celular o compu (hasta 8). También podés arrastrarlas.
   - Cada foto aparece con una vista previa.
   - **La primera foto es la portada** (la que se ve en el catálogo). Para cambiar el orden usá las flechas **↑ ↓** de cada foto.
   - Para sacar una foto, tocá la **✕**.
   - No te preocupes por el tamaño: la tienda las achica sola antes de subirlas, así el sitio carga rápido.
6. Tocá **Guardar**. Mientras sube las fotos vas a ver mensajes como "Subiendo foto 2 de 3…". Esperá a que la ventana se cierre.

**Para editar** un producto: en la lista, tocá **Editar**. **Para borrarlo:** tocá **Eliminar** y confirmá. Se borran también sus fotos y no se puede deshacer; si solo querés esconderlo, destildá *Disponible*.

**Atajos en la lista:** los cuadraditos de *Disponible* y *Destacado* se pueden tildar y destildar directo, sin abrir el producto.

---

## 4. Productos con modelos (talles, colores, etc.)

Cuando un mismo producto viene en varias versiones (por ejemplo, una manta en *Crudo* y en *Gris*), cada versión tiene su propio stock.

1. Al crear o editar el producto, tildá **Tiene modelos**.
2. Aparecen filas para los modelos: escribí el **nombre** (Crudo, Gris, Talle M…) y el **stock** de cada uno.
3. Tocá **+ Agregar modelo** para sumar más, o la **✕** para quitar uno. Tiene que haber **al menos 2**.
4. Tocá **Guardar**.

En la tienda, el cliente elige el modelo antes de agregar al carrito. Los modelos sin stock aparecen tachados y no se pueden elegir.

---

## 5. Actualizar el stock rápido (pestaña *Stock*)

1. Tocá **Stock**. Ves una fila por producto (o por cada modelo).
2. Cambiá el número y salí del casillero (tocá afuera o la tecla Tab). **Se guarda solo** y aparece un aviso verde.
3. Los colores te ayudan: **rojo** = no queda nada, **ámbar** = quedan 3 o menos, **verde** = hay.

---

## 6. Ordenar los productos en categorías (pestaña *Categorías*)

1. Tocá **Categorías** y después **+ Nueva categoría**.
2. Escribí el **nombre**. El *slug* (la parte que se ve en el link) se arma solo; no hace falta tocarlo.
3. Elegí un **emoji** y un **color** (se usa de fondo en la tarjeta de la categoría).
4. Dejá tildada **Activa** para que se muestre en la tienda. Tocá **Guardar**.
5. Para cambiar el orden en que aparecen, usá las flechas **↑ ↓** de la lista.
6. **Borrar:** si la categoría tiene productos, no te deja borrarla. En ese caso destildá **Activa** (la esconde) o pasá sus productos a otra categoría.

> **Si no ves un cambio en la tienda:** la tienda guarda los datos unos minutos para ir más rápido. Esperá hasta 5 minutos o cerrá la pestaña de la tienda y abrila de nuevo.

---

## 7. Atender los pedidos (pestaña *Pedidos*)

Cuando un cliente confirma un pedido, **te llega por WhatsApp** y además queda guardado acá.

1. Tocá **Pedidos**. Aparece la lista, del más nuevo al más viejo. Cada pedido tiene su **código** (por ejemplo `CN-00012`).
2. Tocá un pedido para abrirlo: ves los productos, la dirección de entrega, las notas del cliente y sus datos de contacto.
3. Para hablar con el cliente, tocá **Escribir por WhatsApp**.
4. Cambiá el **Estado** del pedido a medida que avanza:

| Estado | Qué significa | Qué pasa con el stock |
|---|---|---|
| **Pendiente** | Llegó el pedido, todavía no lo atendiste | No cambia |
| **Confirmado** | Lo hablaste con el cliente y lo vas a preparar | **Se descuenta** el stock |
| **Enviado** | Ya salió | No cambia |
| **Entregado** | El cliente lo recibió | No cambia |
| **Cancelado** | No se hizo | Si ya se había descontado, **se devuelve** |

5. Para buscar: escribí el código o el nombre del cliente en el buscador, o filtrá por estado.
6. **Exportar a Excel**: baja un archivo de Excel (.xlsx) con los pedidos que estás viendo (si filtraste o buscaste, solo esos). Viene ya armado como **tabla**: con filtros en cada columna, filas alternadas y el dinero y las fechas con su formato. Se abre con Excel o con Google Sheets.

> El stock **se descuenta recién cuando pasás el pedido a Confirmado**, no cuando el cliente lo hace. Así podés rechazar un pedido sin que se pierda stock.

---

## 8. Ver a tus clientes (pestaña *Clientes*)

- Lista con nombre, email, teléfono, fecha de alta y cantidad de pedidos.
- Tocá el nombre de un cliente para ver todos sus pedidos y escribirle por WhatsApp.
- **Exportar a Excel** baja la lista completa de clientes como tabla de Excel (.xlsx).

---

## 9. Cambiar los datos de la tienda (pestaña *Configuración*)

Acá cambiás los textos que ve el público. Completá y tocá **Guardar cambios**:

- **Nombre de la tienda** y **eslogan**.
- **Título y texto de la portada**, y **"Sobre nosotros"**.
- **WhatsApp**: **solo números, con el código de país y sin el +**. Para Argentina, un celular de Buenos Aires se escribe así: `5491155556666`. Es el número al que llegan los pedidos: revisalo bien.
- **Instagram** (tu usuario) y **email de contacto**.
- **Texto de envíos**: cómo y cuándo entregás.
- **Saludo del mensaje de WhatsApp**: la primera línea que va en cada pedido.
- **Prefijo de los pedidos**: las letras que aparecen en el código (por ejemplo `CN` → `CN-00001`).

---

## 10. Problemas frecuentes

- **"Subí un cambio y no lo veo en la tienda."** Esperá unos minutos o recargá la página. Si estás en el celular, cerrá la pestaña y abrila de nuevo.
- **Una foto no se sube.** Probá con otra foto o en formato JPG/PNG. Si el celular guarda las fotos en un formato raro, sacá una captura de pantalla de la foto y subí esa.
- **No me llegan los pedidos por WhatsApp.** Revisá en *Configuración* que el número esté bien (solo números, con código de país).
- **Un cliente dice que no puede entrar.** Que use *Olvidé mi contraseña* en la página *Mi cuenta*.
- **Cualquier otra cosa:** escribile a quien te armó la tienda.
