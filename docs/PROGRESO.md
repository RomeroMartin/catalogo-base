# Progreso — catalogo-base

| Fase | Estado | Fecha | Notas / decisiones |
|---|---|---|---|
| 0 Preparación | ✅ | 2026-10-20 | Martin confirmó repo, Supabase y red |
| 1 Base de datos | ✅ | 2026-10-20 | Tests RLS 36/36 OK en Supabase real; admin creado |
| 2 Diseño visual | ✅ | 2026-10-20 | CSS y styleguide hechos; falta aprobación de Martin (Parada 2). Ajustes vs plan: --color-whatsapp #1A7F44 (contraste AA con texto blanco), --color-muted #6B625B, nuevo --color-warning |
| 3 Esqueleto y capa de datos | ✅ | 2026-10-20 | Desplegado en Cloudflare Pages; Martin verificó. CSP: se agregó cdn.jsdelivr.net a connect-src (sourcemaps) |
| 4 Autenticación | ✅ | 2026-10-20 | Verificada por Martin en Cloudflare |
| 5 Home y catálogo | ✅ | 2026-10-20 | Verificada por Martin. El botón Agregar es provisorio (aviso) hasta la Fase 6 |
| 6 Carrito y pedidos | ✅ | 2026-10-20 | Verificada por Martin, incluida la carrera de stock (el sitio ajusta cantidades y avisa; el servidor rechaza si hace falta) |
| 7 Cuenta del cliente | ✅ | 2026-10-20 | Verificada por Martin (incluye prueba cruzada entre usuarios) |
| 8 Panel de administración | ✅ | 2026-10-20 | Verificada por Martin |
| 9 Subir foto | 🟨 en curso | 2026-10-20 | image-upload.js + gestor de fotos en el formulario de producto; probado en Chromium con Storage simulado; falta prueba real de Martin desde PC, Android e iPhone (Parada 9) |
| 10 Plantillización y docs | ⬜ pendiente | | |
| 11 Seguridad final y publicación | ⬜ pendiente | | |

Estados: ⬜ pendiente · 🟨 en curso · ✅ hecha y verificada por Martin.

## Datos de entorno (sin secretos)
- Repo: RomeroMartin/catalogo-base · Proyecto Supabase (ref): pnxplpmyeozclhhpjfsq (URL base: https://pnxplpmyeozclhhpjfsq.supabase.co) · URL de Cloudflare Pages: https://catalogo-base.pages.dev/
- Entorno de Claude (2026-10-20): Node v22.22.0, Python 3.13.16
- Versión de supabase-js a fijar: **2.117.2** (publicada 2026-09-25). La última estable, 2.118.0 (2026-10-15), y la 2.117.3 (2026-10-07) tienen menos de 2 semanas.
- Red del entorno: `*.supabase.co`, `cdn.jsdelivr.net` y `fonts.googleapis.com` NO accesibles (proxy 403). Hay que habilitarlos para probar contra Supabase desde la sesión.

## Pendientes / bugs conocidos
- Habilitar dominios en la red del entorno (ver arriba).
- Pegar el plan completo en el repo ya está hecho en `docs/PLAN.md`; el repo no tenía README ni commits previos.
- La clave publishable de Supabase la tiene Martin; se escribe en `js/site.config.js` en la Fase 3 (pública por diseño, no va en este archivo).
- Siguiente: **Fase 6 (carrito y pedidos)**. Martin pausó la sesión después de la Parada 5. Acuerdo: Claude mergea los PR a `main` al cerrar cada fase y Martin prueba en Cloudflare.
- Corregido (hallado por Martin en la prueba cruzada de la Fase 7): el carrito de una cuenta podía verse al entrar con otra cuenta en el mismo navegador. Ahora el carrito guardado tiene dueño (`cb_cart_v1_owner`): el de otra cuenta se descarta y solo el de invitado se fusiona.
- Nota: la caché de categorías/config del sitio dura 5 min por pestaña (sessionStorage). Si molesta al editar desde el panel, bajarla a 1 min en `js/lib/store.js` (CACHE_MS).
