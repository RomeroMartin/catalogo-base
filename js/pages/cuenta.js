// Cuenta del cliente: registro, login, recuperar contraseña y nueva contraseña.
// (Mis datos y Mis pedidos llegan en la Fase 7.)
import { initLayout } from '../components/layout.js';
import { getStore, applyBranding } from '../lib/store.js';
import { $, on, toast } from '../lib/dom.js';
import { supabase } from '../supabase-client.js';
import { onAuth, signUp, signIn, signOut, resetPassword, updatePassword, isAdmin, mapAuthError } from '../lib/auth.js';

const raiz = $('#cuenta-root');
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let modoRecuperar = location.hash.includes('type=recovery'); // llegó desde el email de "olvidé mi contraseña"
let pestana = 'ingresar';                                    // 'ingresar' | 'registro' | 'olvide'

// ── Helpers de formulario ──
const campo = (id, label, tipo, extra = '') => `
  <div class="field" data-campo="${id}">
    <label for="${id}">${label}</label>
    <input class="input" id="${id}" name="${id}" type="${tipo}" ${extra}>
    <span class="field-error" role="alert"></span>
  </div>`;

function marcarError(form, id, mensaje) {
  const f = form.querySelector(`[data-campo="${id}"]`);
  if (!f) return;
  f.classList.toggle('has-error', !!mensaje);
  f.querySelector('.field-error').textContent = mensaje || '';
}

function limpiarErrores(form) {
  form.querySelectorAll('[data-campo]').forEach((f) => marcarError(form, f.dataset.campo, ''));
  const g = form.querySelector('.form-msg');
  g.className = 'form-msg hidden';
  g.textContent = '';
}

function mensaje(form, texto, ok = false) {
  const g = form.querySelector('.form-msg');
  g.className = `form-msg ${ok ? 'form-ok' : 'form-error'}`;
  g.textContent = texto;
  g.setAttribute('role', ok ? 'status' : 'alert');
}

// Deshabilita el botón mientras se envía (anti doble envío)
async function conCarga(form, tarea) {
  const btn = form.querySelector('button[type="submit"]');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.classList.add('is-loading');
  try { await tarea(); } finally { btn.disabled = false; btn.classList.remove('is-loading'); }
}

const valor = (form, id) => form.elements[id].value.trim();

// ── Vistas ──
function pintar(html) { raiz.innerHTML = html; }

function vistaInvitado() {
  const tabs = `
    <div class="tabs" role="tablist" aria-label="Acceso">
      <button type="button" role="tab" id="tab-ingresar" aria-selected="${pestana === 'ingresar'}" data-tab="ingresar">Ingresar</button>
      <button type="button" role="tab" id="tab-registro" aria-selected="${pestana === 'registro'}" data-tab="registro">Registrarme</button>
    </div>`;

  if (pestana === 'olvide') {
    pintar(`<div class="auth-box">
      <h1 style="font-size:1.6rem">Recuperar contraseña</h1>
      <p class="muted" style="margin:var(--space-2) 0 var(--space-4)">Ingresá tu email y te enviamos un enlace para elegir una nueva contraseña.</p>
      <form class="stack" id="form-olvide" novalidate>
        ${campo('email', 'Email', 'email', 'autocomplete="email" required')}
        <div class="form-msg hidden"></div>
        <button class="btn btn-primary btn-block" type="submit">Enviar enlace</button>
        <button class="btn btn-ghost btn-block" type="button" data-tab="ingresar">Volver</button>
      </form></div>`);
    return;
  }

  if (pestana === 'registro') {
    pintar(`<div class="auth-box">${tabs}
      <form class="stack" id="form-registro" novalidate>
        ${campo('nombre', 'Nombre y apellido', 'text', 'autocomplete="name" required')}
        ${campo('email', 'Email', 'email', 'autocomplete="email" required')}
        ${campo('telefono', 'Teléfono (WhatsApp)', 'tel', 'autocomplete="tel" inputmode="tel" required')}
        ${campo('password', 'Contraseña (mínimo 8 caracteres)', 'password', 'autocomplete="new-password" minlength="8" required')}
        <div class="form-msg hidden"></div>
        <button class="btn btn-primary btn-block" type="submit">Crear mi cuenta</button>
      </form></div>`);
    return;
  }

  pintar(`<div class="auth-box">${tabs}
    <form class="stack" id="form-ingresar" novalidate>
      ${campo('email', 'Email', 'email', 'autocomplete="email" required')}
      ${campo('password', 'Contraseña', 'password', 'autocomplete="current-password" required')}
      <div class="form-msg hidden"></div>
      <button class="btn btn-primary btn-block" type="submit">Ingresar</button>
      <button class="btn btn-ghost btn-block" type="button" data-tab="olvide">Olvidé mi contraseña</button>
    </form></div>`);
}

function vistaNuevaPassword() {
  pintar(`<div class="auth-box">
    <h1 style="font-size:1.6rem">Elegí tu nueva contraseña</h1>
    <form class="stack" id="form-nueva" novalidate style="margin-top:var(--space-4)">
      ${campo('password', 'Nueva contraseña (mínimo 8 caracteres)', 'password', 'autocomplete="new-password" minlength="8" required')}
      ${campo('password2', 'Repetí la contraseña', 'password', 'autocomplete="new-password" required')}
      <div class="form-msg hidden"></div>
      <button class="btn btn-primary btn-block" type="submit">Guardar contraseña</button>
    </form></div>`);
}

async function vistaLogueado(user) {
  pintar(`<div class="auth-box stack">
    <h1 style="font-size:1.6rem">Mi cuenta</h1>
    <p>Hola, <strong id="cuenta-nombre"></strong></p>
    <p class="muted" id="cuenta-email"></p>
    <a class="btn btn-block hidden" id="cuenta-panel" href="admin/index.html">Ir al panel de administración</a>
    <button class="btn btn-block" type="button" data-accion="salir">Cerrar sesión</button>
  </div>`);
  $('#cuenta-nombre').textContent = user.user_metadata?.nombre || user.email;
  $('#cuenta-email').textContent = user.email;
  if (await isAdmin(user)) $('#cuenta-panel')?.classList.remove('hidden');
}

// ── Eventos ──
on(raiz, 'click', '[data-tab]', (_e, el) => { pestana = el.dataset.tab; vistaInvitado(); $('input', raiz)?.focus(); });
on(raiz, 'click', '[data-accion="salir"]', async () => { await signOut(); toast('Cerraste sesión'); });

raiz.addEventListener('submit', (ev) => {
  const form = ev.target;
  ev.preventDefault();
  limpiarErrores(form);

  if (form.id === 'form-ingresar') {
    const email = valor(form, 'email'), password = form.elements.password.value;
    let ok = true;
    if (!EMAIL_OK.test(email)) { marcarError(form, 'email', 'Ingresá un email válido.'); ok = false; }
    if (!password) { marcarError(form, 'password', 'Ingresá tu contraseña.'); ok = false; }
    if (!ok) return;
    conCarga(form, async () => {
      const { error } = await signIn({ email, password });
      if (error) mensaje(form, mapAuthError(error));
    });
  }

  if (form.id === 'form-registro') {
    const nombre = valor(form, 'nombre'), email = valor(form, 'email'), telefono = valor(form, 'telefono'), password = form.elements.password.value;
    let ok = true;
    if (nombre.length < 2) { marcarError(form, 'nombre', 'Ingresá tu nombre.'); ok = false; }
    if (!EMAIL_OK.test(email)) { marcarError(form, 'email', 'Ingresá un email válido.'); ok = false; }
    if (telefono.replace(/\D/g, '').length < 6) { marcarError(form, 'telefono', 'Ingresá un teléfono válido.'); ok = false; }
    if (password.length < 8) { marcarError(form, 'password', 'Usá al menos 8 caracteres.'); ok = false; }
    if (!ok) return;
    conCarga(form, async () => {
      const { data, error } = await signUp({ nombre, email, telefono, password });
      if (error) { mensaje(form, mapAuthError(error)); return; }
      // Con sesión → onAuth muestra "Mi cuenta". Sin sesión → hay confirmación de email activada.
      if (!data.session) mensaje(form, 'Listo. Revisá tu email para confirmar la cuenta.', true);
    });
  }

  if (form.id === 'form-olvide') {
    const email = valor(form, 'email');
    if (!EMAIL_OK.test(email)) { marcarError(form, 'email', 'Ingresá un email válido.'); return; }
    conCarga(form, async () => {
      const { error } = await resetPassword(email);
      // Mensaje neutro: no revela qué emails están registrados (solo se informa si hay límite de envíos)
      if (error?.code === 'over_email_send_rate_limit' || error?.code === 'over_request_rate_limit') mensaje(form, mapAuthError(error));
      else mensaje(form, 'Si el email existe, te enviamos un enlace para elegir una nueva contraseña.', true);
    });
  }

  if (form.id === 'form-nueva') {
    const password = form.elements.password.value, password2 = form.elements.password2.value;
    let ok = true;
    if (password.length < 8) { marcarError(form, 'password', 'Usá al menos 8 caracteres.'); ok = false; }
    if (password2 !== password) { marcarError(form, 'password2', 'Las contraseñas no coinciden.'); ok = false; }
    if (!ok) return;
    conCarga(form, async () => {
      const { error } = await updatePassword(password);
      if (error) { mensaje(form, mapAuthError(error)); return; }
      modoRecuperar = false;
      history.replaceState(null, '', location.pathname);
      toast('Contraseña actualizada', 'ok');
      const { data } = await supabase.auth.getUser();
      if (data.user) vistaLogueado(data.user); else vistaInvitado();
    });
  }
});

// ── Arranque ──
initLayout();
pintar('<div class="auth-box"><div class="skeleton" style="height:180px"></div></div>');

onAuth((evento, sesion) => {
  if (evento === 'PASSWORD_RECOVERY') modoRecuperar = true;
  if (modoRecuperar) { vistaNuevaPassword(); return; }
  if (sesion) {
    vistaLogueado(sesion.user);
    if (evento === 'SIGNED_IN') {
      // Opcional: registrar el último acceso (si falla, no pasa nada)
      supabase.from('clientes').update({ ultimo_acceso: new Date().toISOString() }).eq('id', sesion.user.id).then(() => {});
    }
  } else {
    vistaInvitado();
  }
});

try {
  applyBranding(await getStore());
} catch (err) {
  console.error('No se pudo cargar la configuración de la tienda', err);
}
