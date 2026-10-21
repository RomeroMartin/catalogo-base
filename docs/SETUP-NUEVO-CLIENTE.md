# Checklist: montar un catálogo nuevo para un cliente

Para Martin. Cada cliente = **su propio repo** + **su propio proyecto de Supabase** + **su propio sitio en Cloudflare Pages**. Tiempo estimado: 1 a 2 horas sin contar la carga de productos.

> **Qué es demo y qué es plantilla:** `supabase/seed.sql` y `docs/styleguide.html` son solo del **demo "Casa Nube"**: en un cliente nuevo **no se usan** (el seed se reemplaza por el paso 4). Todo lo demás es la plantilla. El plan completo está en `docs/PLAN.md`.

Marcá cada casilla a medida que avanzás.

## 1. Repositorio
- [ ] En GitHub, abrí el repo `catalogo-base` → **Use this template → Create a new repository**. Nombre: `catalogo-<cliente>`. Visibilidad **Private**.
- [ ] (Una sola vez, en `catalogo-base`) Verificá que esté tildado **Settings → General → Template repository**.

## 2. Proyecto Supabase
- [ ] https://supabase.com → **New project** (en la organización del cliente o en la tuya). Nombre `<cliente>-catalogo`, región **South America (São Paulo)**, plan Free (o Pro si factura bastante, ver "Después de la entrega").
- [ ] En **Generate a password**: copiala a tu gestor de contraseñas. **No** la compartas.
- [ ] **Project Settings → API**: anotá **Project URL** y **Publishable key** (`sb_publishable_…`). **Nunca** uses ni copies la `service_role` / secret key.

## 3. Base de datos
- [ ] **SQL Editor → New query** → pegá **todo** `supabase/schema.sql` → **Run** (confirmá el aviso de "destructive operation": la base está vacía). Debe decir *Success. No rows returned*.
- [ ] **NO** corras `seed.sql` (es del demo).
- [ ] Verificá en **Table Editor** que hay 9 tablas con *RLS enabled*, y en **Storage** el bucket `productos` como *Public*.

## 4. Datos iniciales de la tienda (en lugar del seed)
- [ ] En el **SQL Editor**, corré esto cambiando los valores (el WhatsApp va **solo con números y código de país**):
  ```sql
  insert into public.config (id, nombre_tienda, whatsapp, prefijo_pedido)
  values (1, 'NOMBRE DEL CLIENTE', '5491100000000', 'XX')
  on conflict (id) do nothing;
  ```
  El resto (eslogan, textos de portada, Instagram, envíos…) lo completa el cliente o vos desde el panel → **Configuración**.

## 5. Autenticación
- [ ] **Authentication → Providers → Email**: proveedor activado. *Confirm email*: **desactivado** para empezar (el registro entra directo). Si el cliente lo quiere activado, primero hay que configurar el email propio (ver "Después de la entrega").
- [ ] Largo mínimo de contraseña: **8**.
- [ ] **Authentication → Users → Add user → Create new user** con el email de la dueña y una contraseña fuerte; marcá **Auto Confirm User**.
- [ ] Hacela administradora (cambiá el email):
  ```sql
  insert into public.admins (user_id)
  select id from auth.users where email = 'EMAIL-DE-LA-DUENA@EJEMPLO.COM';
  ```
  Debe decir *1 row affected*.
- [ ] (Recomendado) Creá también tu propio usuario admin para soporte.

## 6. Personalizar el código (en el repo nuevo)
- [ ] `js/site.config.js`: `supabaseUrl`, `supabaseAnonKey`, **`demo: false`** (apaga el cartel "Demo funcional") y, si usa formulario de contacto, `formspreeId`. Revisá `credito` (el texto del pie; dejalo vacío si no corresponde) y `carritoKey` (podés dejarla).
- [ ] `css/theme.css`: colores y tipografías del cliente. Las tipografías están **autoalojadas** (`assets/fonts/*.woff2`, subconjunto latino): para cambiarlas, reemplazá los archivos, ajustá los `@font-face` y las variables `--font-*` de `theme.css`, y actualizá los `<link rel="preload">` de `index.html`, `catalogo.html`, `cuenta.html` y `admin/index.html` (están marcados con `<!-- CLIENTE -->`). Si preferís Google Fonts, agregá su `<link>` a los 4 HTML y sumá `https://fonts.googleapis.com` a `style-src` y `https://fonts.gstatic.com` a `font-src` en `_headers`. Mantené el contraste suficiente entre texto y fondo.
- [ ] `assets/`: reemplazá `favicon.svg` y `og-image.png` (imagen para compartir, 1200×630).
- [ ] Buscá `CLIENTE` en todo el proyecto y resolvé cada marca. En general:
  - Metas SEO, `og:title`, `og:image`, JSON-LD (nombre, dirección, teléfono) y `theme-color` en los 4 HTML (`theme-color` = `--color-bg`).
  - La preconexión a Supabase (`<link rel="preconnect" href="https://<ref>.supabase.co">`) en los 4 HTML: poné la URL del proyecto del cliente.
  - `sitemap.xml` y `robots.txt`: poné el dominio real.
- [ ] Probá en local (ver `README.md`): `python3 -m http.server 8080`.

## 7. Publicación (Cloudflare Pages)
- [ ] https://dash.cloudflare.com → **Workers & Pages → Create application → enlace "Looking to deploy Pages? Get started" → Connect to Git** (**Pages**, no Workers).
- [ ] Repo del cliente · *Production branch* `main` · *Framework preset* **None** · *Build command* vacío · *Build output directory* `/` (o `.`). **Save and Deploy**.
- [ ] Anotá la URL (`https://<nombre>.pages.dev`).
- [ ] **Supabase → Authentication → URL Configuration**: *Site URL* = la URL de Pages. *Redirect URLs*: `https://<nombre>.pages.dev/**` y `https://*.<nombre>.pages.dev/**` (cubre las previews).
- [ ] Actualizá el dominio en `sitemap.xml`, `robots.txt` y los metas `og:` si todavía tienen el de ejemplo.
- [ ] (Opcional) Dominio propio: Cloudflare Pages → *Custom domains*. Después sumá el dominio nuevo a las *Redirect URLs* de Supabase y cambiá la *Site URL*.

## 8. Seguridad
- [ ] Corré la verificación automática: `cd tests && npm install && node verificar-sitio.mjs --cliente` (ver `tests/README.md`). Tiene que decir `✓ TODO OK`. Para diseños a medida, leé antes `docs/GUIA-TECNICA-CORE.md`.
- [ ] Corré `supabase/tests/rls_tests.sql` en el SQL Editor. **Resultado correcto: un recuadro rojo que dice `RESULTADO: TODOS LOS TESTS OK (36/36)`** (es un error a propósito para que no quede nada guardado). Si dice otra cosa, **no entregues**.
- [ ] Confirmá que no hay claves secretas en el repo: `git log -p | grep -i service_role` no debe mostrar claves (solo menciones en comentarios).
- [ ] (Opcional) **Authentication → Attack Protection**: activar CAPTCHA (Cloudflare Turnstile).

## 9. Cargar el contenido
- [ ] Entrá a `/admin/` con la cuenta admin.
- [ ] **Configuración**: nombre, textos, WhatsApp, Instagram, envíos, prefijo de pedidos.
- [ ] **Categorías**: creá las del rubro (nombre, emoji, color).
- [ ] **Productos**: cargá productos con fotos (o enseñale a la dueña con `docs/MANUAL-ADMIN.md`).

## 10. QA antes de entregar (PC, Android e iPhone)
- [ ] Registro, login, logout y recuperar contraseña (el mail llega).
- [ ] Catálogo: filtros, búsqueda, modal con modelos, carrusel.
- [ ] Carrito como invitado y logueado; pedido completo: se guarda, abre WhatsApp y aparece en *Mis pedidos* y en el panel.
- [ ] Panel: productos con fotos, stock, cambio de estado de pedidos (y que el stock se mueva), categorías, configuración, exportar a Excel.
- [ ] Con una cuenta común, `/admin/` no muestra nada y no se ven pedidos de otros.

## 11. Entrega
- [ ] Pasale a la dueña: la dirección del sitio, la del panel (`/admin/`), su usuario y `docs/MANUAL-ADMIN.md`. Que cambie su contraseña desde *Olvidé mi contraseña* si se la dejaste provisoria.
- [ ] Guardá en tu gestor de contraseñas: cuenta de Supabase del proyecto, contraseña de la base y acceso a Cloudflare.

---

## Después de la entrega (cuando el cliente ya vende)
Estas tareas **no** están en la plantilla base. Se hacen cuando hay un cliente real:

1. **Email propio (SMTP):** el servicio de email por defecto de Supabase solo envía a miembros del equipo y con límites muy bajos. Configurá Resend o Brevo con remitente del dominio del cliente (registros DNS), traducí las plantillas de Auth al español y decidí con el cliente si exige confirmar el email.
2. **Que el proyecto no se pause:** el plan Free pausa los proyectos con ~1 semana sin actividad. Opción: un Cloudflare Worker con *Cron Trigger* diario que haga `GET {url}/rest/v1/config?select=id&limit=1` con la clave pública. (No usar GitHub Actions programadas: GitHub las desactiva a los 60 días sin commits.)
3. **Backups:** el plan Free no incluye backups descargables. Para un cliente que factura conviene el plan Pro de Supabase (unos USD 25/mes) o un `pg_dump` periódico desde un entorno tuyo.
4. **Pagos online (Mercado Pago):** con Supabase Edge Functions; recalcular el total en el servidor, validar la firma del webhook y descontar stock en una transacción.
