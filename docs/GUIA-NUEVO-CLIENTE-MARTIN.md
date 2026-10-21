# Guía de Martin: del "sí, quiero" a la tienda entregada

> Documento para **vos**. Lo leés el día que consigas un cliente del plan catálogo. Tiene tres partes: **A)** qué hacer y qué pedirle al cliente antes de tocar nada, **B)** tu paso a paso (lo que hacés vos y lo que hago yo) con los mensajes listos para pegarme, y **C)** qué hacer cuando algo sale mal.
> Los documentos técnicos para mí (`GUIA-TECNICA-CORE.md`, `SETUP-NUEVO-CLIENTE.md`) están en esta misma carpeta; no hace falta que los leas, solo que me digas que los lea.

**Símbolos:** 👤 lo hacés vos · 🤖 lo hago yo · 🛑 parada: me detengo y esperás a confirmar.

---

## Resumen en una pantalla

| # | Etapa | Quién | Tiempo aprox. |
|---|---|---|---|
| A | Reunión, ficha del cliente, presupuesto y materiales | 👤 | 1 a 3 días (depende del cliente) |
| 1 | Repositorio nuevo desde la plantilla | 👤 | 5 min |
| 2 | Proyecto de Supabase nuevo | 👤 | 15 min |
| 3 | Sesión conmigo: preparación técnica | 🤖 + 👤 | 1 hora |
| 4 | Diseño a medida de las pantallas públicas | 🤖 + 👤 | de 1 a varios días de trabajo, según el nivel |
| 5 | Carga del contenido (productos, fotos) | 👤 (o yo con tu planilla) | según el catálogo |
| 6 | Pruebas, entrega y cobro | 🤖 + 👤 | medio día |

---

# PARTE A — Antes de arrancar

## A1. Qué le tenés que dejar claro al cliente
- **El demo muestra funcionamiento, no estilo.** Su sitio va a tener su identidad.
- **Qué incluye el plan** y qué es extra. Te propongo tres niveles para presupuestar:
  1. **Marca:** sus colores, su logo, sus tipografías y sus textos sobre la estructura del demo. Es lo más rápido.
  2. **Estilo propio:** además, fondos, formas, animaciones, otro aspecto de tarjetas y botones, sin cambiar la estructura.
  3. **A medida:** estructura y diseño distintos (otro home, otro catálogo, secciones nuevas). Es el trabajo de diseño completo.
- **Qué NO está incluido sin acordarlo antes:** pagos online, envíos calculados automáticamente, facturación, otros idiomas, chat en vivo, analíticas, videos de fondo. Algunas son posibles pero se cotizan aparte (ver "Después de la entrega" al final).
- **Cantidad de rondas de cambios** incluidas (por ejemplo, 2). Sin eso, una reunión se convierte en cambios infinitos.

## A2. La ficha del cliente (completala con él, antes de arrancar)
Copiá esto en una nota y completalo. Es también lo que me vas a pegar después.

```
FICHA DEL CLIENTE

NEGOCIO
- Nombre de la tienda:
- Rubro y qué vende (2 líneas):
- Texto "Sobre nosotros" (su historia, cómo lo cuenta él):
- WhatsApp donde quiere recibir pedidos (con código de país, solo números. Ej: 5491155556666):
- Instagram (usuario):
- Email de contacto:
- Cómo entrega: envíos (a dónde, cuánto tarda, quién paga) / retiro (dirección y horarios):
- Cómo cobra (transferencia, efectivo, etc.; por ahora el pago se coordina por WhatsApp):
- Prefijo para los códigos de pedido (2 a 4 letras. Ej: "SG" → SG-00001):

MARCA
- Logo (archivo SVG si existe; si no, PNG grande con fondo transparente):
- Colores (en código hexadecimal, ej #B8553B): principal / secundario / fondo / texto:
- Tipografías (nombre exacto) y si tiene licencia para web:
- 3 sitios web que le gusten (links) y qué le gusta de cada uno:
- 3 palabras que describan la marca (ej: "cálida, artesanal, simple"):
- Cosas que NO quiere (colores, estilos):

CATÁLOGO
- Cantidad aproximada de productos:
- Categorías:
- Planilla de productos (nombre, categoría, precio, descripción corta y larga,
  variantes tipo talle/color con su stock, stock si no tiene variantes):
- Fotos (de preferencia cuadradas, con buena luz; mínimo 1000 px de lado):

TÉCNICO Y CUENTAS
- Dominio propio (¿ya lo tiene? ¿dónde está registrado?):
- Email para crear las cuentas (Supabase y Cloudflare):
- ¿Quién paga lo que sea pago en el futuro? (ver "Costos" más abajo)

ADMINISTRACIÓN
- Email de la persona que va a usar el panel (será la administradora):
- ¿Quiere que los clientes confirmen su email al registrarse? (ver "Después de la entrega")
```

## A3. Costos que tenés que tener en cuenta
- **GitHub y Cloudflare Pages:** gratis, sin límite razonable de proyectos.
- **Supabase plan Free:** permite **2 proyectos activos por organización**. Tu demo ocupa uno. Para el segundo cliente en adelante necesitás: (a) que **cada cliente cree su propia cuenta de Supabase** con su email y te invite como miembro (lo más prolijo: los datos y la factura son suyos), o (b) pasar a un plan pago.
- **El plan Free pausa los proyectos** sin actividad (~1 semana) y **no hace backups**. Para un cliente que ya vende, conviene el plan Pro (unos USD 25/mes) o resolver el "keepalive" y los backups (ver al final).
- **Dominio propio:** lo paga el cliente (aprox. 15 a 30 USD por año para `.com.ar`/`.com`).

---

# PARTE B — Tu paso a paso

## Paso 1 👤 — Repositorio nuevo (5 min)
1. Entrá a tu repo `catalogo-base` en GitHub → botón verde **Use this template → Create a new repository**.
2. **Repository name:** `catalogo-<nombre-del-cliente>` (ej. `catalogo-casa-luna`). **Visibilidad: Private**. Tocá **Create repository**.
3. Anotá el nombre completo (`RomeroMartin/catalogo-casa-luna`).
4. ✅ Verificá que la app de Claude tenga acceso a ese repo nuevo (GitHub → Settings → Applications → Claude → Repository access). Si no, agregalo; sin eso no puedo trabajar en él.

## Paso 2 👤 — Proyecto de Supabase del cliente (15 min)
Lo ideal: **que el cliente cree su cuenta** (supabase.com → Sign in with GitHub o email) y te agregue a su organización (Organization → Team → Invite).
1. **New project:** nombre `<cliente>-catalogo`. **Database password → Generate a password**, guardala en tu gestor de contraseñas. **No me la pases.**
2. **Region: South America (São Paulo).** Plan **Free** (o Pro, según lo acordado).
3. Esperá a que esté activo (punto verde).
4. **Project Settings → API:** copiá la **Project URL** y la **Publishable key** (`sb_publishable_…`). Esas dos me las pasás. **Nunca** la `service_role` / "secret key".

## Paso 3 🤖 + 👤 — Sesión conmigo: preparación técnica (1 hora)

### 3.1 Cómo abrir la sesión
1. Entrá a **claude.ai/code** → sesión nueva → elegí el **repo del cliente** (el del paso 1).
2. Si querés que pueda probar cosas contra Supabase desde la sesión, en la configuración del entorno agregá a la lista de dominios permitidos: `*.supabase.co`, `cdn.jsdelivr.net`. (No es obligatorio: puedo trabajar igual y vos probás en la web.)
3. Pegá este mensaje (completando lo que está entre `<>`):

> **MENSAJE DE ARRANQUE**
> ```
> Cliente nuevo. Leé docs/GUIA-TECNICA-CORE.md, docs/SETUP-NUEVO-CLIENTE.md y docs/PROGRESO.md.
> Este repo es el sitio de <NOMBRE DEL CLIENTE>, creado desde la plantilla catalogo-base.
> Nivel de personalización acordado: <1 Marca / 2 Estilo propio / 3 A medida>.
>
> Datos del proyecto de Supabase:
> - Project URL: <https://xxxx.supabase.co>
> - Publishable key: <sb_publishable_...>
>
> Mi ficha de cliente: (pegar la ficha completa de A2)
>
> Empezá por la preparación técnica (SETUP-NUEVO-CLIENTE.md, secciones 3 a 6) y decime qué tengo que hacer yo.
> Al cerrar cada etapa mergeá vos el PR a main. Preguntame solo si algo es ambiguo.
> ```

### 3.2 Qué hago yo 🤖
- Ajusto `js/site.config.js` (URL, clave, `demo: false`, crédito), pongo el nombre, colores y logo básicos, limpio los metas de SEO marcados `CLIENTE`, preparo el SQL de datos iniciales y dejo todo en un PR.
- Corro la verificación automática del sitio (`node tests/verificar-sitio.mjs --cliente`).
- Te digo exactamente qué pegar y dónde, paso a paso.

### 3.3 Qué hacés vos 👤 (cuando te lo pida)
1. **SQL Editor de Supabase del cliente:** pegar y ejecutar `supabase/schema.sql` (confirmar el aviso de "destructive operation": la base está vacía). **No** correr `seed.sql` (es del demo).
2. Ejecutar el SQL de la configuración inicial que te voy a dar (nombre, WhatsApp, prefijo).
3. **Authentication → Providers → Email:** *Confirm email* desactivado al principio; largo mínimo de contraseña **8**.
4. **Authentication → Users → Add user → Create new user** con el email de la administradora (marcar *Auto Confirm User*), y ejecutar el SQL que te doy para hacerla administradora.
5. Correr `supabase/tests/rls_tests.sql` → tiene que aparecer en rojo **"TODOS LOS TESTS OK (36/36)"**. Si no dice eso, **no seguimos**: me pegás el mensaje.

### 3.4 Cloudflare Pages 👤
1. dash.cloudflare.com → **Workers & Pages → Create application** → buscá el enlace chico **"Looking to deploy Pages? Get started"** → **Connect to Git** (**Pages, no Workers**).
2. Elegí el repo del cliente · *Production branch* `main` · *Framework preset* **None** · *Build command* vacío · *Build output directory* `/` (o `.`). **Save and Deploy**.
3. Pasame la URL (`https://<nombre>.pages.dev`).
4. **Supabase → Authentication → URL Configuration:** *Site URL* = esa URL; *Redirect URLs*: `https://<nombre>.pages.dev/**` y `https://*.<nombre>.pages.dev/**`.
5. 🤖 Yo actualizo el dominio en `sitemap.xml`, `robots.txt` y los metas, y mergeo.

🛑 **PARADA:** abrís el sitio de Pages, entrás al panel `/admin/` con la cuenta de la administradora y confirmás que carga sin errores. Recién ahí pasamos al diseño.

## Paso 4 🤖 + 👤 — Diseño a medida

### 4.1 Cómo pasarme el material
- **Logo:** adjuntalo en el mensaje (SVG mejor que PNG) o subilo al repo en `assets/` y decime el nombre.
- **Colores:** en hexadecimal (`#RRGGBB`). Si el cliente solo te dio el logo, decímelo y los saco del logo.
- **Referencias:** capturas de pantalla de los sitios que le gustan, **con una nota de qué te gusta de cada una** ("el header", "cómo se ven las tarjetas", "la tipografía").
- **Diseños hechos por vos (Figma, etc.):** exportalos como imágenes o PDF y adjuntalos. Indicame medidas, colores y tipografías.
- **Tipografías:** el nombre exacto y los archivos `.woff2` (si tienen licencia web). Sin archivos, te propongo alternativas libres parecidas.

### 4.2 Mensajes listos según el nivel

**Nivel 1 — Marca**
```
Aplicá la marca del cliente (nivel 1). Colores: principal #XXXXXX, secundario #XXXXXX, fondo #XXXXXX, texto #XXXXXX.
Tipografías: <nombre títulos> y <nombre texto>. Logo adjunto. 
Actualizá theme.css, el logo en el header, el favicon, la imagen para compartir y los metas CLIENTE.
Verificá contraste AA, corré la verificación y mostrame capturas del home, catálogo, carrito y cuenta (celular y PC).
```

**Nivel 2 — Estilo propio**
```
Nivel 2. Trabajá en css/cliente.css (sin tocar HTML ni JS). Quiero: <descripción: fondos, bordes redondeados, sombras, hover de tarjetas, animación de entrada, etc.>.
Referencias adjuntas: <qué te gusta de cada una>. Respetá prefers-reduced-motion. Mostrame capturas antes de seguir.
```

**Nivel 3 — A medida**
```
Nivel 3. Diseño a medida de las pantallas públicas. Mantené el motor intacto (js/lib/) y los enganches de GUIA-TECNICA-CORE.md §6 (o decime cuáles cambian y por qué).
Estructura que quiero:
- Home: <secciones en orden: hero con..., categorías como..., destacados..., etc.>
- Catálogo: <cómo se ven las tarjetas, filtros, modal de producto>
- Header/footer: <descripción>
Diseño/referencias adjuntos. Empezá por el home y mostrame una captura antes de hacer las otras pantallas.
```

### 4.3 Cómo pedir cambios (así avanzamos rápido)
- **Mostrame con capturas:** "Hacé capturas del home en celular y PC y mostramelas". Yo las genero y las reviso antes de decirte que está listo.
- **Pedí los cambios en tandas, con capturas tuyas:** una captura por cosa y una frase ("este botón se ve chico", "falta aire entre estas dos secciones"). Mejor 5 cambios juntos que uno por mensaje.
- **Usá referencias concretas:** "como en la captura 2, pero con nuestro verde" funciona mucho mejor que "más moderno".
- **Si no te gusta algo, decime por qué.** Sirve para no repetir el error.
- **Tu "OK"** de cada etapa es lo que me autoriza a seguir y a mergear.

### 4.4 Lo que te voy a frenar o consultar ⛔
Si el diseño pide algo de esta lista, **no lo hago sin avisarte** porque puede afectar la seguridad o el rendimiento:
- Recursos externos: Google Fonts, videos de YouTube/Vimeo, Instagram embebido, chat, analíticas, mapas (la política de seguridad los bloquea). Alternativas: tipografías y videos propios, o abrir una excepción puntual y deliberada.
- Cambiar la estructura del carrito, del pedido o de las cuentas.
- Videos o imágenes muy pesados (bajan el puntaje de velocidad).
- Fondos oscuros (el sistema está pensado para fondos claros; se puede, pero es un trabajo mayor).

## Paso 5 — Carga del contenido
- **Opción A 👤:** el cliente (o vos) carga todo desde el panel `/admin/` siguiendo `docs/MANUAL-ADMIN.md`. Sirve para pocos productos.
- **Opción B 🤖:** con muchos productos, **pasame la planilla** (Excel o Google Sheets exportado) y te armo el SQL para pegar en Supabase de una sola vez. Las fotos se suben desde el panel (se comprimen solas).

```
Te paso la planilla de productos del cliente (adjunta). Generame el SQL para cargar las categorías y los productos
con sus modelos y stock, listo para pegar en el SQL Editor. Avisame si algún dato está incompleto o ambiguo antes de generarlo.
```
- **Configuración de la tienda** (textos, WhatsApp, envíos): desde el panel → Configuración.

## Paso 6 🤖 + 👤 — Pruebas, entrega y cobro

### 6.1 Verificación mía 🤖
```
Corré la verificación completa para entregar: node tests/verificar-sitio.mjs --cliente, accesibilidad, política de seguridad y los flujos principales.
Decime qué resultó y qué falta que pruebe yo a mano.
```

### 6.2 Tus pruebas 👤 (en **PC, Android e iPhone**)
- [ ] Registro, login, cerrar sesión y recuperar contraseña (el mail llega).
- [ ] Catálogo: filtros, búsqueda, modal con modelos, fotos.
- [ ] Carrito como invitado y con cuenta; la fusión al ingresar.
- [ ] Pedido completo: se guarda, abre WhatsApp, aparece en "Mis pedidos" y en el panel.
- [ ] Panel: productos con fotos, stock, cambio de estado (y que el stock se mueva), categorías, configuración, Excel.
- [ ] **Lighthouse móvil** en https://pagespeed.web.dev/ sobre el catálogo: 90 o más en las cuatro categorías (pasame los números si alguno da menos).
- [ ] `supabase/tests/rls_tests.sql` otra vez: **36/36 OK**.
- [ ] En Supabase: *Site URL* y *Redirect URLs* apuntan a la dirección **final** (si tiene dominio propio, también).

### 6.3 Entrega 👤
1. Dominio propio (si lo tiene): Cloudflare Pages → tu proyecto → *Custom domains*; después sumá el dominio nuevo a las *Redirect URLs* de Supabase y cambiá la *Site URL*. Pedime los cambios de `sitemap.xml`, `robots.txt` y metas.
2. Entregá al cliente: la dirección del sitio, la del panel (`/admin/`), el usuario de la administradora y **`docs/MANUAL-ADMIN.md`** (te lo puedo adaptar con el nombre de su tienda o exportar a PDF si lo querés).
3. Ella cambia su contraseña con "Olvidé mi contraseña" si se la dejaste provisoria.
4. **Guardá en tu gestor de contraseñas:** acceso a Supabase y Cloudflare del proyecto, y la contraseña de la base.
5. Cobro y cierre según lo acordado.

---

# PARTE C — Cuando algo sale mal (lo que ya nos pasó)

| Síntoma | Qué hacer |
|---|---|
| Cloudflare dice *"Could not detect a directory containing static files"* o ejecuta `npx wrangler deploy` | Se creó un proyecto de **Workers**. Borralo y creá uno de **Pages** por el enlace chico "Looking to deploy Pages?". Además, `main` tiene que tener los archivos (mergear el PR). |
| Cambié algo en el panel (por ejemplo una categoría) y no aparece en la tienda | Es la **caché de 5 minutos**. Esperá o abrí una ventana de incógnito. |
| Olvidé la contraseña y el email no llega | El correo por defecto de Supabase es muy limitado y solo envía a miembros del equipo. Probalo con tu email. Para el cliente real hay que configurar email propio (ver abajo). |
| El registro o el login no funciona en la URL de Pages | Revisá *Site URL* y *Redirect URLs* en Supabase (con `/**` al final, y la versión `*.` para las previews). |
| Al registrarse da error de límite de emails | Supabase limita los envíos; activar el email propio o dejar "Confirm email" desactivado. |
| La consola muestra errores de `contentscript.js`, `ObjectMultiplex`, etc. | Son extensiones de tu navegador (billeteras, etc.). Probá en una ventana de incógnito. |
| Las fotos no suben | Probar con otra foto o en JPG/PNG. Si el celular usa un formato raro, una captura de pantalla de la foto sirve. |
| Lighthouse da menos de 90 en Rendimiento | Pasame FCP, LCP, TBT y CLS y las capturas de "Oportunidades". Casi siempre es una imagen o una fuente pesada. |
| Quiero ver cómo anda sin esperar el deploy | Cada rama o PR genera una URL de vista previa en Cloudflare Pages. |
| No sé en qué estado quedó un trabajo | Pedime: "Leé docs/PROGRESO.md y decime en qué etapa estamos". |

---

# DESPUÉS DE LA ENTREGA (cuando el cliente ya vende)
Cada ítem se cotiza o se agenda aparte. Está detallado para mí en `docs/SETUP-NUEVO-CLIENTE.md` ("Después de la entrega"):
1. **Email propio (SMTP)** con el dominio del cliente (Resend o Brevo), plantillas en español y decidir si exige confirmar el email.
2. **Que el proyecto no se pause** (tarea diaria de "keepalive") y **backups** (plan Pro de Supabase o copias periódicas).
3. **Dominio propio** (si no se hizo antes).
4. **Pagos online (Mercado Pago):** requiere funciones de servidor; es un proyecto aparte.
5. **Mejoras de producto:** cupones, envío calculado, paginación si supera ~500 productos.
6. **Actualizar el motor** de un cliente ya publicado (ver abajo).

## Cómo pedirme una mejora del motor para un cliente ya entregado
```
Cliente <nombre> (repo <repo>). Leé docs/GUIA-TECNICA-CORE.md y docs/CHANGELOG-MOTOR.md del repo catalogo-base (el demo).
Quiero traer al sitio de este cliente las mejoras del motor desde la versión <X> hasta la <Y>, sin tocar su diseño.
Decime qué cambia en js/lib/ y en supabase/ (y si hay que correr SQL en su Supabase) antes de aplicarlo.
```

---

# Mensajes cortos útiles (para copiar)

- **Retomar un trabajo:** `Seguimos con <cliente>. Leé docs/PROGRESO.md y decime dónde quedamos.`
- **Que mergee:** `Si está todo bien, mergeá el PR a main.`
- **Pedir capturas:** `Mostrame capturas del home y del catálogo en celular y PC.`
- **Pedir un resumen para el cliente:** `Armame un resumen en lenguaje simple de lo que hicimos, para enviárselo al cliente.`
- **Antes de entregar:** `Corré la verificación completa para entregar y decime qué tengo que probar yo a mano.`
- **Algo se rompió:** pegá el mensaje de error de la consola (F12 → Console) o una captura, y decime qué hiciste justo antes.

---

*Documento general de Martin Romero Studio. Versión del motor al escribirlo: 1.0.*
