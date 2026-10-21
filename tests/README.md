# Verificación automática del sitio

Revisa, sin internet y sin tocar tu Supabase real, que el sitio sigue funcionando después de un cambio (sobre todo de diseño):

- los **enlaces del motor** (ids y atributos de los que depende el JavaScript) existen en cada página;
- no hay **errores de JavaScript** ni violaciones de la **política de seguridad** (CSP);
- no se ven **textos rotos** (`[object Object]`, `undefined`, `NaN`, etiquetas HTML sueltas) y el texto de la base **se escapa**;
- **accesibilidad** (axe-core, WCAG 2.1 A/AA) en las pantallas y estados principales;
- **flujos**: carrito con tope de stock, persistencia, pedido con sesión (qué se envía al servidor), rechazo del servidor, pedido como invitado por WhatsApp;
- **panel**: una acción = un efecto (sin descargas ni ventanas repetidas al cambiar de pestaña).

## Cómo correrla
Hace falta Node.js 20 o más y un Chromium (el de Playwright o el de Chrome).

```
cd tests
npm install                       # una sola vez
node verificar-sitio.mjs          # en el demo
node verificar-sitio.mjs --cliente   # en un sitio de cliente: además exige demo:false y otro proyecto de Supabase
```

Si Playwright no encuentra el navegador, indicá cuál usar: `CHROMIUM_PATH=/ruta/a/chrome node verificar-sitio.mjs`
(en la sesión de Claude Code: `CHROMIUM_PATH=/opt/pw-browsers/chromium`).

Termina con `✓ TODO OK` o con la lista de lo que falló y por qué (código de salida 1).

## Cuando cambia el diseño de un cliente
Si el rediseño **cambia a propósito** un id o una estructura, se actualiza la lista de enganches al principio de `verificar-sitio.mjs` (`COMUNES` y `POR_PAGINA`) y la sección "Contrato de enganches" de `docs/GUIA-TECNICA-CORE.md`. Lo que no se puede es cambiarlos sin querer.

## Qué NO reemplaza
No prueba el Supabase real (usa `stub-supabase.mjs`), ni Safari/iPhone, ni el envío de emails, ni Lighthouse. Esas pruebas se hacen a mano (ver la guía técnica, §10).
