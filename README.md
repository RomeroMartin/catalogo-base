# catalogo-base

Plantilla de catálogo web con cuentas de cliente, carrito, pedidos por WhatsApp y panel de administración.
100% frontend (HTML + CSS + JavaScript con módulos ES, sin build) sobre Supabase (Postgres + Auth + Storage). Hosting: Cloudflare Pages.

> Estado del proyecto: ver [`docs/PROGRESO.md`](docs/PROGRESO.md). El plan completo está en [`docs/PLAN.md`](docs/PLAN.md).

## Cómo está organizado: motor, panel y sitio
- **Motor** (`js/lib/`, `supabase/`): carrito, pedidos, cuentas, base de datos y seguridad. Igual para todos los clientes.
- **Panel** (`admin/`, `js/pages/admin/`): igual para todos; solo cambian colores y logo.
- **Sitio público** (`index.html`, `catalogo.html`, `cuenta.html`, `js/pages/`, `js/components/`, `css/`): se diseña a medida por cliente usando el motor.
- Guía para quien programa: [`docs/GUIA-TECNICA-CORE.md`](docs/GUIA-TECNICA-CORE.md). Verificación automática: [`tests/README.md`](tests/README.md).

## ¿Qué es demo y qué es plantilla?
- **Plantilla (lo que se reutiliza):** todo el código (`index.html`, `catalogo.html`, `cuenta.html`, `admin/`, `css/`, `js/`), `supabase/schema.sql`, `supabase/tests/rls_tests.sql` y `docs/MANUAL-ADMIN.md`.
- **Solo del demo "Casa Nube":** `supabase/seed.sql` (datos ficticios), `supabase/diagnostico-demo.sql` y `supabase/reiniciar-demo.sql` (dejan el demo como nuevo; **nunca** en un cliente) y `docs/styleguide.html` (guía visual). En un cliente nuevo no se usan.
- **Para montar un cliente nuevo:** seguí [`docs/SETUP-NUEVO-CLIENTE.md`](docs/SETUP-NUEVO-CLIENTE.md). Todo lo que hay que cambiar está marcado con `CLIENTE` en el código (buscalo con `grep -rn CLIENTE .`).
- **Para la dueña del negocio:** [`docs/MANUAL-ADMIN.md`](docs/MANUAL-ADMIN.md).
- **Para Martin (del "sí" del cliente a la entrega):** [`docs/GUIA-NUEVO-CLIENTE-MARTIN.md`](docs/GUIA-NUEVO-CLIENTE-MARTIN.md).

## Correrlo en local
Los módulos ES no funcionan abriendo el archivo con doble clic; hace falta un servidor local:

```
python3 -m http.server 8080
```

Después abrí http://localhost:8080

## Estructura
- `index.html`, `catalogo.html`, `cuenta.html`, `admin/index.html` — páginas.
- `css/theme.css` — colores y tipografías (lo único que cambia por cliente en estilos).
- `js/site.config.js` — URL y clave pública de Supabase (lo único que cambia por cliente en JS).
- `js/lib/`, `js/components/`, `js/pages/` — código de la aplicación.
- `supabase/` — `schema.sql`, `seed.sql` (solo demo) y `tests/rls_tests.sql`.
- `docs/` — plan, progreso y documentación.

## Desplegar
Cloudflare Pages conectado al repo: *Production branch* `main`, sin comando de build y con salida `/`. Cada rama o PR genera una URL de preview. Detalle en `docs/SETUP-NUEVO-CLIENTE.md`. Las cabeceras de seguridad (CSP incluida) están en `_headers`.

## Tests de seguridad (RLS)
En el **SQL Editor** de Supabase, pegá y ejecutá `supabase/tests/rls_tests.sql`. El resultado correcto es un recuadro **rojo** con `RESULTADO: TODOS LOS TESTS OK (36/36)`: es un error a propósito, así el script se deshace solo y no deja datos de prueba.

## Seguridad
En el sitio solo van la URL y la clave **publishable/anon** de Supabase (públicas por diseño). La clave `service_role` no se usa nunca en este proyecto.
La seguridad real está en las políticas RLS del esquema; se verifican corriendo `supabase/tests/rls_tests.sql` en el SQL Editor de Supabase.
