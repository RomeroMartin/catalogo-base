// Confirmación del pedido: modal de resumen, RPC crear_pedido y mensaje de WhatsApp.
import { supabase } from '../supabase-client.js';
import { $, esc, on, abrirModal, cerrarModal, toast } from './dom.js';
import { money } from './format.js';
import { getStore } from './store.js';
import { rehidratar, vaciar } from './cart.js';

const raiz = document.documentElement.dataset.root || '';
let modal = null;

function getModal() {
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'modal-checkout';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Confirmar pedido');
    document.body.append(modal);
    on(modal, 'click', '[data-cerrar]', () => cerrarModal(modal));
  }
  return modal;
}

const soloDigitos = (s) => String(s ?? '').replace(/\D/g, '');

// Texto del pedido para WhatsApp (con los datos que devolvió el servidor cuando hay pedido guardado)
function armarMensaje({ saludo, items, total, entrega, direccion, notas, codigo }) {
  const lineas = items.map((i) => `• ${i.nombre}${i.modelo ? ` — ${i.modelo}` : ''} x${i.cantidad} — ${money(i.subtotal)}`);
  const dir = !entrega ? '' : entrega === 'envio'
    ? `Envío a ${[`${direccion.calle} ${direccion.numero}`.trim(), direccion.ciudad, direccion.cp && `(${direccion.cp})`, direccion.provincia].filter(Boolean).join(', ')}`
    : 'Retiro por el local';
  return [saludo, '', ...lineas, '', `Total: ${money(total)}`, dir, notas ? `Notas: ${notas}` : '', codigo ? `Pedido: ${codigo}` : '']
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n').trim();
}

const linkWhatsApp = (numero, texto) => `https://wa.me/${soloDigitos(numero)}?text=${encodeURIComponent(texto)}`;

const resumenHTML = (lineas, total) => `
  <ul class="stack" style="list-style:none;padding:0">
    ${lineas.map((l) => `<li class="row" style="justify-content:space-between;flex-wrap:nowrap">
      <span>${esc(l.producto.nombre)}${l.modelo ? ` — ${esc(l.modelo.nombre)}` : ''} <span class="muted">x${l.qty}</span></span>
      <strong>${money(l.subtotal)}</strong></li>`).join('')}
  </ul>
  <div class="cart-total" style="margin-top:var(--space-4)"><span>Total</span><span>${money(total)}</span></div>`;

const cabecera = (titulo) =>
  `<div class="modal-head"><h2 style="font-size:1.3rem">${titulo}</h2><button class="icon-btn" type="button" data-cerrar aria-label="Cerrar"><span aria-hidden="true">✕</span></button></div>`;

// ── Punto de entrada ──
export async function abrirCheckout() {
  const m = getModal();
  m.innerHTML = `${cabecera('Confirmar pedido')}<div class="modal-body"><div class="skeleton" style="height:160px"></div></div>`;
  abrirModal(m);

  let datos, store, sesion;
  try {
    [datos, store, sesion] = await Promise.all([rehidratar(), getStore(), supabase.auth.getSession().then((r) => r.data.session)]);
  } catch (err) {
    console.error('No se pudo preparar el pedido', err);
    $('.modal-body', m).innerHTML = '<p class="form-error">No pudimos cargar tu carrito. Probá de nuevo en un momento.</p>';
    return;
  }
  if (!datos.lineas.length) {
    $('.modal-body', m).innerHTML = `${datos.avisos.length ? `<p class="form-error">${datos.avisos.map(esc).join('<br>')}</p>` : ''}<p class="empty">Tu carrito está vacío.</p>`;
    return;
  }
  if (!sesion) vistaInvitado(m, datos, store.config);
  else await vistaCliente(m, datos, store.config, sesion.user);
}

// ── Invitado: ingresar o seguir sin cuenta por WhatsApp (no se guarda el pedido) ──
function vistaInvitado(m, { lineas, total, avisos }, config) {
  const mensaje = armarMensaje({
    saludo: config.saludo_whatsapp,
    items: lineas.map((l) => ({ nombre: l.producto.nombre, modelo: l.modelo?.nombre, cantidad: l.qty, subtotal: l.subtotal })),
    total, entrega: null, direccion: {}, notas: '',
  });
  m.innerHTML = `${cabecera('Confirmar pedido')}
    <div class="modal-body stack">
      ${avisos.length ? `<p class="form-error">${avisos.map(esc).join('<br>')}</p>` : ''}
      ${resumenHTML(lineas, total)}
      <p class="muted">Con una cuenta guardamos tu pedido y podés ver su estado. También podés pedir directo por WhatsApp sin cuenta.</p>
    </div>
    <div class="modal-foot">
      <a class="btn btn-whatsapp" href="${esc(linkWhatsApp(config.whatsapp, mensaje))}" target="_blank" rel="noopener">Seguir sin cuenta por WhatsApp</a>
      <a class="btn btn-primary" href="${raiz}cuenta.html">Ingresar / Registrarme</a>
    </div>`;
}

// ── Cliente logueado: entrega, dirección, notas y confirmación ──
async function vistaCliente(m, datos, config, user) {
  const { data: cli } = await supabase.from('clientes').select('direccion').eq('id', user.id).maybeSingle();
  const dir = cli?.direccion ?? {};
  const campo = (id, label, extra = '') => `<div class="field" data-campo="${id}"><label for="d-${id}">${label}</label><input class="input" id="d-${id}" name="${id}" value="${esc(dir[id] ?? '')}" ${extra}><span class="field-error" role="alert"></span></div>`;

  m.innerHTML = `${cabecera('Confirmar pedido')}
    <form id="form-pedido" novalidate>
      <div class="modal-body stack">
        <div id="checkout-resumen"></div>
        <fieldset class="stack radios" style="border:0;padding:0">
          <legend class="label">Entrega</legend>
          <label class="check"><input type="radio" name="entrega" value="envio" checked> Envío a domicilio</label>
          <label class="check"><input type="radio" name="entrega" value="retiro"> Retiro por el local</label>
        </fieldset>
        <div class="stack" id="bloque-dir">
          ${campo('calle', 'Calle', 'autocomplete="address-line1"')}${campo('numero', 'Número / piso / depto', 'autocomplete="address-line2"')}
          ${campo('ciudad', 'Ciudad', 'autocomplete="address-level2"')}${campo('cp', 'Código postal', 'autocomplete="postal-code"')}${campo('provincia', 'Provincia', 'autocomplete="address-level1"')}
        </div>
        <div class="field"><label for="d-notas">Notas (opcional)</label><textarea class="textarea" id="d-notas" name="notas" maxlength="500"></textarea></div>
        <div id="checkout-msg" class="hidden"></div>
      </div>
      <div class="modal-foot"><button class="btn btn-primary btn-lg" type="submit">Confirmar pedido</button></div>
    </form>`;

  const form = $('#form-pedido', m);
  let actual = datos;
  const pintarResumen = () => { $('#checkout-resumen', m).innerHTML = (actual.avisos.length ? `<p class="form-error" role="status">${actual.avisos.map(esc).join('<br>')}</p>` : '') + resumenHTML(actual.lineas, actual.total); };
  pintarResumen();

  form.addEventListener('change', (ev) => {
    if (ev.target.name === 'entrega') $('#bloque-dir', m).classList.toggle('hidden', ev.target.value === 'retiro');
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('button[type="submit"]', form);
    if (btn.disabled) return;
    const entrega = form.elements.entrega.value;
    const direccion = Object.fromEntries(['calle', 'numero', 'ciudad', 'cp', 'provincia'].map((k) => [k, form.elements[k].value.trim()]));
    const notas = form.elements.notas.value.trim();

    // Validación: para envío, calle, número y ciudad son obligatorios
    let ok = true;
    $$campos(form).forEach((f) => { f.classList.remove('has-error'); $('.field-error', f).textContent = ''; });
    if (entrega === 'envio') {
      [['calle', 'Ingresá la calle.'], ['numero', 'Ingresá el número.'], ['ciudad', 'Ingresá la ciudad.']].forEach(([k, msg]) => {
        if (!direccion[k]) { const f = form.querySelector(`[data-campo="${k}"]`); f.classList.add('has-error'); $('.field-error', f).textContent = msg; ok = false; }
      });
    }
    if (!ok) return;

    btn.disabled = true; btn.classList.add('is-loading');
    const msgBox = $('#checkout-msg', m);
    msgBox.className = 'hidden';
    try {
      const { data, error } = await supabase.rpc('crear_pedido', {
        p_items: actual.lineas.map((l) => ({ producto_id: l.producto.id, modelo_id: l.modelo?.id ?? null, cantidad: l.qty })),
        p_metodo_entrega: entrega,
        p_direccion: entrega === 'envio' ? direccion : null,
        p_notas: notas || null,
      });
      if (error) {
        // Los mensajes del servidor están redactados para el usuario: se muestran tal cual
        // Solo se muestran tal cual los mensajes que escribió la función de la base (raise exception → P0001) o el aviso de sesión;
        // cualquier otro error de la base (detalles internos) se reemplaza por un mensaje genérico.
        const propio = error.code === 'P0001' || error.code === '28000';
        console.error('crear_pedido falló', error);
        msgBox.className = 'form-error'; msgBox.setAttribute('role', 'alert');
        msgBox.textContent = propio ? error.message : 'No pudimos crear tu pedido. Revisá tu carrito y probá de nuevo.';
        actual = await rehidratar(); pintarResumen();
        if (!actual.lineas.length) btn.disabled = true;
        return;
      }
      exito(m, data, { config, entrega, direccion, notas, user, direccionPrevia: dir });
    } catch (err) {
      console.error('Error al crear el pedido', err);
      msgBox.className = 'form-error'; msgBox.textContent = 'No pudimos enviar tu pedido. Revisá tu conexión y probá de nuevo.';
    } finally {
      if (btn.isConnected) { if (actual.lineas.length) btn.disabled = false; btn.classList.remove('is-loading'); }
    }
  });
}

const $$campos = (form) => [...form.querySelectorAll('[data-campo]')];

// ── Pedido guardado: pantalla de éxito con botón "Abrir WhatsApp" ──
function exito(m, pedido, { config, entrega, direccion, notas, user, direccionPrevia }) {
  const mensaje = armarMensaje({
    saludo: config.saludo_whatsapp, items: pedido.items, total: pedido.total,
    entrega, direccion, notas, codigo: pedido.codigo,
  });
  const href = linkWhatsApp(config.whatsapp, mensaje);

  m.innerHTML = `${cabecera('¡Pedido recibido!')}
    <div class="modal-body stack" style="text-align:center">
      <p style="font-size:3rem" aria-hidden="true">🎉</p>
      <p>Tu código de pedido es</p>
      <p style="font-family:var(--font-display);font-size:2rem;font-weight:700">${esc(pedido.codigo)}</p>
      <p>Total: <strong>${money(pedido.total)}</strong></p>
      <p class="muted">Para terminar, enviá el pedido por WhatsApp. Lo vamos a confirmar con vos.</p>
      <a class="btn btn-whatsapp btn-lg btn-block" id="btn-wa" href="${esc(href)}" target="_blank" rel="noopener">Abrir WhatsApp</a>
      <a class="link-more" href="${raiz}cuenta.html">Ver mis pedidos</a>
    </div>`;

  vaciar();
  // Intento automático; en iOS puede bloquearse (después de un await), por eso existe el botón.
  try { window.open(href, '_blank', 'noopener'); } catch { /* el botón alcanza */ }

  // Guarda la dirección en el perfil si cambió (si falla, no afecta al pedido)
  if (entrega === 'envio' && JSON.stringify(direccion) !== JSON.stringify(direccionPrevia)) {
    supabase.from('clientes').update({ direccion }).eq('id', user.id).then(({ error }) => { if (error) console.error(error); });
  }
  toast('Pedido enviado', 'ok');
}
