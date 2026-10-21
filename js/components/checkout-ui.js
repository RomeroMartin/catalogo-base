// ░ SITIO — ventana de confirmación del pedido (HTML y estilos). Se puede rediseñar por cliente.
// La lógica (precios, stock, errores, WhatsApp) está en js/lib/pedido.js y NO se toca por un pedido de diseño.
import { $, esc, on, abrirModal, cerrarModal, toast } from '../lib/dom.js';
import { money } from '../lib/format.js';
import {
  CAMPOS_DIRECCION, prepararCheckout, validarEntrega, crearPedido, rehidratar,
  enlaceWhatsAppInvitado, enlaceWhatsAppPedido,
} from '../lib/pedido.js';

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

const resumenHTML = (lineas, total) => `
  <ul class="stack" style="list-style:none;padding:0">
    ${lineas.map((l) => `<li class="row" style="justify-content:space-between;flex-wrap:nowrap">
      <span>${esc(l.producto.nombre)}${l.modelo ? ` — ${esc(l.modelo.nombre)}` : ''} <span class="muted">x${l.qty}</span></span>
      <strong>${money(l.subtotal)}</strong></li>`).join('')}
  </ul>
  <div class="cart-total" style="margin-top:var(--space-4)"><span>Total</span><span>${money(total)}</span></div>`;

const cabecera = (titulo) =>
  `<div class="modal-head"><h2 style="font-size:1.3rem">${titulo}</h2><button class="icon-btn" type="button" data-cerrar aria-label="Cerrar"><span aria-hidden="true">✕</span></button></div>`;

const avisosHTML = (avisos, role = '') => (avisos.length ? `<p class="form-error"${role ? ` role="${role}"` : ''}>${avisos.map(esc).join('<br>')}</p>` : '');

// ── Punto de entrada ──
export async function abrirCheckout() {
  const m = getModal();
  m.innerHTML = `${cabecera('Confirmar pedido')}<div class="modal-body"><div class="skeleton" style="height:160px"></div></div>`;
  abrirModal(m);

  let ctx;
  try {
    ctx = await prepararCheckout();
  } catch (err) {
    console.error('No se pudo preparar el pedido', err);
    $('.modal-body', m).innerHTML = '<p class="form-error">No pudimos cargar tu carrito. Probá de nuevo en un momento.</p>';
    return;
  }
  if (!ctx.datos.lineas.length) {
    $('.modal-body', m).innerHTML = `${avisosHTML(ctx.datos.avisos)}<p class="empty">Tu carrito está vacío.</p>`;
    return;
  }
  if (!ctx.usuario) vistaInvitado(m, ctx);
  else vistaCliente(m, ctx);
}

// ── Invitado: ingresar o seguir sin cuenta por WhatsApp (no se guarda el pedido) ──
function vistaInvitado(m, { datos, config }) {
  m.innerHTML = `${cabecera('Confirmar pedido')}
    <div class="modal-body stack">
      ${avisosHTML(datos.avisos)}
      ${resumenHTML(datos.lineas, datos.total)}
      <p class="muted">Con una cuenta guardamos tu pedido y podés ver su estado. También podés pedir directo por WhatsApp sin cuenta.</p>
    </div>
    <div class="modal-foot">
      <a class="btn btn-whatsapp" href="${esc(enlaceWhatsAppInvitado(config, datos))}" target="_blank" rel="noopener">Seguir sin cuenta por WhatsApp</a>
      <a class="btn btn-primary" href="${raiz}cuenta.html">Ingresar / Registrarme</a>
    </div>`;
}

// ── Cliente logueado: entrega, dirección, notas y confirmación ──
function vistaCliente(m, { datos, config, usuario, direccion: direccionPrevia }) {
  const campo = (id, label, extra = '') => `<div class="field" data-campo="${id}"><label for="d-${id}">${label}</label><input class="input" id="d-${id}" name="${id}" value="${esc(direccionPrevia[id] ?? '')}" ${extra}><span class="field-error" role="alert"></span></div>`;

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
  const pintarResumen = () => { $('#checkout-resumen', m).innerHTML = avisosHTML(actual.avisos, 'status') + resumenHTML(actual.lineas, actual.total); };
  pintarResumen();

  form.addEventListener('change', (ev) => {
    if (ev.target.name === 'entrega') $('#bloque-dir', m).classList.toggle('hidden', ev.target.value === 'retiro');
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('button[type="submit"]', form);
    if (btn.disabled) return;
    const entrega = form.elements.entrega.value;
    const direccion = Object.fromEntries(CAMPOS_DIRECCION.map((k) => [k, form.elements[k].value.trim()]));
    const notas = form.elements.notas.value.trim();

    form.querySelectorAll('[data-campo]').forEach((f) => { f.classList.remove('has-error'); $('.field-error', f).textContent = ''; });
    const errores = validarEntrega(entrega, direccion);
    Object.entries(errores).forEach(([k, msg]) => { const f = form.querySelector(`[data-campo="${k}"]`); f.classList.add('has-error'); $('.field-error', f).textContent = msg; });
    if (Object.keys(errores).length) return;

    btn.disabled = true; btn.classList.add('is-loading');
    const msgBox = $('#checkout-msg', m);
    msgBox.className = 'hidden';

    const r = await crearPedido({ lineas: actual.lineas, entrega, direccion, notas, usuario, direccionPrevia });
    if (r.ok) { exito(m, r.pedido, enlaceWhatsAppPedido(config, r.pedido, { entrega, direccion, notas })); return; }

    msgBox.className = 'form-error'; msgBox.setAttribute('role', 'alert'); msgBox.textContent = r.mensaje;
    try { actual = await rehidratar(); pintarResumen(); } catch { /* se deja el resumen anterior */ }
    btn.classList.remove('is-loading');
    btn.disabled = !actual.lineas.length;
  });
}

// ── Pedido guardado: pantalla de éxito con botón "Abrir WhatsApp" ──
function exito(m, pedido, href) {
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
  // Intento automático; en iOS puede bloquearse (después de un await), por eso existe el botón.
  try { window.open(href, '_blank', 'noopener'); } catch { /* el botón alcanza */ }
  toast('Pedido enviado', 'ok');
}
