# catalogo-base

Plantilla de catálogo web con cuentas de cliente, carrito, pedidos por WhatsApp y panel de administración.
100% frontend (HTML + CSS + JavaScript con módulos ES, sin build) sobre Supabase (Postgres + Auth + Storage). Hosting: Cloudflare Pages.

> Estado del proyecto: ver [`docs/PROGRESO.md`](docs/PROGRESO.md). El plan completo está en [`docs/PLAN.md`](docs/PLAN.md).

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

## Seguridad
En el sitio solo van la URL y la clave **publishable/anon** de Supabase (públicas por diseño). La clave `service_role` no se usa nunca en este proyecto.
La seguridad real está en las políticas RLS del esquema; se verifican corriendo `supabase/tests/rls_tests.sql` en el SQL Editor de Supabase.
