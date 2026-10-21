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
| 9 Subir foto | ✅ | 2026-10-20 | Verificada por Martin (PC, Android, iPhone) |
| 10 Plantillización y docs | ✅ | 2026-10-20 | Verificada por Martin; repo marcado como plantilla |
| 11 Seguridad final y publicación | ✅ | 2026-10-21 | QA final de Martin (PC, Android, iPhone), tests RLS 36/36 y Lighthouse móvil 92 · 100 · 100 · 100 |

Estados: ⬜ pendiente · 🟨 en curso · ✅ hecha y verificada por Martin.

## Estado final
**Demo terminado el 2026-10-21.** Las 12 fases (0 a 11) están ✅ y verificadas por Martin. Lighthouse móvil sobre `catalogo.html`: Rendimiento 92 · Accesibilidad 100 · Prácticas recomendadas 100 · SEO 100.

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

## Fase 11 — resultados de la revisión (Claude)
- **CSP (`_headers`)**: se corrió todo el sitio (home, catálogo, modal, carrito, checkout, cuenta y las 7 pestañas del panel) con la CSP real aplicada. Cero violaciones de `script-src`, `style-src`, `font-src` ni `form-action`.
- **Seguridad del frontend**: sin `onclick` ni `eval`; las 51 inserciones de HTML se revisaron y todo dato de la base pasa por `esc()` (o es numérico/URL armada con dígitos); no hay claves `service_role`/secret en el repo (solo menciones en comentarios y docs). Corregido: el checkout ya no muestra mensajes internos de la base; solo los mensajes que escribió `crear_pedido` (P0001) o el aviso de sesión.
- **Accesibilidad**: axe-core (WCAG 2.1 A/AA + buenas prácticas) en 18 pantallas/estados, 0 violaciones tras corregir: títulos vacíos en el home, orden de encabezados en el catálogo, rol del drawer, navegación del panel, encabezados de tabla y h1 en login. Teclado: foco atrapado y devuelto en el drawer y el modal, Esc cierra, enlace "Saltar al contenido", foco visible (3 px) y `prefers-reduced-motion` respetado.
- **Rendimiento**: NO medido con Lighthouse (desde el entorno de Claude no se llega al sitio publicado). Revisión estática: fotos con `width`/`height`/`loading="lazy"`/`decoding="async"`, scripts como módulos (no bloquean), fuentes con `display=swap`. Martin: correr Lighthouse móvil sobre `catalogo.html` en producción (objetivo ≥ 90).
- Pendiente de Martin: QA final en PC / Android / iPhone, Site URL y Redirect URLs de Supabase apuntando a la URL final, y la prueba en producción.
- Lighthouse móvil (PageSpeed Insights) sobre `catalogo.html`, medido por Martin: Rendimiento 87 · Accesibilidad 100 · Prácticas recomendadas 100 · SEO 100. Ajustes aplicados para subir Rendimiento: primeras fotos con carga inmediata y prioridad, preconexión a Supabase/jsDelivr, precarga del cliente de Supabase, checkout cargado bajo demanda y un peso menos de Fraunces. Volver a medir.
- Rendimiento, 2.ª vuelta (informe de Martin: 86 · FCP 2,9 s · LCP 3,0 s · TBT 0 · CLS 0,11): causas = (1) hoja de Google Fonts bloqueando el render (750 ms) y 5 preconexiones; (2) CLS por el header y las categorías que el JS inserta después; (3) cadena de carga de módulos (HTML → JS → supabase-js y sus 8 sub-módulos → API a ~1,05 s). Aplicado: tipografías autoalojadas con precarga (+ CSP más estricta), espacio reservado para header y categorías, `modulepreload` de los 13 módulos de cada página y menos preconexiones. Pendiente de medir. Si no llega a 90, la siguiente palanca es autoalojar también supabase-js (decisión de Martin: se aparta del plan §3.2).
- Revisión de layout y enlaces (pedida por Martin tras el QA): (1) corregido un bug mío del home: `destacados.map(cardHTML)` pasaba el índice como nivel del título y mostraba `<0 class="card-title">` como texto; ahora `cardHTML` valida el nivel (solo h2/h3/h4). (2) Hero del home alineado con el resto del contenido. (3) `.section-head` (título + acción) estaba solo en home.css: se movió a base.css y arregla el encabezado del panel y de "Mi cuenta". (4) Enlaces sin estilo: nuevo `.link-more` ("Ver todo →", "Ver el catálogo", "Ver mis pedidos"), contactos del home como botones con ícono y "Panel" del header como botón. (5) Los avisos (toasts) pasaron arriba: abajo tapaban los botones de confirmar. (6) Opciones de entrega más compactas y miniatura del panel con emoji si falla la foto.
- Revisión de CSS por página (script que cruza las clases usadas por cada pantalla con los CSS que realmente carga): la única clase "huérfana" real era `.toolbar` (buscador + filtro), que estaba en `catalogo.css` y el panel no la carga; pasó a `base.css`. Además, las filas de pedidos (panel y "Mi cuenta") se alinean en columnas en pantallas anchas.
- Exportación a Excel (pedido de Martin): Pedidos y Clientes ya no exportan CSV sino `.xlsx` con una **tabla de Excel** (filtros por columna, filas alternadas, primera fila fija, anchos ajustados, dinero `$ #.##0` y fechas con formato). Se genera en el navegador con `js/lib/xlsx.js` (sin librerías ni build; ZIP + XML a mano). Validado con LibreOffice y openpyxl; NO probado en Microsoft Excel real (Martin: abrir un archivo exportado y confirmar que no pide "reparar").
- Bug del panel hallado por Martin (descargas repetidas): cada pestaña reutilizaba el mismo contenedor, así que los eventos de clic de las pestañas ya visitadas se acumulaban: una exportación disparaba 5 descargas (mezcladas de pedidos y clientes) y "Editar" de Productos abría varias ventanas (incluso la de "Nueva categoría"); también podían repetirse guardados de stock. Ahora cada pestaña se dibuja en un contenedor nuevo (`admin.js`). Los archivos exportados llevan fecha y hora (`pedidos_2026-10-21_1530.xlsx`, `clientes_…`) para no pisarse.

## Deuda conocida y próximos pasos (no bloquean el demo)
- Exportación a Excel (`js/lib/xlsx.js`): validada con LibreOffice y openpyxl; Martin la abrió en Excel real.
- Caché de categorías/config del sitio: 5 min por pestaña (`CACHE_MS` en `js/lib/store.js`); bajar a 1 min si molesta al editar desde el panel.
- Supabase Free: sin backups y el proyecto se pausa con ~1 semana sin actividad; antes de un cliente real, ver `docs/SETUP-NUEVO-CLIENTE.md` → "Después de la entrega" (email propio/SMTP, keepalive, backups, dominio propio, Mercado Pago).
- Posible mejora de rendimiento si hiciera falta: autoalojar `supabase-js` (se aparta de la regla §3.2 del plan; decisión de Martin).
- Idea opcional: exportar el Resumen (ventas por mes y más vendidos) a Excel, una hoja por reporte.
