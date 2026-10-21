// Verificación automática del sitio. Se corre después de CUALQUIER cambio (sobre todo de diseño):
//
//   cd tests && npm install        (una sola vez)
//   node verificar-sitio.mjs       (en un sitio de cliente: node verificar-sitio.mjs --cliente)
//
// No usa internet ni tu Supabase real: levanta el sitio en local con las MISMAS cabeceras de seguridad que
// Cloudflare (_headers), reemplaza la librería de Supabase por tests/stub-supabase.mjs y revisa:
//   1. Enlaces del motor: que existan los ids y atributos de los que depende el JavaScript.
//   2. Que no haya errores de JavaScript ni violaciones de la política de seguridad (CSP).
//   3. Que no se vean textos rotos ([object Object], undefined, NaN, etiquetas HTML sueltas) y que el texto
//      de la base se escape (un producto con nombre hostil no puede ejecutar código).
//   4. Accesibilidad (axe-core, WCAG 2.1 A/AA) en las pantallas y estados principales.
//   5. Flujos: agregar al carrito con tope de stock, carrito persistente, pedido logueado (qué se envía al
//      servidor), error del servidor, pedido como invitado por WhatsApp.
//   6. Panel: una acción = un efecto (sin descargas ni ventanas repetidas al cambiar de pestaña).
// Termina con código 1 si algo falla.

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const MODO_CLIENTE = process.argv.includes('--cliente');
const STUB = fs.readFileSync(path.join(AQUI, 'stub-supabase.mjs'), 'utf8');
const AXE = fs.readFileSync(path.join(AQUI, 'node_modules/axe-core/axe.min.js'), 'utf8');
const NOMBRE_HOSTIL = 'XSS-PRUEBA <img src=x onerror=window.__xss=1>';

// ── Servidor local con las cabeceras reales de _headers ──
const cabeceras = [];
for (const linea of fs.readFileSync(path.join(RAIZ, '_headers'), 'utf8').split('\n')) {
  const t = linea.trim();
  if (t && !t.startsWith('/') && t.includes(':')) { const i = t.indexOf(':'); cabeceras.push([t.slice(0, i).trim(), t.slice(i + 1).trim()]); }
}
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json' };
const servidor = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  for (const [k, v] of cabeceras) res.setHeader(k, v);
  if (url.startsWith('/__img/')) { res.setHeader('Content-Type', 'image/svg+xml'); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#d9c9b8"/></svg>'); }
  let archivo = path.join(RAIZ, url.endsWith('/') ? url + 'index.html' : url);
  if (!archivo.startsWith(RAIZ) || archivo.includes(`${path.sep}tests${path.sep}`) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.statusCode = 404; return res.end('no encontrado'); }
  res.setHeader('Content-Type', MIME[path.extname(archivo)] || 'application/octet-stream');
  fs.createReadStream(archivo).pipe(res);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${servidor.address().port}/`;

// ── Resultados ──
let fallos = 0, total = 0;
const grupo = (titulo) => console.log(`\n${titulo}`);
function chequear(nombre, ok, detalle = '') {
  total++; if (!ok) fallos++;
  console.log(`  ${ok ? '✓' : '✗'} ${nombre}${!ok && detalle ? `\n      → ${detalle}` : ''}`);
  return ok;
}

// Si una sección no puede completarse (por ejemplo, un botón que ya no existe), se informa como falla y se sigue.
async function seccion(titulo, fn) {
  grupo(titulo);
  try { await fn(); } catch (e) { chequear(`La prueba no pudo completarse: ${String(e.message).split('\n')[0]}`, false); }
}

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function nuevaPagina({ ancho = 390, sesion = false, admin = false, descargas = false } = {}) {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: 900 }, acceptDownloads: descargas });
  await ctx.route('**/cdn.jsdelivr.net/**', (r) => r.fulfill({ contentType: 'application/javascript', body: STUB }));
  await ctx.route('https://wa.me/**', (r) => r.fulfill({ contentType: 'text/html', body: '' }));
  await ctx.addInitScript(({ sesion, admin }) => {
    if (sesion) localStorage.setItem('stubuser', '1');
    if (admin) localStorage.setItem('esadmin', '1');
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ← ${e.blockedURI}`));
  }, { sesion, admin });
  const p = await ctx.newPage();
  p.problemas = [];
  p.on('pageerror', (e) => p.problemas.push(`JavaScript: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) p.problemas.push(`consola: ${m.text().slice(0, 140)}`); });
  return p;
}
const ir = async (p, ruta) => { await p.goto(BASE + ruta); await p.waitForTimeout(450); };
const cspDe = (p) => p.evaluate(() => window.__csp);

async function axe(p, nombre) {
  await p.evaluate(AXE); // evaluate no está sujeto a la CSP de la página
  const r = await p.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }));
  chequear(`Accesibilidad: ${nombre}`, r.violations.length === 0, r.violations.map((v) => `${v.id} (${v.impact}) en ${v.nodes[0].target.join(' ').slice(0, 70)}`).join(' | '));
}

// ═══ 0. Configuración ═══
grupo('0. Configuración');
const config = fs.readFileSync(path.join(RAIZ, 'js/site.config.js'), 'utf8');
if (MODO_CLIENTE) {
  chequear('Sitio de cliente: el cartel "Demo funcional" está apagado (demo: false)', /demo:\s*false/.test(config), 'En js/site.config.js poné demo: false');
  chequear('Sitio de cliente: no apunta al proyecto de Supabase del demo', !config.includes('pnxplpmyeozclhhpjfsq'), 'Cambiá supabaseUrl y supabaseAnonKey en js/site.config.js');
}
chequear('Sin claves secretas en el código (service_role / sb_secret)', !/sb_secret_|eyJ[A-Za-z0-9_-]{30,}/.test(fs.readdirSync(path.join(RAIZ, 'js'), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(RAIZ, 'js', f), 'utf8')).join('\n')));

// ═══ 1-3. Enlaces del motor, errores, CSP y textos ═══
const COMUNES = ['.site-header', '.site-header [data-config="nombre_tienda"]', '#cart-btn', '#cart-count', '#cart-drawer', '#cart-body', '#cart-foot', '#account-link', '#menu-btn', '.site-footer', '#contenido'];
const POR_PAGINA = {
  'index.html': ['#categorias', '#destacados', '#contacto', '[data-config="whatsapp-link"]', '#destacados [data-agregar], #destacados [data-abrir]'],
  'catalogo.html': ['#buscar', '#orden', '#chips', '#chips [data-cat]', '#grilla', '#modal-producto', '#grilla [data-agregar], #grilla [data-abrir]'],
  'cuenta.html': ['#cuenta-root', '#form-ingresar'],
  'admin/index.html': ['#admin-root', '#form-admin-login'],
};
for (const ancho of [390, 1280]) {
  grupo(`1-3. Páginas con ancho ${ancho}px: enlaces del motor, errores, CSP y textos`);
  for (const [pagina, selectores] of Object.entries(POR_PAGINA)) {
    const p = await nuevaPagina({ ancho });
    try {
    await ir(p, pagina);
    const faltan = [];
    for (const s of [...COMUNES, ...selectores]) if (!(await p.$(s))) faltan.push(s);
    chequear(`${pagina}: existen los ${COMUNES.length + selectores.length} enlaces del motor`, faltan.length === 0, `faltan: ${faltan.join(', ')}`);
    chequear(`${pagina}: sin errores de JavaScript ni de consola`, p.problemas.length === 0, p.problemas.join(' | '));
    const violaciones = (await cspDe(p)).filter((x) => !x.includes('/__img/'));
    chequear(`${pagina}: sin violaciones de la política de seguridad (CSP)`, violaciones.length === 0, violaciones.join(' | '));
    const texto = (await p.evaluate(() => document.body.innerText)).replaceAll(NOMBRE_HOSTIL, '');
    const roto = texto.match(/\[object Object\]|\bundefined\b|\bNaN\b|<\/?[a-z][\w-]*(\s[^>]*)?>/i);
    chequear(`${pagina}: sin textos rotos en pantalla`, !roto, roto ? `aparece "${roto[0]}"` : '');
    chequear(`${pagina}: el texto de la base se escapa (no se ejecutó código inyectado)`, (await p.evaluate(() => window.__xss)) === undefined);
    } catch (e) { chequear(`${pagina}: la prueba no pudo completarse: ${String(e.message).split('\n')[0]}`, false); }
    await p.context().close();
  }
}

// ═══ 4 + 5. Flujos de compra (con accesibilidad en cada estado) ═══
await seccion('4-5. Catálogo, carrito y pedido (usuario con sesión)', async () => {
  const p = await nuevaPagina({ sesion: true });
  await ir(p, 'catalogo.html'); await p.waitForSelector('#grilla [data-agregar], #grilla [data-abrir]');
  await axe(p, 'catálogo');
  const tarjeta = (nombre) => p.locator('#grilla article', { hasText: nombre });
  await p.click('#grilla .card-media[data-abrir] >> nth=1'); await p.waitForSelector('#modal-producto.is-open'); await p.waitForTimeout(350);
  chequear('Modal de producto: el modelo agotado aparece deshabilitado', await p.$eval('#modal-producto [data-modelo][disabled]', (e) => e.textContent.includes('Sin stock')).catch(() => false));
  await axe(p, 'modal de producto');
  await p.keyboard.press('Escape'); await p.waitForTimeout(350);
  const agregar = tarjeta('Vela de soja').locator('[data-agregar]');
  await agregar.click(); await agregar.click(); await agregar.click();
  chequear('Carrito: el contador suma y respeta el stock disponible (tope 2)', (await p.textContent('#cart-count')).trim() === '2', `contador: ${await p.textContent('#cart-count')}`);
  chequear('Carrito: avisa cuando se llegó al tope de stock', (await p.locator('.toast').last().textContent()).includes('stock'));
  await p.reload(); await p.waitForSelector('#cart-count');
  chequear('Carrito: persiste al recargar la página', (await p.textContent('#cart-count')).trim() === '2');
  await p.click('#cart-btn'); await p.waitForSelector('.cart-line'); await p.waitForTimeout(350);
  chequear('Carrito: el botón "más" se deshabilita en el tope de stock', await p.$eval('.cart-line [data-mas]', (e) => e.disabled));
  await axe(p, 'carrito abierto');
  await p.click('[data-confirmar]'); await p.waitForSelector('#form-pedido'); await p.waitForTimeout(350);
  await axe(p, 'confirmación de pedido');
  // Primero un rechazo del servidor
  await p.evaluate(() => { window.__rpcFalla = true; });
  await p.check('input[name=entrega][value=retiro]'); await p.click('#form-pedido button[type=submit]'); await p.waitForSelector('#checkout-msg.form-error');
  chequear('Pedido rechazado por el servidor: se muestra su mensaje y no se vacía el carrito', (await p.textContent('#checkout-msg')).includes('Sin stock suficiente') && (await p.evaluate(() => JSON.parse(localStorage.getItem('cb_cart_v1')).length)) === 1);
  // Ahora el pedido bueno
  await p.evaluate(() => { window.__rpcFalla = false; });
  await p.click('#form-pedido button[type=submit]'); await p.waitForSelector('#btn-wa');
  const rpc = await p.evaluate(() => window.__rpc);
  chequear('Pedido: al servidor van solo ids y cantidades (los precios los calcula el servidor)', JSON.stringify(rpc?.p_items) === JSON.stringify([{ producto_id: 'a1', modelo_id: null, cantidad: 2 }]) && rpc.p_metodo_entrega === 'retiro' && rpc.p_direccion === null, JSON.stringify(rpc));
  chequear('Pedido: muestra el código y el botón "Abrir WhatsApp" con el pedido', (await p.textContent('#modal-checkout')).includes('TP-00009') && decodeURIComponent(await p.getAttribute('#btn-wa', 'href')).includes('Pedido: TP-00009'));
  chequear('Pedido: el carrito queda vacío', (await p.evaluate(() => localStorage.getItem('cb_cart_v1'))) === '[]');
  await axe(p, 'pedido confirmado');
  await ir(p, 'cuenta.html'); await p.waitForSelector('.order');
  await axe(p, 'cuenta con sesión');
  chequear('Cuenta: lista los pedidos del cliente', (await p.$$('.order')).length === 2);
  await ir(p, 'index.html'); await p.waitForSelector('#destacados [data-agregar], #destacados [data-abrir]'); await axe(p, 'home');
  chequear('Sin errores de JavaScript durante todo el flujo', p.problemas.filter((x) => !x.includes('crear_pedido')).length === 0, p.problemas.join(' | '));
  await p.context().close();
});

await seccion('4-5. Pedido como invitado (por WhatsApp, sin guardar)', async () => {
  const p = await nuevaPagina();
  await ir(p, 'catalogo.html'); await p.waitForSelector('#grilla [data-agregar]');
  await p.locator('#grilla article', { hasText: 'Vela de soja' }).locator('[data-agregar]').click();
  await p.click('#cart-btn'); await p.waitForSelector('.cart-line'); await p.click('[data-confirmar]'); await p.waitForSelector('#modal-checkout .modal-foot a'); await p.waitForTimeout(350);
  const enlaces = await p.$$eval('#modal-checkout .modal-foot a', (a) => a.map((x) => decodeURIComponent(x.getAttribute('href'))));
  chequear('Invitado: ofrece WhatsApp con el pedido armado y el acceso a la cuenta', enlaces.some((h) => h.startsWith('https://wa.me/5491100000000?text=') && h.includes('Vela de soja x1')) && enlaces.some((h) => h.endsWith('cuenta.html')), enlaces.join(' | '));
  await axe(p, 'confirmación como invitado');
  await ir(p, 'cuenta.html'); await p.waitForSelector('#form-ingresar'); await axe(p, 'cuenta (ingresar)');
  await p.click('[data-tab=registro]'); await axe(p, 'cuenta (registro)');
  await ir(p, 'admin/index.html'); await p.waitForSelector('#form-admin-login'); await axe(p, 'panel (login)');
  await p.context().close();
});

// ═══ 6. Panel ═══
await seccion('6. Panel de administración (administrador)', async () => {
  const p = await nuevaPagina({ ancho: 1280, sesion: true, admin: true, descargas: true });
  const descargas = []; p.on('download', (d) => descargas.push(d.suggestedFilename()));
  await ir(p, 'admin/index.html'); await p.waitForSelector('.stats');
  await axe(p, 'panel: resumen');
  const pestana = async (t, sel) => { await p.click(`#tab-${t}`); await p.waitForSelector(sel); await p.waitForTimeout(200); };
  for (const [t, sel] of [['productos', '[data-editar]'], ['stock', '#tabla-stock input'], ['pedidos', '.order'], ['clientes', '[data-ver]'], ['categorias', '[data-nueva]'], ['config', '#form-config']]) {
    await pestana(t, sel); await axe(p, `panel: ${t}`);
  }
  await pestana('pedidos', '.order'); await pestana('clientes', '[data-ver]'); await pestana('productos', '[data-editar]'); await pestana('pedidos', '.order');
  descargas.length = 0; await p.click('[data-exportar]'); await p.waitForTimeout(1000);
  chequear('Pedidos: un clic en "Exportar a Excel" baja UN archivo (aunque se hayan visitado otras pestañas)', descargas.length === 1 && /^pedidos_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx$/.test(descargas[0]), JSON.stringify(descargas));
  await pestana('clientes', '[data-ver]'); descargas.length = 0; await p.click('[data-exportar]'); await p.waitForTimeout(1000);
  chequear('Clientes: un clic baja UN archivo con nombre distinto al de pedidos', descargas.length === 1 && /^clientes_/.test(descargas[0]), JSON.stringify(descargas));
  await pestana('productos', '[data-editar]'); await p.click('tr[data-id=a1] [data-editar]'); await p.waitForSelector('#form-producto'); await p.waitForTimeout(350);
  chequear('Productos: "Editar" abre UNA ventana', (await p.$$('.modal.is-open')).length === 1);
  await axe(p, 'panel: formulario de producto');
  await p.keyboard.press('Escape'); await p.waitForTimeout(350);
  await pestana('stock', '#tabla-stock input'); await p.evaluate(() => { window.__log = []; });
  await p.fill('#tabla-stock input >> nth=0', '7'); await p.press('#tabla-stock input >> nth=0', 'Tab'); await p.waitForTimeout(300);
  chequear('Stock: un cambio genera UNA actualización', (await p.evaluate(() => window.__log)).filter((x) => x.op === 'update').length === 1);
  chequear('Panel: sin errores de JavaScript', p.problemas.length === 0, p.problemas.join(' | '));
  await p.context().close();
});

await navegador.close();
servidor.close();
console.log(`\n${fallos === 0 ? '✓ TODO OK' : `✗ FALLARON ${fallos}`} — ${total - fallos} de ${total} verificaciones pasaron.`);
process.exit(fallos === 0 ? 0 : 1);
