// ░ SITIO — capa de diseño: se puede rediseñar por cliente usando las funciones del motor (js/lib/)
// Cuenta del cliente: registro, login, recuperar contraseña, mis datos y mis pedidos.
import { initLayout } from '../components/layout.js';
import { getStore, applyBranding } from '../lib/store.js';
import { $, esc, on, toast } from '../lib/dom.js';
import { money, fecha } from '../lib/format.js';
import { getProductosPorIds, stockModelo } from '../lib/api.js';
import { agregar as agregarAlCarrito } from '../lib/cart.js';
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
    pintar(`<div class="auth-box"><h1 class="sr-only">Registrarme</h1>${tabs}
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

  pintar(`<div class="auth-box"><h1 class="sr-only">Ingresar</h1>${tabs}
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

const ESTADOS = {
  pendiente: ['Pendiente', 'badge-warn'], confirmado: ['Confirmado', 'badge-primary'],
  enviado: ['Enviado', 'badge-primary'], entregado: ['Entregado', 'badge-ok'], cancelado: ['Cancelado', 'badge-danger'],
};
let usuarioActual = null; // usuario cuya vista de cuenta está en pantalla
let pedidos = [];

async function vistaLogueado(user) {
  usuarioActual = user;
  pintar(`
    <div class="section-head" style="margin-top:var(--space-6)">
      <h1 style="font-size:2rem">Mi cuenta</h1>
      <div class="row">
        <a class="btn btn-sm hidden" id="cuenta-panel" href="admin/index.html">Panel de administración</a>
        <button class="btn btn-sm" type="button" data-accion="salir">Cerrar sesión</button>
      </div>
    </div>
    <div class="account-grid">
      <section class="panel" aria-labelledby="t-datos">
        <h2 id="t-datos" style="font-size:1.3rem;margin-bottom:var(--space-2)">Mis datos</h2>
        <p class="muted" id="cuenta-email" style="margin-bottom:var(--space-4)"></p>
        <form class="stack" id="form-datos" novalidate>
          ${campo('nombre', 'Nombre y apellido', 'text', 'autocomplete="name" required')}
          ${campo('telefono', 'Teléfono (WhatsApp)', 'tel', 'autocomplete="tel" inputmode="tel" required')}
          <h3 style="font-size:1rem;font-family:var(--font-body)">Dirección de envío</h3>
          ${campo('calle', 'Calle', 'text', 'autocomplete="address-line1"')}
          ${campo('numero', 'Número / piso / depto', 'text', 'autocomplete="address-line2"')}
          ${campo('ciudad', 'Ciudad', 'text', 'autocomplete="address-level2"')}
          ${campo('cp', 'Código postal', 'text', 'autocomplete="postal-code"')}
          ${campo('provincia', 'Provincia', 'text', 'autocomplete="address-level1"')}
          <div class="form-msg hidden"></div>
          <button class="btn btn-primary" type="submit">Guardar cambios</button>
        </form>
      </section>
      <section aria-labelledby="t-pedidos">
        <h2 id="t-pedidos" style="font-size:1.3rem;margin-bottom:var(--space-3)">Mis pedidos</h2>
        <div id="lista-pedidos"><div class="skeleton" style="height:90px"></div></div>
      </section>
    </div>`);
  $('#cuenta-email').textContent = user.email;

  // Datos del perfil y pedidos, en paralelo (RLS: cada cliente solo ve lo suyo)
  const [perfil, ped, admin] = await Promise.all([
    supabase.from('clientes').select('nombre,telefono,direccion').eq('id', user.id).maybeSingle(),
    supabase.from('pedidos')
      .select('id,codigo,creado,total,estado,metodo_entrega,direccion_envio,notas,pedido_items(nombre,modelo,cantidad,subtotal,producto_id,modelo_id)')
      .order('creado', { ascending: false }),
    isAdmin(user),
  ]);
  if (usuarioActual !== user) return; // mientras tanto cambió la vista (por ejemplo, cerró sesión)

  if (admin) $('#cuenta-panel')?.classList.remove('hidden');
  const form = $('#form-datos');
  const d = perfil.data?.direccion ?? {};
  form.elements.nombre.value = perfil.data?.nombre ?? user.user_metadata?.nombre ?? '';
  form.elements.telefono.value = perfil.data?.telefono ?? '';
  ['calle', 'numero', 'ciudad', 'cp', 'provincia'].forEach((k) => { form.elements[k].value = d[k] ?? ''; });

  if (ped.error) {
    $('#lista-pedidos').innerHTML = '<p class="form-error">No pudimos cargar tus pedidos. Probá recargar la página.</p>';
    return;
  }
  pedidos = ped.data;
  pintarPedidos();
}

function pintarPedidos() {
  const cont = $('#lista-pedidos');
  if (!pedidos.length) {
    cont.innerHTML = `<div class="empty"><span class="emoji" aria-hidden="true">🛍️</span>Todavía no hiciste pedidos.<br><a class="link-more" href="catalogo.html">Ver el catálogo</a></div>`;
    return;
  }
  cont.innerHTML = pedidos.map((p) => {
    const [texto, clase] = ESTADOS[p.estado] ?? [p.estado, ''];
    const dir = p.direccion_envio;
    const entrega = p.metodo_entrega === 'envio'
      ? `Envío a ${esc([`${dir?.calle ?? ''} ${dir?.numero ?? ''}`.trim(), dir?.ciudad, dir?.cp && `(${dir.cp})`, dir?.provincia].filter(Boolean).join(', '))}`
      : 'Retiro por el local';
    return `
      <details class="order">
        <summary>
          <strong>${esc(p.codigo)}</strong>
          <span class="muted">${esc(fecha(p.creado))}</span>
          <span class="badge ${clase}">${esc(texto)}</span>
          <strong>${money(p.total)}</strong>
        </summary>
        <div class="order-detail">
          <ul style="list-style:none;padding:0;display:grid;gap:var(--space-2)">
            ${p.pedido_items.map((i) => `<li><span>${esc(i.nombre)}${i.modelo ? ` — ${esc(i.modelo)}` : ''} <span class="muted">x${i.cantidad}</span></span><span>${money(i.subtotal)}</span></li>`).join('')}
          </ul>
          <p class="muted">${entrega}</p>
          ${p.notas ? `<p class="muted">Notas: ${esc(p.notas)}</p>` : ''}
          <div><button class="btn btn-sm" type="button" data-repetir="${esc(p.id)}">Repetir pedido</button></div>
        </div>
      </details>`;
  }).join('');
}

// "Repetir pedido": vuelve a poner los ítems en el carrito, respetando el stock actual
async function repetirPedido(id) {
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido) return;
  const items = pedido.pedido_items.filter((i) => i.producto_id);
  try {
    const productos = await getProductosPorIds([...new Set(items.map((i) => i.producto_id))]);
    const porId = new Map(productos.map((p) => [p.id, p]));
    let agregados = 0, omitidos = 0;
    for (const it of items) {
      const prod = porId.get(it.producto_id);
      const modeloId = prod?.tiene_variantes ? it.modelo_id : null;
      const stock = prod ? stockModelo(prod, modeloId) : 0;
      if (!prod || stock <= 0 || (prod.tiene_variantes && !modeloId)) { omitidos++; continue; }
      const r = agregarAlCarrito(prod.id, modeloId, it.cantidad, stock);
      if (r.ok) agregados++; else omitidos++;
    }
    omitidos += pedido.pedido_items.length - items.length; // productos que ya fueron borrados
    if (!agregados) toast('Ninguno de esos productos está disponible ahora', 'error');
    else {
      toast(omitidos ? `Agregamos ${agregados} al carrito. ${omitidos} ya no está disponible o no hay más stock.` : 'Listo, agregamos todo al carrito', 'ok');
      document.getElementById('cart-btn')?.click();
    }
  } catch (err) {
    console.error('No se pudo repetir el pedido', err);
    toast('No pudimos repetir el pedido. Probá de nuevo.', 'error');
  }
}

// ── Eventos ──
on(raiz, 'click', '[data-tab]', (_e, el) => { pestana = el.dataset.tab; vistaInvitado(); $('input', raiz)?.focus(); });
on(raiz, 'click', '[data-repetir]', (_e, el) => repetirPedido(el.dataset.repetir));
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

  if (form.id === 'form-datos') {
    const nombre = valor(form, 'nombre'), telefono = valor(form, 'telefono');
    let ok = true;
    if (nombre.length < 2) { marcarError(form, 'nombre', 'Ingresá tu nombre.'); ok = false; }
    if (telefono.replace(/\D/g, '').length < 6) { marcarError(form, 'telefono', 'Ingresá un teléfono válido.'); ok = false; }
    if (!ok) return;
    const direccion = Object.fromEntries(['calle', 'numero', 'ciudad', 'cp', 'provincia'].map((k) => [k, valor(form, k)]));
    conCarga(form, async () => {
      const { error } = await supabase.from('clientes').update({ nombre, telefono, direccion }).eq('id', usuarioActual.id);
      if (error) mensaje(form, 'No pudimos guardar tus datos. Probá de nuevo.');
      else mensaje(form, 'Datos guardados.', true);
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
    if (usuarioActual?.id !== sesion.user.id) vistaLogueado(sesion.user);
    if (evento === 'SIGNED_IN') {
      // Opcional: registrar el último acceso (si falla, no pasa nada)
      supabase.from('clientes').update({ ultimo_acceso: new Date().toISOString() }).eq('id', sesion.user.id).then(() => {});
    }
  } else {
    usuarioActual = null;
    vistaInvitado();
  }
});

try {
  applyBranding(await getStore());
} catch (err) {
  console.error('No se pudo cargar la configuración de la tienda', err);
}
