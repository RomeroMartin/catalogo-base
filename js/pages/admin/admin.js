// ▒ PANEL — igual para todos los clientes (solo cambian colores y logo desde theme.css)
// Panel de administración: login, guardia de admin y router de pestañas.
// La seguridad REAL es RLS en la base; la guardia de acá es solo experiencia de usuario.
import { initLayout } from '../../components/layout.js';
import { getStore, applyBranding } from '../../lib/store.js';
import { $, on, esc } from '../../lib/dom.js';
import { onAuth, signIn, signOut, isAdmin, mapAuthError } from '../../lib/auth.js';

const raiz = $('#admin-root');
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PESTANAS = [
  ['resumen', 'Resumen'], ['productos', 'Productos'], ['stock', 'Stock'], ['pedidos', 'Pedidos'],
  ['clientes', 'Clientes'], ['categorias', 'Categorías'], ['config', 'Configuración'],
];

let usuarioEnPanel = null; // usuario cuyo panel está en pantalla (evita repintar en eventos repetidos de sesión)
let pestanaActual = null;
let turnoCarga = 0;

// ── Vistas ──
function vistaLogin(mensajeError = '') {
  usuarioEnPanel = null;
  raiz.innerHTML = `
    <div class="auth-box">
      <h1 style="font-size:1.6rem;margin-bottom:var(--space-4)">Panel de administración</h1>
      <form class="stack" id="form-admin-login" novalidate>
        <div class="field" data-campo="email"><label for="a-email">Email</label><input class="input" id="a-email" type="email" autocomplete="email" required><span class="field-error" role="alert"></span></div>
        <div class="field" data-campo="password"><label for="a-pass">Contraseña</label><input class="input" id="a-pass" type="password" autocomplete="current-password" required><span class="field-error" role="alert"></span></div>
        <div class="form-error ${mensajeError ? '' : 'hidden'}" id="a-msg" role="alert">${esc(mensajeError)}</div>
        <button class="btn btn-primary btn-block" type="submit">Ingresar</button>
      </form>
    </div>`;
}

function vistaSinPermiso() {
  usuarioEnPanel = null;
  raiz.innerHTML = `
    <div class="auth-box stack">
      <h1 style="font-size:1.4rem">Sin permisos</h1>
      <p>Tu cuenta no tiene permisos de administración.</p>
      <button class="btn btn-block" type="button" data-salir>Cerrar sesión</button>
      <a class="btn btn-ghost btn-block" href="../index.html">Volver al sitio</a>
    </div>`;
}

function vistaPanel(user) {
  usuarioEnPanel = user.id;
  raiz.innerHTML = `
    <div class="admin">
      <nav class="admin-nav" aria-label="Secciones del panel">
        ${PESTANAS.map(([id, texto]) => `<button type="button" id="tab-${id}" data-tab="${id}">${texto}</button>`).join('')}
        <button type="button" class="btn-ghost" data-salir style="margin-top:var(--space-2)">Cerrar sesión</button>
      </nav>
      <section id="admin-vista" tabindex="-1" aria-live="polite"></section>
    </div>`;
  irAPestana(pestanaDesdeHash());
}

// ── Router de pestañas (#resumen, #productos, …) ──
const pestanaDesdeHash = () => {
  const h = location.hash.slice(1);
  return PESTANAS.some(([id]) => id === h) ? h : 'resumen';
};

async function irAPestana(id) {
  let vista = $('#admin-vista');
  if (!vista) return;
  // Cada pestaña se dibuja en un contenedor NUEVO. Si se reutilizara el mismo, los eventos de clic de las
  // pestañas anteriores seguirían activos y una sola acción dispararía varias (descargas y ventanas repetidas).
  const limpio = vista.cloneNode(false); // copia los atributos pero NO los eventos
  vista.replaceWith(limpio);
  vista = limpio;
  pestanaActual = id;
  const turno = ++turnoCarga;
  PESTANAS.forEach(([p]) => { const b = $(`#tab-${p}`); if (p === id) b?.setAttribute('aria-current', 'page'); else b?.removeAttribute('aria-current'); });
  vista.innerHTML = '<div class="skeleton" style="height:160px"></div>';
  try {
    const modulo = await import(`./${id}.js`);
    if (turno !== turnoCarga) return;
    vista.innerHTML = '';
    await modulo.render(vista);
  } catch (err) {
    console.error(`No se pudo cargar la pestaña ${id}`, err);
    if (turno === turnoCarga) vista.innerHTML = '<div class="form-error">No pudimos cargar esta sección. Probá recargar la página.</div>';
  }
}

// ── Eventos ──
on(raiz, 'click', '[data-tab]', (_e, el) => {
  if (location.hash.slice(1) === el.dataset.tab) irAPestana(el.dataset.tab);
  else location.hash = el.dataset.tab; // dispara hashchange
});
window.addEventListener('hashchange', () => { if (usuarioEnPanel) irAPestana(pestanaDesdeHash()); });
on(raiz, 'click', '[data-salir]', () => signOut());

raiz.addEventListener('submit', async (ev) => {
  if (ev.target.id !== 'form-admin-login') return;
  ev.preventDefault();
  const form = ev.target, btn = form.querySelector('button[type="submit"]');
  const email = $('#a-email').value.trim(), password = $('#a-pass').value;
  const msg = $('#a-msg');
  msg.classList.add('hidden');
  form.querySelectorAll('[data-campo]').forEach((f) => { f.classList.remove('has-error'); f.querySelector('.field-error').textContent = ''; });
  let ok = true;
  if (!EMAIL_OK.test(email)) { const f = form.querySelector('[data-campo="email"]'); f.classList.add('has-error'); f.querySelector('.field-error').textContent = 'Ingresá un email válido.'; ok = false; }
  if (!password) { const f = form.querySelector('[data-campo="password"]'); f.classList.add('has-error'); f.querySelector('.field-error').textContent = 'Ingresá tu contraseña.'; ok = false; }
  if (!ok || btn.disabled) return;
  btn.disabled = true; btn.classList.add('is-loading');
  const { error } = await signIn({ email, password });
  btn.disabled = false; btn.classList.remove('is-loading');
  if (error) { msg.textContent = mapAuthError(error); msg.classList.remove('hidden'); }
});

// ── Arranque ──
initLayout();
raiz.innerHTML = '<div class="auth-box"><div class="skeleton" style="height:180px"></div></div>';

onAuth(async (_evento, sesion) => {
  if (!sesion) { vistaLogin(); return; }
  if (usuarioEnPanel === sesion.user.id) return; // mismo usuario: no se repinta
  const admin = await isAdmin(sesion.user);
  if (admin) vistaPanel(sesion.user); else vistaSinPermiso();
});

try {
  applyBranding(await getStore());
} catch (err) {
  console.error('No se pudo cargar la configuración de la tienda', err);
}
