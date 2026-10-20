# PLAN MAESTRO — CATALOGO-BASE
## Plantilla de catálogo web con Supabase (Postgres + Auth + Storage), 100% frontend

| | |
|---|---|
| **Proyecto** | `catalogo-base` (demo + plantilla vendible) |
| **Dueño** | Martin Romero Studio — https://www.martinromerostudio.com.ar |
| **Ejecuta el código** | Claude Code (sesión nueva, con el repo `catalogo-base` adjunto) |
| **Hosting** | Cloudflare Pages (gratis) |
| **Backend** | Supabase plan Free (Postgres + Auth + Storage). Sin servidor propio |
| **Frontend** | HTML + CSS + JavaScript vanilla con módulos ES. **Sin framework, sin bundler, sin build** |
| **Estado** | Planificado. Ninguna fase iniciada |

---

## 0. Cómo usar este documento

**Para Martin:** pegá o adjuntá este archivo en la conversación nueva con Claude Code, junto con el mensaje:

> *"Leé el PLAN MAESTRO completo y arrancá por la Fase 0. Preguntame solo si algo es ambiguo o si necesitás que yo haga algo."*

**Para Claude (leer completo antes de tocar nada):**

1. Este documento es la fuente de verdad. Si algo del código real contradice el plan, **frená y avisá** antes de improvisar.
2. Cada paso lleva una etiqueta de **quién lo hace**:
   - 👤 **MARTIN** — lo hace él a mano (crear cuentas, pegar SQL en Supabase, configurar paneles web). Claude **no puede** hacerlo: no tiene acceso a su Supabase ni a su Cloudflare. Claude debe darle las instrucciones claras, click por click, y esperar confirmación.
   - 🤖 **CLAUDE** — lo hace Claude en el repo (código, SQL, documentación, commits).
   - 🛑 **PARADA** — punto de verificación. Claude se detiene, resume qué hizo y qué tiene que probar Martin, y **espera el OK** antes de seguir a la fase siguiente.
3. **Continuidad entre conversaciones:** Claude crea y mantiene `docs/PROGRESO.md` (ver §4.3). Al empezar una conversación nueva, lo primero es leerlo para saber en qué fase se está.
4. Martin tiene conocimientos **básicos de HTML y CSS**: las explicaciones para él van en lenguaje simple, sin jerga; cuando use un término técnico, lo explica en una línea. El código debe quedar **legible y comentado en español**, porque Martin lo va a mantener y a vender.
5. Idioma de la interfaz y del código-comentarios: **español rioplatense (es-AR)**. Nombres de tablas/columnas en español snake_case; nombres de variables/funciones JS en camelCase, en español o inglés pero consistentes con lo que ya existe en este documento.

---

## 1. Qué estamos construyendo y por qué

Martin quiere un **producto propio y vendible**: un catálogo web simple, con cuentas de cliente, carrito, pedidos por WhatsApp, panel de administración y reportes, apoyado en una base de datos **relacional** (Postgres).

Se construye primero un **demo** con una tienda ficticia ("Casa Nube") para:
- aprender Supabase sin riesgo y resolver todos los problemas técnicos una sola vez,
- tener algo concreto para mostrarle a clientes potenciales,
- que el día de mañana sea una **plantilla**: clonar el repo, cambiar 3 archivos de configuración y tener un catálogo nuevo.

### Objetivos
1. Catálogo con categorías, productos simples y con **modelos/variantes** (cada modelo con su stock).
2. Carrito persistente (en el navegador; y en la cuenta si el cliente está logueado).
3. Cuentas de cliente: registro, login, recuperar contraseña, perfil, historial de pedidos.
4. Pedido guardado en la base **y** enviado por WhatsApp, con **precios calculados por el servidor** (el cliente no puede inflarlos ni abaratarlos).
5. Panel de administración: productos, stock, pedidos, clientes, categorías, configuración de la tienda y un resumen de ventas.
6. **Botón "Subir foto"** que comprime en el navegador a WebP (miniatura + grande) y sube a Supabase Storage.
7. **Nada específico del cliente en el código**: nombre, WhatsApp, categorías, textos y colores salen de la base o de `site.config.js` / `theme.css`.
8. Seguridad real con **Row Level Security (RLS)**, con tests automatizados que se corren en el SQL Editor.

### No-objetivos (fuera de este plan)
- Pagos online (Mercado Pago). Más adelante, con Supabase Edge Functions.
- Importar datos desde otros sistemas.
- Multi-tienda en un solo sistema (cada cliente = su propio repo + su propio proyecto Supabase).
- Frameworks (React, Vue…), bundlers, TypeScript, Node en producción.
- Keepalive, backups automáticos y SMTP propio: se dejan para cuando haya un **cliente real** (ver §17), salvo lo mínimo para el demo.

---

## 2. Decisiones ya tomadas (no re-discutir)

| Tema | Decisión | Motivo |
|---|---|---|
| Un repo por cliente | Sí, `catalogo-base` se marca como *Template repository* en GitHub | Simple de operar y de vender |
| Un proyecto Supabase por cliente | Sí | Aislamiento total de datos |
| Imágenes | Comprimidas **en el navegador**; se guardan 2 versiones (`thumb` 400 px, `full` 1200 px) y **no** el original | No requiere plan pago |
| Carrito | Se guarda `{producto_id, modelo_id, qty}`, **nunca** precios ni URLs de imagen; se rehidrata desde la base | Evita precios viejos y datos huérfanos |
| Pedidos | Solo se crean mediante la función `crear_pedido()` (`security definer`). Los clientes **no tienen permiso de INSERT** sobre `pedidos` ni `pedido_items` | Seguridad de precios |
| Stock | Se **descuenta al confirmar** el pedido (admin) y se **repone al cancelar**. Un trigger lo hace una sola vez | El flujo real es "pedido → WhatsApp → admin confirma" |
| Perfil de cliente | Lo crea un **trigger** al registrarse (no el frontend) | Funciona aunque se active la confirmación por email |
| Admin | Tabla `admins`; se da de alta a mano con SQL. Nunca desde el frontend | Más seguro |
| Reportes | Dos vistas SQL (`v_ventas_mensuales`, `v_mas_vendidos`) + pestaña "Resumen" | Es el motivo original de usar base relacional |
| Idioma / moneda | es-AR / pesos argentinos, enteros (sin centavos) | Alcance del mercado objetivo |
| Catálogo | Se carga **completo una vez** y se filtra/ordena/busca en el navegador | Simple y rápido hasta ~500 productos |

---

## 3. Reglas técnicas obligatorias (Claude)

1. **Sin build.** Todo corre abriendo archivos estáticos con un servidor local (los módulos ES no funcionan con `file://`). Para probar en local: `python3 -m http.server 8080`.
2. **Cliente Supabase por CDN, versión exacta:** `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@X.Y.Z/+esm`. **Prohibido** `@2` o `@latest` (flotante). Antes de fijarla: `npm view @supabase/supabase-js version` y elegir una versión estable publicada hace **más de 2 semanas**.
3. **Secretos.** En el frontend solo viven `supabaseUrl` y la clave **anon/publishable** (pública por diseño). La clave `service_role` **no se usa en este proyecto** y **no debe aparecer jamás** en el repo, en el chat ni en el código. Si Martin la pega por error, Claude le avisa que la regenere.
4. **RLS en todas las tablas**, sin excepción. Toda tabla nueva: `enable row level security` + políticas explícitas + `grant` explícito.
5. **Regla anti-deadlock de Auth:** dentro del callback de `onAuthStateChange` **nunca** se hace `await` de otra llamada a Supabase (puede colgar el cliente). Siempre se difiere con `setTimeout(() => ..., 0)`. Toda la app usa el wrapper `onAuth()` de `js/lib/auth.js`, que ya lo hace.
6. **Escapar todo texto que venga de la base** antes de ponerlo en `innerHTML` (función `esc()`), o usar `textContent`. Cero `onclick="..."` inline: se usa delegación de eventos (`addEventListener`). Esto también permite una política CSP estricta (§16).
7. **Un solo cliente Supabase** (`js/supabase-client.js`) importado por todos los módulos. No crear clientes en otros lados.
8. **Imágenes:** siempre con `width`/`height` o `aspect-ratio`, `loading="lazy"` y `decoding="async"` (salvo la primera pantalla). Siempre con texto `alt`.
9. **Accesibilidad mínima:** contraste AA, foco visible, modales con `role="dialog"`, `aria-modal`, foco atrapado y cierre con `Esc`, botones de 44 px mínimo en táctil, `prefers-reduced-motion` respetado, `aria-live` en el contador del carrito y en los toasts.
10. **Una fase = uno o varios commits claros + una PARADA.** Ramas y PRs: seguir las instrucciones de la sesión (rama asignada, PR en borrador). Mensajes de commit en español, formato `fase N: qué se hizo`.
11. **No inventar datos reales.** Todo el contenido del demo es ficticio (tienda "Casa Nube", WhatsApp de ejemplo, emails `.example`).
12. **Probar antes de afirmar.** Si Claude no puede probar algo (por ejemplo, no hay red hacia Supabase desde su entorno), lo dice explícitamente y lo agrega al checklist manual de Martin. No declarar "funciona" sin evidencia.

---

## 4. Estructura del repo y seguimiento

### 4.1 Árbol de carpetas objetivo

```
catalogo-base/
├── index.html                 Home
├── catalogo.html              Catálogo con filtros
├── cuenta.html                Login / registro / perfil / historial / recuperar contraseña
├── admin/
│   └── index.html             Login admin + panel con pestañas
├── css/
│   ├── theme.css              ← ÚNICO archivo de colores/tipografías por cliente (variables)
│   ├── base.css               Reset, tipografía, botones, formularios, utilidades
│   ├── layout.css             Header, footer, drawer del carrito, modales, toasts
│   ├── home.css
│   ├── catalogo.css
│   ├── cuenta.css
│   └── admin.css
├── js/
│   ├── site.config.js         ← ÚNICO archivo JS que se edita por cliente
│   ├── supabase-client.js     createClient (único)
│   ├── lib/
│   │   ├── dom.js             $, $$, esc(), toast(), abrirModal()/cerrarModal() con foco atrapado
│   │   ├── format.js          money(), fecha(), slugify()
│   │   ├── store.js           config + categorías (caché sessionStorage), applyBranding()
│   │   ├── auth.js            onAuth(), signUp/signIn/signOut, reset/update password, isAdmin(), mapAuthError()
│   │   ├── api.js             consultas de catálogo y de cuenta (lado público)
│   │   ├── cart.js            estado del carrito, merge, rehidratación, sincronización con la cuenta
│   │   ├── checkout.js        modal de confirmación, RPC crear_pedido, mensaje de WhatsApp
│   │   ├── image-upload.js    compresión a WebP/JPEG + subida/borrado en Storage
│   │   └── image-url.js       imgUrl(path) → URL pública del bucket
│   ├── components/
│   │   └── layout.js          Inyecta header, drawer del carrito y footer en todas las páginas
│   └── pages/
│       ├── home.js
│       ├── catalogo.js
│       ├── cuenta.js
│       └── admin/
│           ├── admin.js       Arranque, guardia de admin, router de pestañas
│           ├── productos.js
│           ├── stock.js
│           ├── pedidos.js
│           ├── clientes.js
│           ├── categorias.js
│           ├── config.js
│           └── resumen.js
├── assets/                    Favicon, og-image y logo de ejemplo (reemplazables)
├── supabase/
│   ├── schema.sql             ← Apéndice A (tablas, RLS, funciones, triggers, vistas, bucket)
│   ├── seed.sql               ← Apéndice C (datos de demo)
│   └── tests/rls_tests.sql    ← Apéndice B (36 tests de seguridad)
├── docs/
│   ├── PLAN.md                Este documento
│   ├── PROGRESO.md            Estado de fases (lo mantiene Claude)
│   ├── MANUAL-ADMIN.md        Guía para la dueña del negocio
│   └── SETUP-NUEVO-CLIENTE.md Checklist para Martin al clonar para un cliente
├── _headers                   Cabeceras de seguridad para Cloudflare Pages
├── robots.txt
├── sitemap.xml
└── README.md
```

### 4.2 Qué se edita por cada cliente nuevo (la "plantilla")

| Qué | Dónde | Quién |
|---|---|---|
| URL y clave pública de Supabase, dominio | `js/site.config.js` | Martin |
| Colores y tipografías | `css/theme.css` | Martin |
| Nombre, textos del hero, "sobre nosotros", WhatsApp, Instagram, email, texto de envíos, prefijo de pedidos | Panel → **Configuración** (tabla `config`) | La dueña (o Martin) |
| Categorías (nombre, color, emoji, orden) | Panel → **Categorías** | La dueña |
| Logo, favicon, imagen para compartir | `assets/` (reemplazar archivos) | Martin |
| Metadatos SEO estáticos, JSON-LD | HTML, marcados con `<!-- CLIENTE: ... -->` | Martin |

### 4.3 `docs/PROGRESO.md`

🤖 CLAUDE lo crea en la Fase 0 con esta forma y lo actualiza al cerrar cada fase:

```markdown
# Progreso — catalogo-base
| Fase | Estado | Fecha | Notas / decisiones |
|---|---|---|---|
| 0 Preparación | ⬜ pendiente | | |
| 1 Base de datos | ⬜ | | |
...
## Datos de entorno (sin secretos)
- Repo: …  · Proyecto Supabase (ref): …  · URL de Cloudflare Pages: …
## Pendientes / bugs conocidos
```
Estados: ⬜ pendiente · 🟨 en curso · ✅ hecha y verificada por Martin.

---

## 5. FASE 0 — Preparación (cuentas y repo)

> Objetivo: tener GitHub, Supabase y la sesión de Claude listos. **Todo esto lo hace Martin.** Claude solo guía y verifica.

### 👤 0.1 Crear el repositorio en GitHub
1. Entrá a https://github.com/new
2. **Repository name:** `catalogo-base`
3. **Visibility:** *Private* (por ahora; es tu producto).
4. Marcá **Add a README file** (necesario para que exista la rama `main`).
5. No agregues `.gitignore` ni licencia. Clic en **Create repository**.
6. Subí este plan al repo: en la página del repo → **Add file → Create new file** → en el nombre escribí `docs/PLAN.md` (al escribir `/` crea la carpeta) → pegá todo el contenido de este documento → **Commit changes**.

### 👤 0.2 Crear el proyecto en Supabase
1. Entrá a https://supabase.com → **Sign in with GitHub**.
2. Si te pide crear una organización: nombre `Martin Romero Studio`, tipo *Personal*, plan **Free**.
3. **New project**:
   - *Name:* `catalogo-base-demo`
   - *Database password:* clic en **Generate a password**, **copiala y guardala en tu gestor de contraseñas**. **No se la pases a Claude** (no hace falta).
   - *Region:* **South America (São Paulo)** (la más cercana a Argentina).
   - *Plan:* Free.
4. Esperá 1–2 minutos a que diga que el proyecto está listo.
5. Andá a **Project Settings (engranaje) → API** y copiá estas dos cosas (no son secretas, van en el sitio público):
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **Publishable key** (empieza con `sb_publishable_…`) **o** la **anon key** si tu panel todavía la muestra con ese nombre. Cualquiera de las dos sirve.
   - ⚠️ **No copies la `service_role` / `secret key`.** Esa no se usa nunca en este proyecto.
6. Pasale a Claude esos dos datos cuando te los pida (Fase 3).

### 👤 0.3 Iniciar la sesión de Claude Code
1. En https://claude.ai/code iniciá una **sesión nueva** con el repo `catalogo-base` adjunto.
2. Pegá este documento y el mensaje de la §0.
3. **Red del entorno:** si Claude avisa que no puede conectarse a Supabase o a la CDN, abrí la configuración del entorno de la sesión (Claude te va a decir exactamente dónde con su herramienta de documentación) y agregá a la lista de dominios permitidos: `*.supabase.co`, `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com`.

### 🤖 0.4 Tareas de Claude en la Fase 0
1. Leer este plan completo.
2. Verificar el entorno (`node -v`, `python3 -V`, `npm view @supabase/supabase-js version`, ¿hay red hacia `*.supabase.co`?) y reportarlo.
3. Crear `docs/PROGRESO.md`, `.gitignore` (`.env*`, `node_modules/`, `.DS_Store`, `*.log`) y la estructura de carpetas vacía del §4.1 (con `.gitkeep` donde haga falta).
4. Commit: `fase 0: estructura base y seguimiento`.

### 🛑 PARADA 0 — Martin confirma
- [ ] El repo existe y tiene `docs/PLAN.md`.
- [ ] El proyecto Supabase está activo (punto verde) y guardó URL + clave pública.
- [ ] Claude reportó el estado del entorno (red, versiones).

---

## 6. FASE 1 — Base de datos, seguridad y datos de demo

> Objetivo: la base completa en Supabase, con seguridad probada por tests. **Es la fase más importante: si está bien, el resto es UI.**

### 🤖 1.1 Claude crea los archivos SQL
Crea, **copiando textualmente** de los apéndices (ya fueron validados en PostgreSQL 16 simulando los roles `anon`/`authenticated` y los esquemas `auth`/`storage` de Supabase: 36/36 tests OK, y se comprobó que los tests detectan una seguridad rota. Es una simulación: la prueba definitiva es correrlos en el Supabase real, Parada 1):
- `supabase/schema.sql` ← **Apéndice A**
- `supabase/seed.sql` ← **Apéndice C**
- `supabase/tests/rls_tests.sql` ← **Apéndice B**

Claude **no debe "mejorar" ni reordenar** el SQL sin avisar. Si encuentra un problema, lo reporta con el motivo y propone el cambio.

Resumen de lo que implementa el esquema (para que Claude y Martin lo entiendan):
- **Tablas:** `config` (1 fila), `categorias`, `productos`, `modelos` (variantes con stock), `admins`, `clientes`, `carritos`, `pedidos`, `pedido_items`.
- **`es_admin()`**: función que dice si el usuario logueado está en `admins`.
- **Trigger `handle_new_user`**: al crearse un usuario en Auth, crea su fila en `clientes` con nombre y teléfono (vienen en los metadatos del registro).
- **`crear_pedido(items, entrega, direccion, notas)`**: única forma de crear pedidos. Lee precios y stock de la base, valida, crea pedido + ítems en una transacción y devuelve `{id, codigo, total, items[]}`. Código legible: `PREFIJO-00042`.
- **Trigger de stock**: al pasar un pedido a *confirmado/enviado/entregado* descuenta stock (una sola vez); al *cancelar* lo repone.
- **RLS**: lectura pública de catálogo/config; cada cliente solo ve lo suyo; solo el admin escribe catálogo y cambia estados; nadie inserta pedidos directamente.
- **Vistas de reportes**: `v_ventas_mensuales`, `v_mas_vendidos` (`security_invoker`, respetan RLS).
- **Storage**: bucket público `productos` (máx. 1 MB por archivo; solo `image/webp` e `image/jpeg`); solo el admin sube/borra.
- **Privilegios explícitos** (`grant`/`revoke`) para no depender de los valores por defecto de Supabase.

Commit: `fase 1: schema, seed y tests de RLS`.

### 👤 1.2 Martin ejecuta el SQL en Supabase
En tu proyecto de Supabase, menú izquierdo → **SQL Editor**:

1. **New query** → pegá **todo** `supabase/schema.sql` → botón **Run** (o Ctrl/Cmd+Enter).
   - Si Supabase muestra una advertencia de *"destructive operation"* (por los `drop policy` y `revoke`), confirmá con **Run this query**: es esperado y seguro, la base está vacía.
   - Resultado esperado: *"Success. No rows returned"*.
2. **New query** → pegá `supabase/seed.sql` → **Run**. Carga la tienda ficticia "Casa Nube": 4 categorías, 12 productos (algunos con modelos y stock).
3. **New query** → pegá `supabase/tests/rls_tests.sql` → **Run**.
   - ✅ **Resultado correcto:** aparece un recuadro **rojo de error** que dice  
     `RESULTADO: TODOS LOS TESTS OK (36/36). Se revirtió todo, no quedó nada guardado.`  
     *(Sí, es un error a propósito: así el script se deshace solo y no deja datos de prueba.)*
   - ❌ Si dice `RESULTADO: FALLARON N de 36 tests: ...`, **copiale ese mensaje completo a Claude**.
   - ❌ Si da otro error (por ejemplo, de una columna obligatoria en `auth.users`), copiáselo a Claude: puede ser que Supabase haya cambiado esa tabla y haya que ajustar el insert de prueba.
4. Verificá a ojo:
   - **Table Editor**: ves las 9 tablas y cada una dice *RLS enabled*.
   - **Storage**: existe el bucket `productos` marcado como *Public*.

### 👤 1.3 Martin configura Authentication
1. **Authentication → Providers → Email**: dejá *Enable Email provider* activado. **Desactivá** *Confirm email* (para el demo; así el registro entra directo). Guardá.
2. **Authentication → Sign In / Providers (o Policies)**: poné *Minimum password length* en **8**.
3. **Authentication → URL Configuration**: 
   - *Site URL*: por ahora `http://localhost:8080` (después la cambiás por la URL de Cloudflare, Fase 11).
   - *Redirect URLs*: agregá `http://localhost:8080/**` (más adelante se suman las de Cloudflare).
4. **Crear tu usuario administrador:** **Authentication → Users → Add user → Create new user** → tu email y una contraseña fuerte → marcá **Auto Confirm User** → *Create user*.
5. Volvé al **SQL Editor** y ejecutá (cambiando el email por el tuyo):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'TU-EMAIL@EJEMPLO.COM';
   ```
   Debe decir *"Success. 1 row affected"*. (Si dice 0 filas, el email no coincide.)

### 🛑 PARADA 1 — Martin confirma
- [ ] `schema.sql` y `seed.sql` corrieron sin errores.
- [ ] El test de RLS dijo **TODOS LOS TESTS OK (36/36)**.
- [ ] Tablas con RLS activo, bucket `productos` público.
- [ ] Usuario admin creado y registrado en `admins`.

---

## 7. FASE 2 — Diseño visual y sistema de estilos

> Objetivo: definir la identidad visual del demo y construir los estilos base **antes** de programar la lógica. Todo el aspecto del sitio vive en variables CSS para poder cambiar de cliente sin tocar el resto.

### 7.1 Dirección de diseño del demo ("Casa Nube")
Estética **cálida, limpia y editorial**: fondos crema, mucho aire, tipografía con carácter para los títulos y una sans legible para el texto. Mobile-first (la mayoría del tráfico de un comercio chico es celular). Debe verse **profesional y neutral**: es una plantilla para rubros distintos (indumentaria, decoración, regalos, gastronomía, etc.). No existe un sitio previo del cual partir: Claude diseña **desde cero** a partir de esta especificación, y la Parada 2 sirve justamente para que Martin ajuste el rumbo antes de programar la lógica.

### 🤖 2.1 `css/theme.css` — tokens (lo único que cambia por cliente)
Valores iniciales del demo (Claude puede afinar con criterio, manteniendo contraste AA):

```css
:root {
  /* Color */
  --color-bg:        #FBF8F4;   /* fondo general (crema) */
  --color-surface:   #FFFFFF;   /* tarjetas, modales */
  --color-ink:       #2B2623;   /* texto principal */
  --color-muted:     #7A716A;   /* texto secundario */
  --color-line:      #E8E1D9;   /* bordes y divisores */
  --color-primary:   #B8553B;   /* botón principal (terracota) */
  --color-primary-ink:#FFFFFF;  /* texto sobre primary */
  --color-primary-hover:#9C452F;
  --color-accent:    #3F6B5E;   /* detalles, "disponible", éxito (verde salvia) */
  --color-danger:    #B3261E;
  --color-whatsapp:  #1FA855;   /* botón de WhatsApp */
  --color-overlay:   rgba(43,38,35,.5);

  /* Tipografía (cargadas desde Google Fonts en el <head> de cada HTML) */
  --font-display: 'Fraunces', Georgia, serif;
  --font-body:    'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;

  /* Escala */
  --radius-sm: 8px; --radius: 14px; --radius-lg: 22px;
  --shadow-sm: 0 1px 2px rgba(43,38,35,.06);
  --shadow:    0 6px 24px rgba(43,38,35,.10);
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:24px; --space-6:32px; --space-7:48px; --space-8:72px;
  --container: 1120px;
}
```
Regla: **ningún color, fuente ni sombra hardcodeado fuera de `theme.css`** (excepto los colores de categoría, que vienen de la base).

### 🤖 2.2 Estilos base y componentes
- `base.css`: reset moderno, tipografía fluida (`clamp()`), enlaces, botones (`.btn`, `.btn-primary`, `.btn-ghost`, `.btn-whatsapp`, `.btn-danger`, tamaños), formularios (inputs, select, textarea, checkbox/radio, mensajes de error), tablas responsivas, badges, chips, skeleton loaders, utilidades (`.sr-only`, `.container`, `.stack`).
- `layout.css`: header sticky con menú hamburguesa móvil, drawer del carrito (derecha), modal genérico, toasts, footer.
- Páginas: `home.css`, `catalogo.css`, `cuenta.css`, `admin.css`.
- **Breakpoints:** 480 / 768 / 1100 px. Mobile-first (`min-width`).
- Foco visible (`:focus-visible`), `prefers-reduced-motion`, modo claro únicamente (no se pide modo oscuro).

### 7.2 Wireframes de referencia

**Header (todas las páginas, inyectado por `layout.js`):** nombre de la tienda en texto (tipografía display) a la izquierda · links *Inicio, Catálogo, Contacto* · a la derecha ícono de cuenta ("Ingresar" o "Mi cuenta") y carrito con contador · hamburguesa en móvil. Admin logueado ve además "Panel".

**Home:**
```
[Header]
[Hero]            título grande (config.hero_titulo) · texto · botón "Ver catálogo" · botón WhatsApp
[Categorías]      tarjetas con color y emoji de cada categoría activa → catalogo.html?cat=<slug>
[Destacados]      grilla de hasta 8 productos con destacado = true
[Sobre nosotros]  config.sobre_titulo + config.sobre_texto
[Envíos y contacto]  config.envio_texto · WhatsApp · Instagram · email · (formulario Formspree solo si SITE.formspreeId no está vacío)
[Footer]          nombre · año dinámico · links · "Sitio por Martin Romero Studio"
```

**Catálogo:**
```
[Header]
[Barra]   buscador · orden (Destacados / Precio ↑ / Precio ↓ / Nombre) 
[Chips]   Todas · una por categoría (scroll horizontal en móvil)
[Grilla]  2 col móvil · 3 tablet · 4 desktop · skeleton mientras carga · estado vacío amable
[Tarjeta] imagen cuadrada (thumb) · nombre · precio · badge "+ modelos" / "Sin stock" · botón Agregar / Ver modelos
[Modal de producto] carrusel (full) con flechas, puntos y swipe · descripción larga · chips de modelo (los agotados deshabilitados, con etiqueta "Sin stock") · botón Agregar
[Drawer del carrito] ítems con miniatura, +/−, total, botón "Confirmar pedido"
```

**Cuenta:** pestañas *Ingresar / Registrarme* · enlace "Olvidé mi contraseña" · una vez logueado: *Mis datos* (nombre, teléfono, dirección), *Mis pedidos* (lista expandible con ítems, estado con color, código) y botón *Cerrar sesión*. Si llegó desde el enlace de recuperación: formulario "Elegí tu nueva contraseña".

**Admin:** login → panel con pestañas *Resumen · Productos · Stock · Pedidos · Clientes · Categorías · Configuración*. Escritorio: barra lateral. Móvil: pestañas horizontales con scroll o menú hamburguesa (**probar en iPhone**: Safari de iOS tiene particularidades con alturas de pantalla y barras flotantes).

### 🤖 2.3 Entregable de la fase
Una página temporal `docs/styleguide.html` (se borra al final de la Fase 10 o se deja como documentación) que muestra todos los componentes con los tokens: botones, formularios, tarjeta de producto, chips, badges de estado, modal, drawer, toast, tabla. Sirve para que Martin apruebe el look **antes** de invertir en lógica.

Commit: `fase 2: sistema de diseño y styleguide`.

### 🛑 PARADA 2 — Martin aprueba el diseño
- [ ] Abrió el styleguide (en local, o en el preview de Cloudflare si ya hizo el paso 3.6) y le gusta la dirección. Si no: pide cambios de colores/tipografías ahora, que es barato.

---

## 8. FASE 3 — Esqueleto, configuración y capa de datos

### 🤖 3.1 Configuración y cliente
`js/site.config.js`:
```js
// ===== SE EDITA UNA VEZ POR CLIENTE =====
export const SITE = {
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',  // CLIENTE
  supabaseAnonKey: 'TU-CLAVE-PUBLICA',             // CLIENTE (anon / publishable; NUNCA la service_role)
  formspreeId: '',                                  // opcional; vacío = no se muestra el formulario
  locale: 'es-AR',
  moneda: 'ARS',
  carritoKey: 'cb_cart_v1',                         // localStorage; cambiar versión si cambia el formato
};
```
`js/supabase-client.js`: `createClient(SITE.supabaseUrl, SITE.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })` con la versión **exacta** fijada (regla §3.2). Exporta `supabase`.

### 🤖 3.2 Librerías (`js/lib/`)
- `dom.js` — `$`, `$$`, `esc(str)`, `toast(msg, tipo)`, `abrirModal(el)`/`cerrarModal(el)` (foco atrapado, `Esc`, devuelve el foco), `on(el, evento, selector, handler)` para delegación.
- `format.js` — `money(n)` (`Intl.NumberFormat('es-AR', {style:'currency', currency:'ARS', maximumFractionDigits:0})`), `fecha(iso)`, `slugify()`.
- `image-url.js` — `imgUrl(path)` → `supabase.storage.from('productos').getPublicUrl(path).data.publicUrl` (con memo).
- `store.js` — `getStore()` devuelve `{config, categorias}`: lee `config` (fila 1) y `categorias` activas ordenadas; **caché en `sessionStorage` 5 minutos** para evitar parpadeo y requests repetidos. `applyBranding(config)`: completa `document.title`, elementos `[data-config="nombre_tienda"]`, `[data-config="whatsapp-link"]` (arma `https://wa.me/<whatsapp>`), `[data-config="instagram-link"]`, etc. y define variables CSS `--cat-<slug>` con el color de cada categoría.
- `auth.js` — según la regla §3.5:
  ```js
  export function onAuth(cb){            // cb(event, session) siempre diferido
    supabase.auth.onAuthStateChange((event, session) => setTimeout(() => cb(event, session), 0));
  }
  ```
  más `getUser()`, `signUp({nombre,email,telefono,password})` (pasa `options.data = {nombre, telefono}` y `emailRedirectTo: location.origin + '/cuenta.html'`), `signIn`, `signOut`, `resetPassword(email)` (`redirectTo: location.origin + '/cuenta.html'`), `updatePassword(pw)`, `isAdmin()` (consulta `admins` por el propio usuario; devuelve boolean) y `mapAuthError(error)` que traduce por `error.code` (`invalid_credentials`, `user_already_exists`, `weak_password`, `over_request_rate_limit`, `email_not_confirmed`, `same_password`…) con mensaje en español y un genérico por defecto.
- `api.js` — `listProductos()` carga **todos** los disponibles en una consulta:
  ```js
  supabase.from('productos')
    .select('id,nombre,precio,descripcion,descripcion_larga,imagenes,emoji,tiene_variantes,stock,destacado,orden,categoria:categorias(id,nombre,slug,color,emoji),modelos(id,nombre,stock,orden)')
    .eq('disponible', true).order('orden')
  ```
  con caché en memoria (2 min). Filtrado por categoría, búsqueda (sin tildes, case-insensitive) y orden se hacen en el navegador. `getProductosPorIds(ids)` para rehidratar el carrito (sin caché, siempre fresco). Helpers `estaAgotado(p)`, `stockModelo(p, modeloId)`.

### 🤖 3.3 Layout compartido
`js/components/layout.js` inyecta en cada página: header (con contador del carrito y estado de sesión), drawer del carrito (contenedor; la lógica en `cart.js`), footer, contenedor de toasts. Así las 4 páginas no repiten HTML. Cada HTML tiene `<div id="app-header"></div>`, `<main>…</main>`, `<div id="app-footer"></div>`.

### 🤖 3.4 HTML de las páginas (estructura, sin lógica)
`index.html`, `catalogo.html`, `cuenta.html`, `admin/index.html` con: `<html lang="es-AR">`, metas SEO/Open Graph con comentarios `<!-- CLIENTE: ... -->`, JSON-LD de tipo `Store` mínimo, enlaces a `theme.css` y demás, fuentes de Google, `<script type="module" src="js/pages/xxx.js">`. Sin `onclick` inline.

### 🤖 3.5 `README.md`, `.gitignore`, `_headers` (ver §16), `robots.txt`, `sitemap.xml` con dominio de ejemplo.

Commit: `fase 3: esqueleto, config y capa de datos`.

### 👤 3.6 Martin conecta Cloudflare Pages (primer deploy)
1. Entrá a https://dash.cloudflare.com (creá cuenta gratis si no tenés).
2. Menú **Workers & Pages → Create → Pages → Connect to Git**.
3. Autorizá GitHub y elegí **solo** el repo `catalogo-base`.
4. Configuración:
   - *Project name:* `catalogo-base` (la URL será `https://catalogo-base.pages.dev`; si está tomada, Cloudflare agrega sufijo: anotá la real).
   - *Production branch:* `main`.
   - *Framework preset:* **None**.
   - *Build command:* (vacío).
   - *Build output directory:* `/` (si Cloudflare lo rechaza, probá `.`).
5. **Save and Deploy**. Cada vez que Claude suba una rama/PR, Cloudflare crea una **URL de preview** (la ves en el PR de GitHub o en el panel de Pages → Deployments). Ahí vas a probar.
6. Pasale a Claude la URL de producción de Pages para anotarla en `PROGRESO.md`.
7. En Supabase → **Authentication → URL Configuration**: agregá a *Redirect URLs*:
   - `https://catalogo-base.pages.dev/**`
   - `https://*.catalogo-base.pages.dev/**` (cubre las previews)

   Y poné como *Site URL* la de producción.

### 👤 3.7 Martin pasa a Claude URL y clave pública
Claude las escribe en `js/site.config.js` (son públicas) y hace commit.

### 🛑 PARADA 3
- [ ] El sitio carga en la URL de Cloudflare (aunque todavía casi vacío), sin errores rojos en la consola del navegador (F12 → Console).
- [ ] La consola no muestra errores de CORS ni 401 al leer `config`/`categorias`.

---

## 9. FASE 4 — Autenticación

### 🤖 Qué construye Claude (`js/pages/cuenta.js` + header)
1. **Registro:** nombre, email, teléfono, contraseña (mín. 8). Llama `signUp`. Si vuelve sesión → entra directo; si no (confirmación activada) → mensaje "Revisá tu email".
2. **Login** y **logout**.
3. **Recuperar contraseña:** enlace "Olvidé mi contraseña" → `resetPassword(email)` con mensaje neutro ("Si el email existe, te enviamos un enlace") para no revelar qué emails están registrados.
4. **Pantalla de nueva contraseña:** al volver desde el email llega el evento `PASSWORD_RECOVERY`; `cuenta.js` muestra el formulario "Elegí tu nueva contraseña" → `updatePassword()` → mensaje de éxito y redirección a "Mi cuenta". *(Supabase no aloja esta pantalla por nosotros: hay que construirla.)*
5. **Header:** "Ingresar" / "Mi cuenta"; si `isAdmin()` agrega "Panel". Se actualiza con `onAuth`.
6. Mensajes de error en español vía `mapAuthError`. Botones con estado "cargando" y anti doble envío.
7. Opcional: actualizar `clientes.ultimo_acceso` al `SIGNED_IN` (diferido).

### 🛑 PARADA 4 — Martin prueba (en el preview de Cloudflare)
- [ ] Registrarse con un email real propio (ej. `tuemail+prueba1@gmail.com`) → entra directo.
- [ ] Cerrar sesión y volver a entrar.
- [ ] "Olvidé mi contraseña" → llega el email (el servicio de email por defecto de Supabase **solo envía a emails de tu equipo y con límite bajo**: probá con tu propio email) → el link abre `cuenta.html` con el formulario de nueva contraseña → funciona.
- [ ] Contraseña incorrecta → mensaje en español.
- [ ] En Supabase → *Table Editor → clientes*: aparece la fila del usuario nuevo con nombre y teléfono (prueba del trigger).
- [ ] Iniciar sesión con tu usuario admin: el header muestra "Panel".

---

## 10. FASE 5 — Home y catálogo

### 🤖 Qué construye Claude
- `home.js`: aplica branding, pinta categorías (tarjetas con `color` y `emoji` de la base), destacados (máx. 8), secciones de texto desde `config`, enlaces de contacto, formulario Formspree solo si hay `formspreeId`. Estados de carga y error.
- `catalogo.js`:
  - Carga todos los productos (Fase 3, `api.js`), filtros por chips de categoría (`?cat=slug` sincronizado con la URL, botón "atrás" funciona), búsqueda, orden.
  - Tarjetas: imagen `thumb` (o emoji como respaldo si no hay foto), badge "Sin stock" cuando corresponde (sin variantes: `stock<=0`; con variantes: todos los modelos en 0), badge "+ modelos".
  - Modal de producto (`?p=<id>` abre el modal directo, para compartir links): carrusel con imágenes `full`, flechas/puntos/**swipe táctil**, chips de modelo (deshabilitados si stock 0, con etiqueta), cantidad disponible baja ("¡Quedan 2!" si ≤3), botón agregar.
  - Estado vacío ("No encontramos productos…") y de error con botón "Reintentar".
  - Cuando una imagen falla (`onerror` por listener, no inline), mostrar el emoji.
- Las clases de color por categoría salen de variables CSS `--cat-<slug>` definidas por `applyBranding`.

### 🛑 PARADA 5 — Martin prueba
- [ ] Home y catálogo muestran los 12 productos de demo y las 4 categorías con sus colores.
- [ ] Filtrar por categoría, buscar "vela", ordenar por precio.
- [ ] Abrir "Funda de almohadón": el modelo *Terracota* aparece agotado y deshabilitado.
- [ ] Probar en el **celular** (Android y/o iPhone): grilla de 2 columnas, modal usable, swipe del carrusel.
- [ ] Compartir un link `catalogo.html?p=<id>` abre el modal.

---

## 11. FASE 6 — Carrito y pedidos

### 🤖 Qué construye Claude
**`cart.js`** — estado y reglas:
- Formato guardado: `[{producto_id, modelo_id|null, qty}]` en `localStorage` (clave `SITE.carritoKey`). Clave de línea: `${producto_id}:${modelo_id ?? 0}`.
- API: `agregar()`, `quitar()`, `cambiarQty()`, `vaciar()`, `items()`, `contar()`, evento `document.dispatchEvent(new CustomEvent('cart:changed'))`.
- **Rehidratación:** al abrir el drawer o el checkout, `getProductosPorIds()` trae datos frescos (nombre, precio, thumb, stock). Líneas cuyo producto ya no existe/está agotado se eliminan **con aviso** ("Sacamos X porque ya no está disponible"); las cantidades se **recortan al stock** disponible.
- **Sincronización con la cuenta** (tabla `carritos`): al iniciar sesión → traer carrito remoto, **fusionar** con el local (sumar cantidades por línea), guardar el fusionado. Cada cambio → guardado remoto con *debounce* 600 ms. Al cerrar sesión → vaciar la vista local (el remoto queda). Distinguir `INITIAL_SESSION` sin usuario (invitado → **no** vaciar) de `SIGNED_OUT` (sí vaciar). Todo dentro de `onAuth()` (regla §3.5).
- Si se cambia el formato de guardado, subir `carritoKey` a `_v2` para descartar carritos viejos.

**`checkout.js`**:
- Invitado: modal con resumen, "Ingresar / Registrarme" y "Seguir sin cuenta por WhatsApp" (arma el mensaje con datos rehidratados; **no** guarda pedido).
- Logueado: modal con resumen, entrega (*Envío* / *Retiro*), dirección (precargada desde `clientes.direccion`; obligatoria calle si es envío), notas. Al confirmar:
  1. Deshabilitar botón; validar.
  2. `supabase.rpc('crear_pedido', { p_items, p_metodo_entrega, p_direccion, p_notas })` con `p_items = [{producto_id, modelo_id, cantidad}]`.
  3. Si hay error (stock insuficiente, producto no disponible…): mostrar el mensaje del servidor **tal cual** (están redactados para el usuario), refrescar el carrito y no cerrar el modal.
  4. Si sale bien: armar el mensaje de WhatsApp **con los datos que devolvió el servidor** (nombre, modelo, cantidades, precios, total, código), guardar la dirección en el perfil si cambió, vaciar el carrito.
  5. **Apertura de WhatsApp en iOS:** Safari bloquea `window.open` después de un `await`. Por eso se muestra una pantalla de éxito con el código del pedido y un botón grande **"Abrir WhatsApp"** (un `<a href="https://wa.me/...?text=..." target="_blank" rel="noopener">`), además de intentar abrirlo automáticamente. Nunca depender solo de la apertura automática.
- Mensaje de WhatsApp: `config.saludo_whatsapp` + líneas `• Nombre — Modelo x2 — $…` + `Total` + entrega/dirección + notas + código. Texto con `encodeURIComponent`.

### 🛑 PARADA 6 — Martin prueba
- [ ] Agregar productos simples y con modelo; cambiar cantidades; el total es correcto.
- [ ] Cerrar y reabrir el navegador: el carrito sigue.
- [ ] Como invitado, iniciar sesión: el carrito se **fusiona** con el de la cuenta; abrir el sitio en otro dispositivo con la misma cuenta: aparece el mismo carrito.
- [ ] Confirmar pedido logueado (envío y retiro): en Supabase → *Table Editor → pedidos* y *pedido_items* aparece con código `CN-00001`, precios correctos y estado `pendiente`.
- [ ] Intentar pedir más unidades que el stock → mensaje claro, no se crea pedido.
- [ ] El botón "Abrir WhatsApp" funciona en **iPhone**.
- [ ] El stock **no** cambia todavía (se descuenta al confirmar, Fase 8).

---

## 12. FASE 7 — Cuenta del cliente

### 🤖 Qué construye Claude (`cuenta.js`, vista logueado)
- **Mis datos:** nombre, teléfono, dirección (calle, número, ciudad, CP, provincia) → `update` sobre `clientes` (RLS: solo el propio).
- **Mis pedidos:** lista ordenada por fecha desc con código, fecha, total y **estado con color y texto** (Pendiente · Confirmado · Enviado · Entregado · Cancelado); al expandir, los ítems (de `pedido_items`) y los datos de entrega. Estado vacío amable. Botón "Repetir pedido" (agrega los ítems de nuevo al carrito, respetando stock) — opcional, solo si queda simple.
- **Cerrar sesión.**

### 🛑 PARADA 7
- [ ] El pedido de la Fase 6 aparece en "Mis pedidos" con sus ítems.
- [ ] Editar datos y recargar: persisten.
- [ ] **Prueba cruzada de seguridad (manual):** crear un segundo usuario (B), hacerle un pedido; entrar con A y verificar que **no ve** el pedido de B (y viceversa).

---

## 13. FASE 8 — Panel de administración

### 🤖 Qué construye Claude (`admin/index.html` + `js/pages/admin/*`)
**Guardia:** si no hay sesión → formulario de login admin; si hay sesión pero `isAdmin()` es falso → mensaje "Tu cuenta no tiene permisos de administración" + cerrar sesión. (La seguridad real es RLS; esto es solo experiencia de usuario.)

**Pestañas:**
1. **Resumen** (`resumen.js`): tarjetas — ventas del mes, pedidos pendientes, total de productos, productos sin stock; gráfico de barras de los últimos 6 meses (CSS o SVG, **sin librerías**) desde `v_ventas_mensuales`; "Top 5 más vendidos" desde `v_mas_vendidos`; pedidos por estado.
2. **Productos** (`productos.js`): tabla/lista con miniatura, nombre, categoría, precio, stock, y toggles rápidos de *disponible* y *destacado*; buscador; botón *Nuevo*; editar; eliminar con confirmación. **Formulario** (modal o panel): nombre, categoría (select dinámico), precio, descripción corta, descripción larga, orden, destacado, disponible, "Tiene modelos" (si sí: filas dinámicas nombre + stock, mínimo 2; si no: campo stock), gestor de fotos (Fase 9).
   - **Guardado (no atómico, en este orden):** 1) `upsert` del producto; 2) diferencia de modelos por `id` (update de existentes, insert de nuevos, delete de quitados); 3) imágenes (Fase 9). Si algo falla: mensaje claro y el formulario queda abierto con los datos.
   - Al **eliminar un producto**: primero el registro (cascada borra `modelos`), después, "al mejor esfuerzo", los archivos del bucket (`list` por prefijo `<producto_id>/` y `remove`).
3. **Stock** (`stock.js`): vista rápida, una fila por producto simple o por modelo, con input numérico que guarda al salir del campo; color por nivel (0 rojo, ≤3 ámbar, resto verde).
4. **Pedidos** (`pedidos.js`): filtros por estado y búsqueda por código/cliente; detalle con ítems, datos del cliente y entrega; **selector de estado** (cada cambio es un `update` de `pedidos.estado`; el trigger ajusta el stock). Mostrar la nota: *"Al pasar a Confirmado se descuenta el stock; al Cancelar se repone."* Botón **Exportar CSV** (generado en el navegador, con BOM UTF-8 para que Excel lea las tildes). Enlace "Escribir por WhatsApp" al teléfono del cliente.
5. **Clientes** (`clientes.js`): lista (nombre, email, teléfono, fecha de alta, cantidad de pedidos) y detalle con sus pedidos. Exportar CSV.
6. **Categorías** (`categorias.js`): alta, edición (nombre, `slug` autogenerado con `slugify` y editable, color con `<input type="color">`, emoji, orden con botones ↑↓, activa) y borrado (si tiene productos, bloquear con mensaje: la FK lo impide; ofrecer "desactivar").
7. **Configuración** (`config.js`): todos los campos de la tabla `config` (nombre, eslogan, textos del hero y "sobre nosotros", WhatsApp con validación de solo dígitos y código de país, Instagram, email, texto de envíos, saludo de WhatsApp, prefijo de pedidos). Guarda con `update` sobre `id = 1`. Tras guardar, invalidar la caché de `store.js`.

**Calidad:** todo texto de la base se escapa; formularios con validación visible; botones con estado de carga; confirmaciones en acciones destructivas; funciona con teclado; usable en móvil.

### 🛑 PARADA 8 — Martin prueba
- [ ] Crear, editar y borrar un producto (con y sin modelos).
- [ ] Cambiar stock desde la pestaña Stock y ver el cambio en el catálogo público.
- [ ] Cambiar un pedido a **Confirmado** → el stock baja; a **Enviado** → no baja de nuevo; a **Cancelado** → vuelve a subir.
- [ ] Crear una categoría nueva con color y emoji → aparece en filtros y en el home.
- [ ] Cambiar el WhatsApp y el nombre de la tienda en Configuración → se reflejan en el sitio.
- [ ] La pestaña Resumen muestra datos coherentes con los pedidos.
- [ ] Con una cuenta **no admin** abrir `/admin/` → no ve nada y las consultas devuelven vacío.
- [ ] El panel se usa bien en **iPhone**.

---

## 14. FASE 9 — Botón "Subir foto" (compresión y Storage)

### 🤖 `js/lib/image-upload.js`
Cada foto se convierte en **dos archivos**:

| Versión | Lado mayor | Calidad | Peso aprox. | Uso |
|---|---|---|---|---|
| `thumb` | 400 px | 0.75 | 25–40 KB | grilla, carrito, panel |
| `full` | 1200 px | 0.80 | 100–180 KB | modal / carrusel |

**Algoritmo por archivo (procesar de a una, para no agotar la memoria en celulares viejos):**
1. `createImageBitmap(file, { imageOrientation: 'from-image' })` (respeta la orientación EXIF del celular). Si falla (p. ej. HEIC en escritorio), probar con `<img>` + `URL.createObjectURL`; si tampoco, mostrar *"No pudimos leer esta imagen. Probá con JPG o PNG."*
2. Dibujar en `<canvas>` manteniendo proporción, **sin agrandar** fotos chicas.
3. `canvas.toBlob(cb, 'image/webp', calidad)`. **Trampa de Safari:** algunas versiones devuelven PNG sin avisar. Verificar `blob.type === 'image/webp'`; si no, repetir con `'image/jpeg'` (mismas calidades) y usar extensión `.jpg`.
4. `bitmap.close()` para liberar memoria.
5. Validar que cada blob pese **< 1 MB** (el bucket lo exige); si no, bajar calidad en pasos de 0.1 y reintentar.

**Subida:**
- El `id` del producto se genera **en el navegador** con `crypto.randomUUID()` al abrir "Nuevo producto", así se pueden subir fotos antes de que exista el registro.
- Ruta en el bucket `productos`: `<producto_id>/<uuid>-thumb.webp` y `<producto_id>/<uuid>-full.webp`, con `cacheControl: '31536000'` y `upsert: false` (nombres únicos → cacheables un año).
- En la columna `productos.imagenes` se guardan **las rutas**, no URLs completas: `[{"thumb":"<ruta>","full":"<ruta>"}]`. La URL pública se arma con `imgUrl(ruta)`.

**Interfaz en el formulario de producto:**
- `<input type="file" accept="image/*" multiple>` + zona "arrastrá o tocá para elegir".
- Vista previa inmediata (blob local), **orden con botones ↑↓** (funciona en táctil; la primera es la portada), botón quitar (✕), máx. 8 fotos por producto.
- Progreso: "Comprimiendo 2 de 5…", "Subiendo…", y peso final de cada foto.
- **Las subidas se hacen al guardar** (no al elegir), para no dejar archivos huérfanos si se cancela. Si el guardado en la base falla después de subir, se borran los archivos recién subidos. Al quitar una foto existente, sus dos archivos se borran **después** de guardar el producto con éxito.

### ✅ Seguridad ya resuelta en el esquema
El bucket solo acepta `image/webp` e `image/jpeg`, máximo 1 MB por archivo, y solo `es_admin()` puede subir/borrar.

### 🛑 PARADA 9 — Martin prueba (esta es la prueba crítica)
- [ ] Subir 3 fotos reales de un producto desde la **PC**, un **Android** y un **iPhone**. En Storage → `productos` hay 2 archivos por foto y los pesos son chicos (thumb ~30 KB, full ~150 KB).
- [ ] Las fotos del iPhone se ven **derechas** (no giradas).
- [ ] Reordenar fotos: la primera aparece como portada en el catálogo.
- [ ] Quitar una foto: el archivo desaparece del bucket. Borrar un producto: su carpeta queda vacía.
- [ ] Probar con una foto grande (8–12 MP) y con una muy chica (no se agranda).

---

## 15. FASE 10 — Plantillización, documentación y limpieza

### 🤖 Qué hace Claude
1. **Auditoría de "cero hardcodeo":** buscar con `grep` en `js/`, `css/` y HTML que no queden nombres de la tienda, números de WhatsApp, categorías, colores sueltos, ni nombres de marca de ejemplo ("Casa Nube") fuera de `seed.sql`. Reportar el resultado.
2. **Marcar con `<!-- CLIENTE: ... -->`** todo lo estático que se debe cambiar por cliente (metas SEO, JSON-LD, `og-image`, favicon, dominio de `sitemap.xml`/`robots.txt`).
3. **`README.md`**: qué es, stack, cómo correrlo en local (`python3 -m http.server 8080`), estructura, cómo desplegar, cómo correr los tests de RLS.
4. **`docs/MANUAL-ADMIN.md`**: guía **para la dueña del negocio**, en lenguaje simple y con capturas descriptas en texto: entrar al panel, cargar un producto con fotos, manejar modelos y stock, procesar pedidos y estados, crear categorías, cambiar datos de la tienda, ver el resumen. Una página por tarea, sin términos técnicos.
5. **`docs/SETUP-NUEVO-CLIENTE.md`**: checklist para Martin, paso a paso: *Use this template* en GitHub → nuevo proyecto Supabase (cuenta del cliente o propia) → correr `schema.sql` → editar `config` desde el panel/SQL (en vez de `seed.sql`, que es solo del demo) → crear categorías → crear usuario admin e insertarlo en `admins` → editar `site.config.js` y `theme.css` → reemplazar `assets/` → Cloudflare Pages → URLs de Auth → dominio propio → correr `rls_tests.sql` → entrega.
6. Marcar en `docs/` y `README.md` qué partes son el demo y cuáles la plantilla.
7. Borrar `docs/styleguide.html` o moverlo a `docs/` con aviso.

### 👤 Martin
Marca el repo como plantilla: GitHub → repo → **Settings → General → Template repository** ✔.

### 🛑 PARADA 10
- [ ] Martin lee `MANUAL-ADMIN.md` como si fuera la dueña y confirma que se entiende.
- [ ] El `grep` de hardcodeo no encontró nada.

---

## 16. FASE 11 — Seguridad final, pruebas completas y publicación

### 🤖 Claude
1. **`_headers`** para Cloudflare Pages (cabeceras de seguridad):
   ```
   /*
     X-Content-Type-Options: nosniff
     Referrer-Policy: strict-origin-when-cross-origin
     X-Frame-Options: DENY
     Permissions-Policy: camera=(), microphone=(), geolocation=()
     Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://formspree.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://formspree.io
   ```
   Claude verifica que la CSP no rompa nada (si hay estilos inline necesarios, se justifica `'unsafe-inline'` solo en `style-src`).
2. **Revisión de seguridad** del código del frontend: escapado de datos, ausencia de `innerHTML` con datos sin escapar, ausencia de claves sensibles, manejo de errores sin filtrar detalles internos.
3. **Rendimiento:** imágenes con tamaño/lazy, sin JS bloqueante, fuentes con `display=swap`, objetivo Lighthouse móvil ≥ 90 en Performance/Accesibilidad/Buenas prácticas/SEO en el catálogo. Reportar los números reales si puede medirlos; si no, indicarlo.
4. **Accesibilidad:** navegación por teclado completa en carrito, modales y panel.
5. Actualizar `docs/PROGRESO.md` con el estado final y cualquier deuda conocida.

### 👤 Martin: QA final (checklist completo)
**Funcional** (en Chrome de PC, Chrome Android y Safari iPhone):
- [ ] Registro, login, logout, recuperar contraseña.
- [ ] Catálogo, filtros, búsqueda, modal con modelos, swipe.
- [ ] Carrito como invitado y logueado, fusión al ingresar.
- [ ] Pedido completo: se guarda, abre WhatsApp, aparece en "Mis pedidos" y en el panel.
- [ ] Panel: productos, fotos, stock, pedidos con cambio de estado, categorías, configuración, resumen, exportar CSV.

**Seguridad:**
- [ ] `rls_tests.sql` → 36/36 OK (volver a correrlo ahora).
- [ ] Usuario común no puede abrir datos del panel ni ver pedidos ajenos.
- [ ] Ninguna clave `service_role` en el repo (`git log -p | grep -i service_role` vacío).
- [ ] (Opcional) En Supabase → *Authentication → Attack Protection*: activar CAPTCHA (Cloudflare Turnstile) contra registros automáticos.

**Publicación:**
- [ ] Supabase *Site URL* y *Redirect URLs* apuntan a la URL final.
- [ ] Mergear el PR a `main` → Cloudflare publica producción.
- [ ] Prueba final en producción.

### 🛑 PARADA FINAL — Demo listo
El demo está terminado cuando todo el checklist está tildado y `PROGRESO.md` marca todas las fases ✅.

---

## 17. Después del demo (NO hacer ahora; hoja de ruta)

Se activa cuando haya un **cliente real**:

1. **Email propio (SMTP):** el email por defecto de Supabase solo envía a miembros del equipo y con límites muy bajos. Configurar un proveedor (Resend o Brevo, plan gratis) con remitente del dominio del cliente (registros DNS en Cloudflare), traducir las plantillas de Auth al español y decidir con el cliente si exige confirmar email.
2. **Keepalive:** el plan Free pausa los proyectos con ~1 semana sin actividad. Un único Cloudflare Worker con Cron Trigger diario que haga `GET {url}/rest/v1/config?select=id&limit=1` con la clave pública de cada proyecto. (No usar GitHub Actions programadas: GitHub las desactiva a los 60 días sin commits.) Con aviso si un proyecto responde con error.
3. **Backups:** el plan Free no incluye backups descargables. Opciones: plan Pro de Supabase (unos USD 25/mes; recomendable para un cliente que factura), o un `pg_dump` periódico desde un entorno controlado por Martin. Evitar poner la `service_role` en un Worker salvo que sea imprescindible.
4. **Dominio propio** en Cloudflare Pages.
5. **Pagos con Mercado Pago** con Supabase Edge Functions: recalcular total en el servidor, validar la firma del webhook, idempotencia por pedido, verificar monto, descontar stock en transacción.
6. **Mejoras de producto:** paginación en servidor si el catálogo supera ~500 productos, cupones, envío calculado, multi-imagen por modelo, etc.

### Costos del demo
| Servicio | Plan | Costo |
|---|---|---|
| GitHub | Free | USD 0 |
| Supabase | Free (2 proyectos activos; pausa por inactividad; sin backups) | USD 0 |
| Cloudflare Pages | Free | USD 0 |
| Dominio propio | Opcional | Variable |

---

## 18. Riesgos y trampas conocidas (resumen)

| Riesgo | Mitigación en este plan |
|---|---|
| Precios manipulados desde el navegador | `crear_pedido` `security definer` recalcula todo; sin INSERT directo (test lo comprueba) |
| Perfil de cliente no se crea si hay confirmación de email | Trigger `handle_new_user` en la base |
| Deadlock del cliente Supabase al usar `await` dentro de `onAuthStateChange` | Wrapper `onAuth()` con `setTimeout` (§3.5) |
| Recuperar contraseña no tiene pantalla propia en Supabase | Fase 4 la construye (`PASSWORD_RECOVERY`) |
| Safari devuelve PNG en lugar de WebP | Verificar `blob.type` y respaldo JPEG |
| Fotos del iPhone giradas | `imageOrientation: 'from-image'` |
| iOS bloquea `window.open` tras `await` | Pantalla de éxito con enlace/botón "Abrir WhatsApp" |
| Carritos con precios o IDs viejos | El carrito guarda solo IDs y cantidades; rehidrata siempre |
| Versión flotante de supabase-js rompe producción | Versión exacta fijada |
| Archivos huérfanos en el bucket | Subida al guardar, limpieza ante fallo y al borrar |
| Defaults de permisos de Supabase cambian | `grant`/`revoke` explícitos en `schema.sql` |
| Plan Free: pausa y sin backups | Aceptable para demo; ver §17 para clientes reales |

---

## 19. Glosario rápido (para Martin)

- **Postgres:** el tipo de base de datos de Supabase; tablas relacionadas entre sí.
- **RLS (Row Level Security):** reglas que dicen *qué filas puede ver o modificar cada usuario*. Es la "seguridad" del sistema, no el ocultar claves.
- **Clave anon / publishable:** clave pública que va en el sitio. Sola no permite nada que RLS no autorice.
- **service_role:** clave maestra que se saltea RLS. **Nunca** va en el sitio ni en el repo.
- **RPC / función:** código que corre dentro de la base (acá, `crear_pedido`).
- **Trigger:** acción automática de la base ante un evento (por ejemplo, descontar stock al confirmar).
- **Bucket:** carpeta de archivos en Supabase Storage.
- **Preview deploy:** copia temporal del sitio que Cloudflare crea por cada rama/PR para probar antes de publicar.
- **SQL Editor:** pantalla de Supabase donde se pega y ejecuta SQL.

---

# APÉNDICES

## Apéndice A — `supabase/schema.sql`

Copiar textualmente. Validado en PostgreSQL 16 (se ejecuta dos veces sin error: es idempotente).

```sql
-- ============================================================
-- CATALOGO-BASE · schema.sql
-- Se pega UNA vez en Supabase → SQL Editor de cada proyecto nuevo.
-- Es idempotente en lo posible (create or replace / if not exists).
-- ============================================================

-- ── Utilidades ───────────────────────────────────────────────
create or replace function public.set_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado = now();
  return new;
end $$;

-- ── Tablas ───────────────────────────────────────────────────

-- Configuración de la tienda (una sola fila, id = 1)
create table if not exists public.config (
  id              int primary key default 1 check (id = 1),
  nombre_tienda   text not null,
  eslogan         text,
  hero_titulo     text,
  hero_texto      text,
  sobre_titulo    text,
  sobre_texto     text,
  whatsapp        text not null,                 -- solo dígitos, con código de país
  instagram       text,
  email           text,
  envio_texto     text,
  saludo_whatsapp text not null default 'Hola! Quisiera hacer este pedido:',
  prefijo_pedido  text not null default 'PED',   -- ej. 'SG' → SG-00042
  actualizado     timestamptz not null default now()
);

create table if not exists public.categorias (
  id      bigint generated always as identity primary key,
  nombre  text not null unique,
  slug    text not null unique,                  -- para ?cat= en la URL
  color   text,                                  -- hex, ej. '#F4E1D2'
  emoji   text,
  orden   int not null default 0,
  activa  boolean not null default true
);

create table if not exists public.productos (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null check (length(trim(nombre)) > 0),
  categoria_id      bigint not null references public.categorias(id),
  precio            integer not null check (precio >= 0),
  descripcion       text not null default '',
  descripcion_larga text,
  imagenes          jsonb not null default '[]'::jsonb,  -- [{"thumb":"<path>","full":"<path>"}]
  emoji             text not null default '',
  tiene_variantes   boolean not null default false,
  stock             integer not null default 0 check (stock >= 0),  -- solo si NO tiene variantes
  disponible        boolean not null default true,
  destacado         boolean not null default false,
  orden             int not null default 0,
  creado            timestamptz not null default now(),
  actualizado       timestamptz not null default now(),
  check (jsonb_typeof(imagenes) = 'array')
);

create table if not exists public.modelos (
  id          bigint generated always as identity primary key,
  producto_id uuid not null references public.productos(id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  stock       integer not null default 0 check (stock >= 0),
  orden       int not null default 0,
  unique (producto_id, nombre)
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.clientes (
  id            uuid primary key references auth.users(id) on delete cascade,
  nombre        text,
  email         text,
  telefono      text,
  direccion     jsonb not null default '{}'::jsonb,  -- {calle,numero,ciudad,cp,provincia}
  creado        timestamptz not null default now(),
  ultimo_acceso timestamptz
);

create table if not exists public.carritos (
  cliente_id  uuid primary key references auth.users(id) on delete cascade,
  items       jsonb not null default '[]'::jsonb,   -- [{producto_id, modelo_id, qty}]
  actualizado timestamptz not null default now(),
  check (jsonb_typeof(items) = 'array')
);

create sequence if not exists public.pedidos_numero_seq;

create table if not exists public.pedidos (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint not null unique default nextval('public.pedidos_numero_seq'),
  codigo           text not null unique,
  cliente_id       uuid not null references auth.users(id),
  cliente_nombre   text,
  cliente_email    text,
  cliente_telefono text,
  total            integer not null default 0 check (total >= 0),
  estado           text not null default 'pendiente'
                     check (estado in ('pendiente','confirmado','enviado','entregado','cancelado')),
  metodo_entrega   text not null check (metodo_entrega in ('envio','retiro')),
  direccion_envio  jsonb,
  notas            text,
  stock_descontado boolean not null default false,
  creado           timestamptz not null default now(),
  actualizado      timestamptz not null default now()
);

create table if not exists public.pedido_items (
  id          bigint generated always as identity primary key,
  pedido_id   uuid not null references public.pedidos(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  modelo_id   bigint references public.modelos(id) on delete set null,
  nombre      text not null,          -- snapshot
  modelo      text,                   -- snapshot
  precio      integer not null,       -- snapshot
  cantidad    integer not null check (cantidad > 0),
  subtotal    integer not null
);

-- ── Índices (Postgres NO indexa las FKs solo) ────────────────
create index if not exists idx_productos_catalogo on public.productos (categoria_id, disponible, orden);
create index if not exists idx_productos_destacado on public.productos (destacado) where destacado;
create index if not exists idx_modelos_producto   on public.modelos (producto_id);
create index if not exists idx_pedidos_cliente    on public.pedidos (cliente_id, creado desc);
create index if not exists idx_pedidos_estado     on public.pedidos (estado, creado desc);
create index if not exists idx_items_pedido       on public.pedido_items (pedido_id);
create index if not exists idx_items_producto     on public.pedido_items (producto_id);

-- ── Triggers de "actualizado" ────────────────────────────────
drop trigger if exists trg_config_upd    on public.config;
drop trigger if exists trg_productos_upd on public.productos;
drop trigger if exists trg_carritos_upd  on public.carritos;
drop trigger if exists trg_pedidos_upd   on public.pedidos;
create trigger trg_config_upd    before update on public.config    for each row execute function public.set_actualizado();
create trigger trg_productos_upd before update on public.productos for each row execute function public.set_actualizado();
create trigger trg_carritos_upd  before update on public.carritos  for each row execute function public.set_actualizado();
create trigger trg_pedidos_upd   before update on public.pedidos   for each row execute function public.set_actualizado();

-- ── Seguridad: ¿es admin? ────────────────────────────────────
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ── Alta automática del cliente al registrarse ───────────────
-- (Funciona aunque se active la confirmación por email: no depende de sesión.)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.clientes (id, nombre, email, telefono)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'nombre','')), ''),
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'telefono','')), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Crear pedido de forma atómica y con precios del servidor ─
-- p_items: [{"producto_id":"<uuid>","modelo_id":<bigint|null>,"cantidad":<int>}]
-- Devuelve: {id, codigo, total, items:[{nombre,modelo,precio,cantidad,subtotal}]}
create or replace function public.crear_pedido(
  p_items          jsonb,
  p_metodo_entrega text,
  p_direccion      jsonb default null,
  p_notas          text  default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_cli       public.clientes%rowtype;
  v_pedido_id uuid := gen_random_uuid();
  v_numero    bigint;
  v_prefijo   text;
  v_codigo    text;
  v_total     integer := 0;
  v_item      jsonb;
  v_prod      public.productos%rowtype;
  v_mod       public.modelos%rowtype;
  v_cant      integer;
  v_modelo    text;
  v_modelo_id bigint;
  v_lineas    jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión para hacer un pedido' using errcode = '28000';
  end if;
  if p_metodo_entrega is null or p_metodo_entrega not in ('envio','retiro') then
    raise exception 'Método de entrega inválido';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Demasiados productos en un solo pedido';
  end if;

  select * into v_cli from public.clientes where id = v_uid;
  select prefijo_pedido into v_prefijo from public.config where id = 1;

  v_numero := nextval('public.pedidos_numero_seq');
  v_codigo := coalesce(v_prefijo, 'PED') || '-' || lpad(v_numero::text, 5, '0');

  insert into public.pedidos (id, numero, codigo, cliente_id, cliente_nombre, cliente_email,
                              cliente_telefono, total, estado, metodo_entrega, direccion_envio, notas)
  values (v_pedido_id, v_numero, v_codigo, v_uid, v_cli.nombre, v_cli.email, v_cli.telefono,
          0, 'pendiente', p_metodo_entrega,
          case when p_metodo_entrega = 'envio' then p_direccion else null end,
          left(p_notas, 500));

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_item->>'cantidad')::integer;
    if v_cant is null or v_cant < 1 or v_cant > 99 then
      raise exception 'Cantidad inválida';
    end if;

    select * into v_prod from public.productos
      where id = (v_item->>'producto_id')::uuid and disponible;
    if not found then
      raise exception 'Uno de los productos ya no está disponible';
    end if;

    v_modelo := null; v_modelo_id := null;
    if v_prod.tiene_variantes then
      select * into v_mod from public.modelos
        where id = (v_item->>'modelo_id')::bigint and producto_id = v_prod.id;
      if not found then
        raise exception 'Falta elegir el modelo de "%"', v_prod.nombre;
      end if;
      if v_mod.stock < v_cant then
        raise exception 'Sin stock suficiente de "% — %"', v_prod.nombre, v_mod.nombre;
      end if;
      v_modelo := v_mod.nombre; v_modelo_id := v_mod.id;
    elsif v_prod.stock < v_cant then
      raise exception 'Sin stock suficiente de "%"', v_prod.nombre;
    end if;

    insert into public.pedido_items (pedido_id, producto_id, modelo_id, nombre, modelo, precio, cantidad, subtotal)
    values (v_pedido_id, v_prod.id, v_modelo_id, v_prod.nombre, v_modelo,
            v_prod.precio, v_cant, v_prod.precio * v_cant);

    v_total := v_total + v_prod.precio * v_cant;
    v_lineas := v_lineas || jsonb_build_object(
      'nombre', v_prod.nombre, 'modelo', v_modelo, 'precio', v_prod.precio,
      'cantidad', v_cant, 'subtotal', v_prod.precio * v_cant);
  end loop;

  update public.pedidos set total = v_total where id = v_pedido_id;

  return jsonb_build_object('id', v_pedido_id, 'codigo', v_codigo, 'total', v_total, 'items', v_lineas);
end $$;

-- ── Stock: descuenta al confirmar, repone al cancelar ────────
create or replace function public.ajustar_stock_por_estado()
returns trigger language plpgsql security definer set search_path = public as $$
declare it record;
begin
  -- pendiente → confirmado/enviado/entregado: descontar (una sola vez)
  if new.estado in ('confirmado','enviado','entregado') and not old.stock_descontado then
    for it in select producto_id, modelo_id, cantidad from public.pedido_items where pedido_id = new.id loop
      if it.modelo_id is not null then
        update public.modelos set stock = greatest(stock - it.cantidad, 0) where id = it.modelo_id;
      elsif it.producto_id is not null then
        update public.productos set stock = greatest(stock - it.cantidad, 0) where id = it.producto_id;
      end if;
    end loop;
    new.stock_descontado := true;
  -- cualquier estado → cancelado: reponer si se había descontado
  elsif new.estado = 'cancelado' and old.stock_descontado then
    for it in select producto_id, modelo_id, cantidad from public.pedido_items where pedido_id = new.id loop
      if it.modelo_id is not null then
        update public.modelos set stock = stock + it.cantidad where id = it.modelo_id;
      elsif it.producto_id is not null then
        update public.productos set stock = stock + it.cantidad where id = it.producto_id;
      end if;
    end loop;
    new.stock_descontado := false;
  end if;
  return new;
end $$;

drop trigger if exists trg_pedidos_stock on public.pedidos;
create trigger trg_pedidos_stock
  before update of estado on public.pedidos
  for each row when (old.estado is distinct from new.estado)
  execute function public.ajustar_stock_por_estado();

-- ── RLS ──────────────────────────────────────────────────────
alter table public.config       enable row level security;
alter table public.categorias   enable row level security;
alter table public.productos    enable row level security;
alter table public.modelos      enable row level security;
alter table public.admins       enable row level security;
alter table public.clientes     enable row level security;
alter table public.carritos     enable row level security;
alter table public.pedidos      enable row level security;
alter table public.pedido_items enable row level security;

-- config
drop policy if exists config_read  on public.config;
drop policy if exists config_admin on public.config;
create policy config_read  on public.config for select using (true);
create policy config_admin on public.config for update using (public.es_admin()) with check (public.es_admin());

-- categorias
drop policy if exists categorias_read  on public.categorias;
drop policy if exists categorias_admin on public.categorias;
create policy categorias_read  on public.categorias for select using (activa or public.es_admin());
create policy categorias_admin on public.categorias for all using (public.es_admin()) with check (public.es_admin());

-- productos
drop policy if exists productos_read  on public.productos;
drop policy if exists productos_admin on public.productos;
create policy productos_read  on public.productos for select using (disponible or public.es_admin());
create policy productos_admin on public.productos for all using (public.es_admin()) with check (public.es_admin());

-- modelos
drop policy if exists modelos_read  on public.modelos;
drop policy if exists modelos_admin on public.modelos;
create policy modelos_read  on public.modelos for select using (true);
create policy modelos_admin on public.modelos for all using (public.es_admin()) with check (public.es_admin());

-- admins: cada usuario solo ve si él mismo es admin; nadie escribe desde la API
drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select using (user_id = auth.uid());

-- clientes
drop policy if exists clientes_read   on public.clientes;
drop policy if exists clientes_update on public.clientes;
drop policy if exists clientes_delete on public.clientes;
create policy clientes_read   on public.clientes for select using (id = auth.uid() or public.es_admin());
create policy clientes_update on public.clientes for update using (id = auth.uid()) with check (id = auth.uid());
create policy clientes_delete on public.clientes for delete using (public.es_admin());

-- carritos
drop policy if exists carritos_own on public.carritos;
create policy carritos_own on public.carritos for all
  using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());

-- pedidos: SIN policy de insert (solo crear_pedido, que es security definer)
drop policy if exists pedidos_read   on public.pedidos;
drop policy if exists pedidos_update on public.pedidos;
drop policy if exists pedidos_delete on public.pedidos;
create policy pedidos_read   on public.pedidos for select using (cliente_id = auth.uid() or public.es_admin());
create policy pedidos_update on public.pedidos for update using (public.es_admin()) with check (public.es_admin());
create policy pedidos_delete on public.pedidos for delete using (public.es_admin());

-- pedido_items: SIN policy de insert
drop policy if exists items_read   on public.pedido_items;
drop policy if exists items_delete on public.pedido_items;
create policy items_read on public.pedido_items for select using (
  exists (select 1 from public.pedidos p
          where p.id = pedido_id and (p.cliente_id = auth.uid() or public.es_admin())));
create policy items_delete on public.pedido_items for delete using (public.es_admin());

-- ── Vistas de reportes (security_invoker: respetan RLS del que consulta) ──
create or replace view public.v_ventas_mensuales with (security_invoker = true) as
  select date_trunc('month', creado) as mes, count(*)::int as pedidos, coalesce(sum(total),0)::bigint as total
  from public.pedidos where estado <> 'cancelado' group by 1;

create or replace view public.v_mas_vendidos with (security_invoker = true) as
  select i.producto_id, i.nombre, sum(i.cantidad)::int as unidades, sum(i.subtotal)::bigint as total
  from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
  where p.estado <> 'cancelado' group by i.producto_id, i.nombre;

-- ── Privilegios explícitos (no depender de los defaults de Supabase) ──
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.config, public.categorias, public.productos, public.modelos to anon, authenticated;
grant update on public.config to authenticated;
grant insert, update, delete on public.categorias, public.productos, public.modelos to authenticated;

grant select on public.admins to authenticated;
grant select, update on public.clientes to authenticated;
grant delete on public.clientes to authenticated;
grant select, insert, update, delete on public.carritos to authenticated;
grant select, update, delete on public.pedidos to authenticated;
grant select, delete on public.pedido_items to authenticated;

grant usage, select on all sequences in schema public to authenticated;  -- identity de categorias/modelos

grant select on public.v_ventas_mensuales, public.v_mas_vendidos to authenticated;

grant execute on function public.es_admin()        to anon, authenticated;
grant execute on function public.crear_pedido(jsonb, text, jsonb, text) to authenticated;
-- handle_new_user y ajustar_stock_por_estado los ejecutan triggers (no necesitan grant)

-- ── Storage: bucket público de imágenes de productos ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 1048576, array['image/webp','image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists productos_img_read   on storage.objects;
drop policy if exists productos_img_insert on storage.objects;
drop policy if exists productos_img_update on storage.objects;
drop policy if exists productos_img_delete on storage.objects;
create policy productos_img_read   on storage.objects for select using (bucket_id = 'productos');
create policy productos_img_insert on storage.objects for insert with check (bucket_id = 'productos' and public.es_admin());
create policy productos_img_update on storage.objects for update using (bucket_id = 'productos' and public.es_admin());
create policy productos_img_delete on storage.objects for delete using (bucket_id = 'productos' and public.es_admin());
```

## Apéndice B — `supabase/tests/rls_tests.sql`

Se pega en el SQL Editor. Termina **siempre** con un error `RESULTADO: ...` a propósito (así revierte todo y no deja datos). Éxito = `TODOS LOS TESTS OK (36/36)`. Cubre: anónimo, cliente A, cliente B y admin; manipulación de precios, inserts directos, aislamiento entre clientes, stock (descuento único y reposición), vistas de reportes y trigger de alta de cliente.

```sql
-- ============================================================
-- CATALOGO-BASE · supabase/tests/rls_tests.sql
-- Pegar en Supabase → SQL Editor y ejecutar. NO deja datos: el script
-- termina siempre con un error "RESULTADO ..." que revierte todo.
-- Si dice "TODOS LOS TESTS OK" la seguridad funciona.
-- ============================================================
do $$
declare
  ua uuid := gen_random_uuid();   -- cliente A
  ub uuid := gen_random_uuid();   -- cliente B
  uadm uuid := gen_random_uuid(); -- admin
  cat_id bigint;
  p1 uuid; p2 uuid; p3 uuid; m1 bigint;
  n int; n2 int; total int := 0;
  fallos text[] := '{}';
  r jsonb;
  ped_a uuid;
begin
  -- ── Datos de prueba (como superusuario) ──
  insert into auth.users (id, email, raw_user_meta_data) values
    (ua, 'a@test.local', '{"nombre":"Cliente A","telefono":"111"}'),
    (ub, 'b@test.local', '{"nombre":"Cliente B"}'),
    (uadm, 'admin@test.local', '{"nombre":"Admin"}');
  insert into public.admins (user_id) values (uadm);
  insert into public.config (id, nombre_tienda, whatsapp) values (1, 'Test', '5491100000000')
    on conflict (id) do nothing;
  insert into public.categorias (nombre, slug) values ('Cat Test', 'cat-test') returning id into cat_id;
  insert into public.productos (nombre, categoria_id, precio, stock) values ('Simple', cat_id, 1000, 5) returning id into p1;
  insert into public.productos (nombre, categoria_id, precio, tiene_variantes) values ('Variantes', cat_id, 2000, true) returning id into p2;
  insert into public.modelos (producto_id, nombre, stock) values (p2, 'Rojo', 2) returning id into m1;
  insert into public.productos (nombre, categoria_id, precio, stock, disponible) values ('Oculto', cat_id, 500, 9, false) returning id into p3;

  total := total+1;
  select count(*) into n from public.clientes where id in (ua, ub, uadm);
  if n <> 3 then fallos := array_append(fallos, 'trigger handle_new_user no creó los 3 clientes'); end if;

  -- ═══ ANÓNIMO ═══
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;

  total := total+1;
  select count(*) into n from public.productos where categoria_id = cat_id;
  if n <> 2 then fallos := array_append(fallos, format('anon ve %s productos (esperado 2, sin el oculto)', n)); end if;

  total := total+1;
  begin insert into public.productos (nombre, categoria_id, precio) values ('X', cat_id, 1);
        fallos := array_append(fallos, 'anon pudo insertar producto');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  begin perform public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', p1, 'cantidad', 1)), 'retiro');
        fallos := array_append(fallos, 'anon pudo ejecutar crear_pedido');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  begin perform 1 from public.v_ventas_mensuales;
        fallos := array_append(fallos, 'anon pudo leer reportes');
  exception when insufficient_privilege then null; end;

  total := total+1;
  begin select count(*) into n from public.clientes;
        if n <> 0 then fallos := array_append(fallos, 'anon ve clientes'); end if;
  exception when insufficient_privilege then null; end;
  reset role;

  -- ═══ CLIENTE A ═══
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;

  total := total+1;
  begin
    r := public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', p1, 'cantidad', 2)), 'retiro', null, 'nota');
    ped_a := (r->>'id')::uuid;
    if (r->>'total')::int <> 2000 then fallos := array_append(fallos, 'total mal calculado'); end if;
    if r->>'codigo' !~ '^[A-Z]+-[0-9]{5}$' then fallos := array_append(fallos, 'código con formato inesperado: ' || (r->>'codigo')); end if;
  exception when others then fallos := array_append(fallos, 'A no pudo crear pedido válido: ' || sqlerrm); end;

  total := total+1;
  begin
    r := public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', p2, 'modelo_id', m1, 'cantidad', 1)), 'envio',
                             '{"calle":"X 1"}'::jsonb);
    if (r->>'total')::int <> 2000 then fallos := array_append(fallos, 'pedido con variante: total mal'); end if;
  exception when others then fallos := array_append(fallos, 'A no pudo pedir variante: ' || sqlerrm); end;

  total := total+1;
  begin perform public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', p2, 'cantidad', 1)), 'retiro');
        fallos := array_append(fallos, 'se aceptó producto con variantes sin modelo');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  begin perform public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', p1, 'cantidad', 6)), 'retiro');
        fallos := array_append(fallos, 'se aceptó cantidad mayor al stock');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  begin perform public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', p3, 'cantidad', 1)), 'retiro');
        fallos := array_append(fallos, 'se aceptó producto no disponible');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  begin perform public.crear_pedido('[]'::jsonb, 'retiro');
        fallos := array_append(fallos, 'se aceptó carrito vacío');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  begin insert into public.pedidos (codigo, cliente_id, total, metodo_entrega) values ('HACK-1', ua, 1, 'retiro');
        fallos := array_append(fallos, 'A pudo insertar pedido directo');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  begin insert into public.pedido_items (pedido_id, nombre, precio, cantidad, subtotal) values (ped_a, 'x', 1, 1, 1);
        fallos := array_append(fallos, 'A pudo insertar ítem directo');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  update public.pedidos set estado = 'entregado' where id = ped_a;
  get diagnostics n = row_count;
  if n <> 0 then fallos := array_append(fallos, 'A pudo cambiar el estado de su pedido'); end if;

  total := total+1;
  select count(*) into n from public.pedidos;
  if n <> 2 then fallos := array_append(fallos, format('A ve %s pedidos (esperado 2)', n)); end if;

  total := total+1;
  select count(*) into n from public.pedido_items;
  if n <> 2 then fallos := array_append(fallos, format('A ve %s ítems (esperado 2)', n)); end if;

  total := total+1;
  select count(*) into n from public.clientes;
  if n <> 1 then fallos := array_append(fallos, format('A ve %s clientes (esperado 1)', n)); end if;

  total := total+1;
  update public.clientes set telefono = '999' where id = ua;
  get diagnostics n = row_count;
  if n <> 1 then fallos := array_append(fallos, 'A no pudo editar su propio perfil'); end if;

  total := total+1;
  update public.clientes set telefono = '999' where id = ub;
  get diagnostics n = row_count;
  if n <> 0 then fallos := array_append(fallos, 'A pudo editar el perfil de B'); end if;

  total := total+1;
  insert into public.carritos (cliente_id, items) values (ua, '[]');
  begin insert into public.carritos (cliente_id, items) values (ub, '[]');
        fallos := array_append(fallos, 'A pudo crear el carrito de B');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  update public.productos set precio = 1 where id = p1;
  get diagnostics n = row_count;
  if n <> 0 then fallos := array_append(fallos, 'A pudo editar un producto'); end if;

  total := total+1;
  update public.config set nombre_tienda = 'hack';
  get diagnostics n = row_count;
  if n <> 0 then fallos := array_append(fallos, 'A pudo editar la config'); end if;

  total := total+1;
  begin insert into public.admins (user_id) values (ua);
        fallos := array_append(fallos, 'A pudo hacerse admin');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  select count(*) into n from public.productos where id = p3;
  if n <> 0 then fallos := array_append(fallos, 'A ve un producto no disponible'); end if;
  reset role;

  -- ═══ CLIENTE B ═══
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;

  total := total+1;
  select count(*) into n from public.pedidos;
  if n <> 0 then fallos := array_append(fallos, format('B ve %s pedidos de A', n)); end if;

  total := total+1;
  select count(*) into n from public.pedido_items;
  if n <> 0 then fallos := array_append(fallos, format('B ve %s ítems de A', n)); end if;

  total := total+1;
  select count(*) into n from public.carritos;
  if n <> 0 then fallos := array_append(fallos, 'B ve el carrito de A'); end if;
  reset role;

  -- ═══ ADMIN ═══
  perform set_config('request.jwt.claims', json_build_object('sub', uadm, 'role', 'authenticated')::text, true);
  set local role authenticated;

  total := total+1;
  select count(*) into n from public.pedidos;
  if n <> 2 then fallos := array_append(fallos, format('admin ve %s pedidos (esperado 2)', n)); end if;

  total := total+1;
  select count(*) into n from public.productos where id = p3;
  if n <> 1 then fallos := array_append(fallos, 'admin no ve el producto oculto'); end if;

  total := total+1;
  begin insert into public.productos (nombre, categoria_id, precio) values ('Nuevo', cat_id, 10);
  exception when others then fallos := array_append(fallos, 'admin no pudo crear producto: ' || sqlerrm); end;

  -- stock: confirmar descuenta, cancelar repone
  total := total+1;
  update public.pedidos set estado = 'confirmado' where id = ped_a;
  select stock into n from public.productos where id = p1;
  if n <> 3 then fallos := array_append(fallos, format('al confirmar el stock quedó %s (esperado 3)', n)); end if;

  total := total+1;
  select coalesce(sum(v.total),0), coalesce(sum(v.pedidos),0) into n, n2 from public.v_ventas_mensuales v;
  if n <> 4000 or n2 <> 2 then fallos := array_append(fallos, format('vista ventas: total=%s pedidos=%s (esperado 4000/2)', n, n2)); end if;

  total := total+1;
  select count(*) into n from public.v_mas_vendidos;
  if n <> 2 then fallos := array_append(fallos, format('vista más vendidos: %s filas (esperado 2)', n)); end if;

  total := total+1;
  update public.pedidos set estado = 'enviado' where id = ped_a;   -- no debe descontar dos veces
  select stock into n from public.productos where id = p1;
  if n <> 3 then fallos := array_append(fallos, format('descuento doble de stock: %s (esperado 3)', n)); end if;

  total := total+1;
  update public.pedidos set estado = 'cancelado' where id = ped_a;
  select stock into n from public.productos where id = p1;
  if n <> 5 then fallos := array_append(fallos, format('al cancelar el stock quedó %s (esperado 5)', n)); end if;
  reset role;

  if array_length(fallos, 1) is null then
    raise exception 'RESULTADO: TODOS LOS TESTS OK (%/%). Se revirtió todo, no quedó nada guardado.', total, total;
  else
    raise exception 'RESULTADO: FALLARON % de % tests: %', array_length(fallos, 1), total, array_to_string(fallos, ' | ');
  end if;
end $$;
```

## Apéndice C — `supabase/seed.sql`

Datos de la tienda ficticia "Casa Nube". Solo para el demo (en un cliente real se carga `config` y las categorías desde el panel o con SQL propio). Re-ejecutable: no duplica productos.

```sql
-- ============================================================
-- CATALOGO-BASE · supabase/seed.sql  (datos de DEMO, tienda ficticia)
-- Correr DESPUÉS de schema.sql. Es re-ejecutable.
-- ============================================================
insert into public.config (id, nombre_tienda, eslogan, hero_titulo, hero_texto, sobre_titulo, sobre_texto,
                           whatsapp, instagram, email, envio_texto, saludo_whatsapp, prefijo_pedido)
values (1, 'Casa Nube', 'Objetos lindos para tu hogar',
        'Cosas simples que hacen tu casa más tuya',
        'Textiles, decoración y regalos elegidos con cariño. Hacé tu pedido en minutos y lo coordinamos por WhatsApp.',
        'Quiénes somos',
        'Casa Nube es una tienda de demostración. Acá va la historia real de cada cliente: quién es, qué vende y por qué lo hace.',
        '5491100000000', 'casanube', 'hola@casanube.example',
        'Enviamos a todo el país. Retiro sin cargo en zona norte.',
        'Hola Casa Nube! Quisiera hacer este pedido:', 'CN')
on conflict (id) do update set
  nombre_tienda = excluded.nombre_tienda, eslogan = excluded.eslogan, hero_titulo = excluded.hero_titulo,
  hero_texto = excluded.hero_texto, sobre_titulo = excluded.sobre_titulo, sobre_texto = excluded.sobre_texto,
  whatsapp = excluded.whatsapp, instagram = excluded.instagram, email = excluded.email,
  envio_texto = excluded.envio_texto, saludo_whatsapp = excluded.saludo_whatsapp, prefijo_pedido = excluded.prefijo_pedido;

insert into public.categorias (nombre, slug, color, emoji, orden) values
  ('Hogar',      'hogar',      '#F3E3D3', '🏠', 1),
  ('Textiles',   'textiles',   '#DCE8F2', '🧺', 2),
  ('Accesorios', 'accesorios', '#E6E0F2', '✨', 3),
  ('Regalos',    'regalos',    '#F7DDE2', '🎁', 4)
on conflict (slug) do nothing;

-- Productos (solo si la tabla está vacía, para no duplicar al re-ejecutar)
do $$
declare
  c_hogar bigint; c_text bigint; c_acc bigint; c_reg bigint; pid uuid;
begin
  if exists (select 1 from public.productos) then return; end if;
  select id into c_hogar from public.categorias where slug = 'hogar';
  select id into c_text  from public.categorias where slug = 'textiles';
  select id into c_acc   from public.categorias where slug = 'accesorios';
  select id into c_reg   from public.categorias where slug = 'regalos';

  -- Sin variantes
  insert into public.productos (nombre, categoria_id, precio, descripcion, descripcion_larga, emoji, stock, destacado, orden) values
   ('Vela de soja Lavanda', c_hogar, 8500, 'Vela artesanal de 200 g.', 'Cera de soja con aroma a lavanda. Dura unas 40 horas.', '🕯️', 12, true, 1),
   ('Difusor de ambiente',  c_hogar, 12900, 'Difusor con varillas, 150 ml.', null, '🌿', 8, false, 2),
   ('Posavasos de cerámica (x4)', c_hogar, 9800, 'Set de cuatro posavasos.', null, '☕', 15, false, 3),
   ('Tote bag de algodón',  c_acc, 7400, 'Bolso de tela resistente.', null, '👜', 20, true, 1),
   ('Llavero de lana',      c_acc, 2900, 'Llavero tejido a mano.', null, '🔑', 30, false, 2),
   ('Caja de regalo chica', c_reg, 6500, 'Caja con papel de seda y tarjeta.', null, '🎁', 10, false, 1),
   ('Set de tarjetas (x6)', c_reg, 3800, 'Tarjetas ilustradas con sobre.', null, '💌', 25, false, 2);

  -- Con variantes (modelos con stock propio)
  insert into public.productos (nombre, categoria_id, precio, descripcion, descripcion_larga, emoji, tiene_variantes, destacado, orden)
   values ('Funda de almohadón', c_text, 11500, 'Funda de 50×50 cm con cierre.', 'Lino lavado, disponible en varios colores.', '🛋️', true, true, 1)
   returning id into pid;
  insert into public.modelos (producto_id, nombre, stock, orden) values
   (pid, 'Arena', 6, 1), (pid, 'Verde salvia', 4, 2), (pid, 'Terracota', 0, 3);

  insert into public.productos (nombre, categoria_id, precio, descripcion, emoji, tiene_variantes, orden)
   values ('Manta de algodón', c_text, 28900, 'Manta liviana 150×200 cm.', '🧣', true, 2) returning id into pid;
  insert into public.modelos (producto_id, nombre, stock, orden) values
   (pid, 'Crudo', 5, 1), (pid, 'Gris', 3, 2);

  insert into public.productos (nombre, categoria_id, precio, descripcion, emoji, tiene_variantes, orden)
   values ('Repasador de cocina (x2)', c_text, 6200, 'Dos repasadores de algodón.', '🍽️', true, 3) returning id into pid;
  insert into public.modelos (producto_id, nombre, stock, orden) values
   (pid, 'Rayas', 10, 1), (pid, 'Lisos', 10, 2), (pid, 'Cuadros', 2, 3);

  insert into public.productos (nombre, categoria_id, precio, descripcion, emoji, tiene_variantes, orden)
   values ('Scrunchie de seda', c_acc, 3400, 'Elástico de pelo, seda lavable.', '🎀', true, 3) returning id into pid;
  insert into public.modelos (producto_id, nombre, stock, orden) values
   (pid, 'Negro', 9, 1), (pid, 'Rosa', 7, 2), (pid, 'Marfil', 5, 3);

  insert into public.productos (nombre, categoria_id, precio, descripcion, emoji, tiene_variantes, orden)
   values ('Taza esmaltada', c_reg, 7900, 'Taza retro de 350 ml.', '🫖', true, 3) returning id into pid;
  insert into public.modelos (producto_id, nombre, stock, orden) values
   (pid, 'Blanca', 8, 1), (pid, 'Celeste', 6, 2);
end $$;
```

---
*Fin del plan maestro. Diseño y desarrollo: Martin Romero Studio.*
