# Progreso — catalogo-base

| Fase | Estado | Fecha | Notas / decisiones |
|---|---|---|---|
| 0 Preparación | ✅ | 2026-10-20 | Martin confirmó repo, Supabase y red |
| 1 Base de datos | ✅ | 2026-10-20 | Tests RLS 36/36 OK en Supabase real; admin creado |
| 2 Diseño visual | ✅ | 2026-10-20 | CSS y styleguide hechos; falta aprobación de Martin (Parada 2). Ajustes vs plan: --color-whatsapp #1A7F44 (contraste AA con texto blanco), --color-muted #6B625B, nuevo --color-warning |
| 3 Esqueleto y capa de datos | ✅ | 2026-10-20 | Desplegado en Cloudflare Pages; Martin verificó. CSP: se agregó cdn.jsdelivr.net a connect-src (sourcemaps) |
| 4 Autenticación | 🟨 en curso | 2026-10-20 | cuenta.js: registro, login, olvidé contraseña, nueva contraseña, header; falta prueba real de Martin (Parada 4) |
| 5 Home y catálogo | ⬜ pendiente | | |
| 6 Carrito y pedidos | ⬜ pendiente | | |
| 7 Cuenta del cliente | ⬜ pendiente | | |
| 8 Panel de administración | ⬜ pendiente | | |
| 9 Subir foto | ⬜ pendiente | | |
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
