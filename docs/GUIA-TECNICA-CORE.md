# Guía técnica del motor (para quien programa: Claude o Martin)

> **Leer esto primero, en cada sesión de trabajo sobre un cliente.** Explica qué es el motor, qué piezas se pueden rediseñar sin riesgo y cuáles no, cómo armar un sitio público a medida y cómo verificar que nada se rompió.
> El plan original está en `docs/PLAN.md` y el estado del proyecto en `docs/PROGRESO.md`. Versión del motor: **1.0** (ver `docs/CHANGELOG-MOTOR.md`).

---

## 1. La idea en una frase
Este repositorio es un **motor de catálogo con pedidos** (base de datos con seguridad, carrito, pedidos, cuentas, panel de administración) **más un sitio público de ejemplo** (el demo). A cada cliente se le entrega un **sitio público diseñado a medida** que usa el mismo motor. El demo muestra *funcionamiento*, no estilo.

## 2. Las capas

| Capa | Archivos | ¿Se rediseña por cliente? |
|---|---|---|
| ▓ **MOTOR** (lógica) | `js/lib/*.js`, `js/supabase-client.js` | **No.** Igual para todos |
| **Datos y seguridad** | `supabase/schema.sql`, `supabase/tests/rls_tests.sql` | **No**, salvo cambios deliberados (ver §9) |
| ▒ **PANEL** de administración | `admin/index.html`, `js/pages/admin/*.js`, `css/admin.css` | **No.** Solo cambia la marca (colores y logo) vía `theme.css` |
| ░ **SITIO** público | `index.html`, `catalogo.html`, `cuenta.html`, `js/pages/home.js`, `catalogo.js`, `cuenta.js`, `js/components/*.js`, `css/*.css` (menos `admin.css`) | **Sí** |
| **Configuración por cliente** | `js/site.config.js`, `css/theme.css`, `assets/`, metas marcadas `CLIENTE` | Sí, siempre |
| **Infraestructura** | `_headers` (CSP y cabeceras), `robots.txt`, `sitemap.xml` | Solo dominio; la CSP no se toca sin decisión |

Cada archivo JS empieza con una línea que dice a qué capa pertenece (`▓ MOTOR`, `▒ PANEL` o `░ SITIO`).

> ⚠️ `js/components/layout.js` (header, drawer del carrito, footer) lo usan **todas** las páginas, **incluido el panel**. Si el diseño de un cliente necesita otro header, no se edita `layout.js`: se crea `js/components/layout-sitio.js` para las páginas públicas y el panel sigue con el original.

## 3. Reglas que nunca se rompen
1. **Un solo cliente de Supabase** (`js/supabase-client.js`). Versión **fija** de supabase-js (hoy 2.117.2; nunca `@2` ni `@latest`). Si cambia, cambiar también el `modulepreload` de los 4 HTML.
2. **Todo texto que viene de la base se escapa** con `esc()` antes de ir a `innerHTML`, o se usa `textContent`. Sin `onclick` inline ni `eval`.
3. **Auth:** siempre `onAuth()` de `js/lib/auth.js`. Dentro de su callback **nunca** hacer `await` de otra llamada a Supabase (puede colgar el cliente): ya se difiere con `setTimeout`.
4. **Los precios los calcula el servidor.** Los pedidos solo se crean con `crear_pedido()` (función `security definer`). El navegador manda ids y cantidades, nunca precios.
5. **El carrito guarda solo `{producto_id, modelo_id, qty}`** y se rehidrata desde la base. Tiene dueño (`cb_cart_v1_owner`): no se mezcla entre cuentas.
6. **RLS en todas las tablas**, con `grant` explícitos. Tabla nueva = RLS + políticas + grants + tests.
7. **Sin secretos en el repo.** Solo URL y clave *publishable*. La `service_role` no existe en este proyecto.
8. **Política de seguridad (CSP) estricta** (`_headers`): scripts solo de `'self'` y jsDelivr; estilos `'self'` + inline; fuentes e imágenes propias (+ Supabase para fotos). Todo lo externo está bloqueado por defecto.
9. **Accesibilidad mínima:** contraste AA, foco visible, modales con foco atrapado y `Esc`, botones de 44 px, `prefers-reduced-motion`, imágenes con `alt` y `width`/`height`.
10. **Rendimiento:** sin librerías pesadas, fuentes propias con `preload`, espacio reservado para lo que dibuja el JS (evita saltos de diseño), meta Lighthouse móvil ≥ 90.

## 4. Qué ofrece el motor (`js/lib/`)

### Datos públicos
- **`store.js`** — `getStore() → { config, categorias }` (caché 5 min por pestaña), `invalidarStore()`, `applyBranding({config, categorias})`. `applyBranding` completa el HTML con atributos `[data-config="clave"]` (texto), `whatsapp-link` / `instagram-link` / `email-link` (href), pone `document.title` (usa `<html data-page-title>`) y define las variables CSS `--cat-<slug>` con el color de cada categoría.
- **`api.js`** — `listProductos({forzar}) → productos[]` (todos los disponibles, caché 2 min), `getProductosPorIds(ids)` (datos frescos), `estaAgotado(p)`, `stockModelo(p, modeloId)`, `normalizar(texto)` (búsqueda sin tildes). Forma de un producto: `{ id, nombre, precio, descripcion, descripcion_larga, imagenes:[{thumb,full}], emoji, tiene_variantes, stock, destacado, orden, categoria:{id,nombre,slug,color,emoji}, modelos:[{id,nombre,stock,orden}] }`.
- **`image-url.js`** — `imgUrl(ruta)`: en la base se guardan **rutas**; esto arma la URL pública del bucket.
- **`format.js`** — `money(n)` (ARS sin centavos), `fecha(iso)`, `slugify(texto)`.

### Carrito y pedido
- **`cart.js`** — `agregar(productoId, modeloId, cantidad, maximo) → {ok, qty, tope}`, `cambiarQty(clave, qty)`, `quitar(clave)`, `vaciar()`, `items()`, `contar()`, `cantidadEn(...)`, `rehidratar() → { lineas, avisos, total }` (saca lo agotado/inexistente, recorta al stock y explica qué pasó), `lineKey(producto, modelo)`, `initCartSync()` (sincroniza con la cuenta; ya lo llama `layout.js`). Evento: **`cart:changed`** (en `document`) cada vez que cambia. `layout.js` dispara **`cart:open`** al abrir el drawer.
- **`pedido.js`** — `prepararCheckout() → { datos, config, usuario|null, direccion }`, `validarEntrega(entrega, direccion) → {campo: mensaje}`, `crearPedido({lineas, entrega, direccion, notas, usuario, direccionPrevia}) → {ok, pedido} | {ok:false, mensaje}` (nunca lanza; si sale bien vacía el carrito y guarda la dirección), `enlaceWhatsAppInvitado(config, datos)`, `enlaceWhatsAppPedido(config, pedido, ctx)`, `armarMensaje(...)`, `CAMPOS_DIRECCION`.
  La ventana de confirmación (HTML) es **`js/components/checkout-ui.js`** y sí se rediseña.

### Cuenta
- **`auth.js`** — `onAuth(cb)`, `getUser()`, `signUp`, `signIn`, `signOut`, `resetPassword`, `updatePassword`, `isAdmin(user)`, `mapAuthError(error)` (mensajes en español).

### Utilidades de interfaz reutilizables
- **`dom.js`** — `$`, `$$`, `esc`, `on(contenedor, evento, selector, handler)` (delegación), `toast(msg, tipo)`, `abrirModal(el, {onClose})` / `cerrarModal(el)` (foco atrapado, `Esc`, devuelve el foco). Son utilidades; si un diseño necesita otro modal, puede usar su propio componente.
- **`image-upload.js`** — `procesarImagen(file)`, `subirFoto(productoId, procesada)`, `borrarArchivos(rutas)`, `MAX_FOTOS`. Compresión a WebP (400 y 1200 px), respeta la orientación EXIF.
- **`xlsx.js`** — `descargarXLSX(nombre, {hoja, tabla, columnas, filas})`: Excel como tabla, sin librerías.

## 5. Datos y quién ve qué (RLS)
- `config`, `categorias` (activas), `productos` (disponibles), `modelos`: lectura pública.
- `clientes`, `carritos`, `pedidos`, `pedido_items`: cada cliente solo ve lo suyo; el admin ve todo.
- Admin (`admins`): único que escribe catálogo, config y estados de pedido. Se da de alta **a mano por SQL**, nunca desde el frontend.
- **Stock:** se descuenta cuando el admin pasa el pedido a *Confirmado* y se repone al *Cancelar* (trigger, una sola vez). Crear un pedido no toca el stock; sí lo valida.
- Imágenes: bucket público `productos` (WebP/JPEG, máx. 1 MB); solo el admin sube y borra.

## 6. Contrato de enganches (lo que el JavaScript espera encontrar)
La verificación (`tests/verificar-sitio.mjs`) comprueba estos elementos en cada página. Un rediseño puede cambiar su aspecto y posición, **no** su existencia ni su nombre:

- **Todas las páginas:** `.site-header`, `[data-config="nombre_tienda"]` en el header, `#cart-btn`, `#cart-count`, `#cart-drawer`, `#cart-body`, `#cart-foot`, `#account-link`, `#admin-link`, `#menu-btn`, `.site-footer`, `#contenido`, y los puntos de montaje `#app-header` / `#app-footer`.
- **Inicio:** `#categorias`, `#destacados`, `#contacto`, `[data-config="whatsapp-link"]`.
- **Catálogo:** `#buscar`, `#orden`, `#chips` (con botones `[data-cat]`), `#grilla` (tarjetas con `[data-abrir]` / `[data-agregar]`), `#modal-producto`.
- **Cuenta:** `#cuenta-root` (el JS dibuja formularios con `#form-ingresar`, `#form-registro`, `#form-olvide`, `#form-nueva`, `#form-datos`).
- **Panel:** `#admin-root`, `#admin-vista`, botones `#tab-<pestaña>`.
- **Clases de estado que el JS pone y el CSS debe contemplar:** `.is-open` (drawer/modal/menú), `.is-loading`, `.hidden` (con `!important`), `.has-error`, `body.no-scroll`.
- **Capas (z-index):** header 40 · cartel demo 45 · overlay 50 · drawer y modales 60 · avisos 80.

## 7. Cómo armar un sitio público a medida
1. **Partir de `docs/SETUP-NUEVO-CLIENTE.md`** (repo nuevo, Supabase, Auth, Cloudflare).
2. **Diseño:** colores, tipografías y espaciados en `css/theme.css`. Estilos propios del cliente en un archivo aparte: `css/cliente.css` (ya existe, vacío, con instrucciones; se enlaza **después** de los demás CSS en los HTML públicos y solo sobrescribe). Así las mejoras del motor se pueden traer sin pisar su marca.
3. **Estructura distinta:** se reescriben `index.html`, `catalogo.html`, `cuenta.html` y los archivos de `js/pages/` y `js/components/` (menos lo que usa el panel). Se mantienen los enganches del §6 o se adaptan a propósito.
4. **Usar el motor, no reimplementarlo.** Ejemplo mínimo de un catálogo propio:

```js
import { getStore, applyBranding } from '../lib/store.js';
import { listProductos, estaAgotado, stockModelo } from '../lib/api.js';
import { agregar } from '../lib/cart.js';
import { esc } from '../lib/dom.js';
import { money } from '../lib/format.js';

applyBranding(await getStore());
const productos = await listProductos();
$('#grilla').innerHTML = productos.map((p) => `
  <article>
    <h2>${esc(p.nombre)}</h2><p>${money(p.precio)}</p>
    <button data-agregar="${esc(p.id)}" ${estaAgotado(p) ? 'disabled' : ''}>Agregar</button>
  </article>`).join('');
// Al tocar "Agregar": agregar(p.id, null, 1, stockModelo(p, null)) y el motor se ocupa del tope, la persistencia y la cuenta.
```
5. **Animaciones y efectos:** CSS puro (`transform`/`opacity`) y siempre con `prefers-reduced-motion`. No usar `display:none` en lo que el JS abre/cierra. Cualquier librería de animación va **propia** (en `assets/` o `js/vendor/`), no desde un CDN.
6. **Recursos externos** (Google Fonts, videos, Instagram, analíticas, chat): están bloqueados por la CSP. Si un cliente los exige, se decide caso por caso: se agrega **solo** el dominio necesario a la directiva correcta de `_headers`, se anota en el repo del cliente por qué, y se vuelve a correr la verificación y Lighthouse.

## 8. Tres niveles de personalización (para cotizar)
1. **Marca:** `theme.css`, logo, favicon, imagen para compartir, tipografías, textos desde el panel. Autoservicio.
2. **Estilo propio:** `css/cliente.css` (fondos, formas, animaciones, componentes con otro aspecto) sin tocar HTML ni JS.
3. **Estructura:** HTML y JS del sitio público distintos. Es el trabajo normal de "diseño a medida" y exige pasar la verificación completa.

## 9. Cambios en la base de datos (campos o tablas extra)
1. Escribir el cambio como SQL **idempotente** (`if not exists`, `create or replace`) en `supabase/schema.sql` (o `supabase/migraciones/AAAA-MM-DD-descripcion.sql` si el cliente ya tiene datos).
2. Tabla nueva: `enable row level security` + políticas explícitas + `grant` explícitos.
3. Agregar tests en `supabase/tests/rls_tests.sql` y correrlos en el SQL Editor: tiene que dar **TODOS LOS TESTS OK**.
4. Si el campo se muestra en el sitio: sumarlo al `select` de `js/lib/api.js` y escaparlo al mostrarlo.

## 10. Verificar antes de entregar
1. `cd tests && npm install` (una vez) y **`node verificar-sitio.mjs --cliente`** → tiene que decir `TODO OK`. (Ver `tests/README.md`.) Si el sitio cambió la estructura, ajustar primero la lista de enganches en ese script.
2. `supabase/tests/rls_tests.sql` en el Supabase del cliente → 36/36.
3. **Lighthouse móvil** (https://pagespeed.web.dev/) sobre el catálogo: ≥ 90 en las cuatro categorías.
4. **Prueba real** en PC, Android e iPhone del flujo completo (registro, catálogo, carrito, pedido, WhatsApp, panel), con la lista de `docs/SETUP-NUEVO-CLIENTE.md` §10.
5. Confirmar `demo: false` en `js/site.config.js` y que no queden datos del demo (nombres, WhatsApp, dominio de ejemplo).

## 11. Trampas conocidas (ya nos mordieron)
- **`Array.map(fn)` le pasa el índice como 2.º argumento.** Llamar siempre `map((x) => fn(x))`. (Así apareció `<0 class="card-title">` en pantalla.)
- **Eventos acumulados:** si una pestaña o vista se dibuja en el mismo contenedor, los `addEventListener` de las anteriores siguen vivos. Cada vista nueva usa un contenedor nuevo (`cloneNode(false)` + `replaceWith`).
- **CSS compartido:** una regla definida en `catalogo.css` no existe en el panel. Lo que usan varias pantallas va en `base.css`.
- **Caché de 5 min** de categorías/config por pestaña: un cambio en el panel puede tardar en verse en otra pestaña.
- **Espacio reservado** (`#app-header`, `#chips`): lo que el JS inserta después del primer dibujado provoca saltos de diseño y baja Lighthouse.
- **Nada de `await` dentro del callback de `onAuth`.**
- **Mensajes del servidor:** solo se muestran tal cual los de `raise exception` (código `P0001`); cualquier otro error de la base se reemplaza por uno genérico.
- **iOS:** `window.open` después de un `await` se bloquea; por eso el pedido termina con un botón "Abrir WhatsApp".

## 12. Dejar el demo como nuevo
Después de mostrar el demo a varios clientes, o de probarlo mucho, se limpia con los scripts de `supabase/` (**solo en el proyecto del demo**, nunca en el de un cliente):
1. `diagnostico-demo.sql` — solo lectura: cuenta lo que hay y lista los usuarios.
2. `reiniciar-demo.sql` — borra pedidos, clientes de prueba (menos los administradores, a los que deja el perfil anónimo), carritos y catálogo; reinicia el contador de pedidos (`CN-00001`). Corre en una transacción y se frena solo si la tienda no se llama "Casa Nube…".
3. `seed.sql` — recarga la tienda "Casa Nube" (datos ficticios) y sus 12 productos de ejemplo.
4. A mano: Supabase → Storage → bucket `productos` → borrar las carpetas (las fotos de los productos borrados quedan huérfanas).
