// Contenido del drawer del carrito: líneas, cantidades, total y botón de confirmar.
import { $, esc, on } from '../lib/dom.js';
import { money } from '../lib/format.js';
import { mediaHTML, emojiSiFalla } from './producto-card.js';
import { rehidratar, cambiarQty, quitar } from '../lib/cart.js';
import { abrirCheckout } from '../lib/checkout.js';
import { cerrarModal } from '../lib/dom.js';

let pintando = 0; // número de pintado en curso: descarta respuestas viejas
let avisosAbiertos = []; // avisos de esta apertura del drawer (se ajustan solos y no deben perderse al repintar)

export async function pintarCarrito() {
  const cuerpo = $('#cart-body'), pie = $('#cart-foot');
  if (!cuerpo) return;
  const turno = ++pintando;
  try {
    const { lineas, avisos: nuevos, total } = await rehidratar();
    // Los avisos se guardan ANTES de descartar respuestas viejas: el ajuste de stock repinta el drawer y no deben perderse
    const avisos = avisosAbiertos = [...new Set([...avisosAbiertos, ...nuevos])];
    if (turno !== pintando) return;

    const aviso = avisos.length
      ? `<div class="form-error" role="status" style="margin-bottom:var(--space-3)">${avisos.map(esc).join('<br>')}</div>` : '';

    if (!lineas.length) {
      cuerpo.innerHTML = `${aviso}<div class="empty"><span class="emoji" aria-hidden="true">🛒</span>Tu carrito está vacío.<br><a href="${document.documentElement.dataset.root || ''}catalogo.html">Ver el catálogo</a></div>`;
      pie.innerHTML = '';
      return;
    }

    cuerpo.innerHTML = aviso + lineas.map((l) => `
      <div class="cart-line" data-clave="${esc(l.clave)}">
        <div class="thumb">${mediaHTML(l.producto, 'thumb', 64)}</div>
        <div>
          <div class="name">${esc(l.producto.nombre)}</div>
          ${l.modelo ? `<div class="variant">${esc(l.modelo.nombre)}</div>` : ''}
          <div class="variant">${money(l.precio)} c/u</div>
          <div class="row" style="gap:var(--space-2);margin-top:var(--space-1)">
            <div class="qty" role="group" aria-label="Cantidad de ${esc(l.nombre)}">
              <button type="button" data-menos aria-label="Una menos"><span aria-hidden="true">−</span></button>
              <output aria-live="polite">${l.qty}</output>
              <button type="button" data-mas aria-label="Una más" ${l.qty >= l.stock ? 'disabled' : ''}><span aria-hidden="true">+</span></button>
            </div>
            <button class="btn btn-ghost btn-sm" type="button" data-quitar>Quitar</button>
          </div>
        </div>
        <strong>${money(l.subtotal)}</strong>
      </div>`).join('');

    pie.innerHTML = `
      <div class="cart-total"><span>Total</span><span>${money(total)}</span></div>
      <button class="btn btn-primary btn-lg btn-block" type="button" data-confirmar>Confirmar pedido</button>`;
    emojiSiFalla(cuerpo);
  } catch (err) {
    console.error('No se pudo cargar el carrito', err);
    if (turno === pintando) cuerpo.innerHTML = '<div class="empty">No pudimos cargar tu carrito. Probá de nuevo en un momento.</div>';
  }
}

export function initCartUI() {
  const drawer = $('#cart-drawer');
  if (!drawer) return;

  on(drawer, 'click', '[data-mas]', (_e, el) => {
    const clave = el.closest('[data-clave]').dataset.clave;
    const qty = Number(el.closest('.qty').querySelector('output').textContent);
    cambiarQty(clave, qty + 1);
  });
  on(drawer, 'click', '[data-menos]', (_e, el) => {
    const clave = el.closest('[data-clave]').dataset.clave;
    const qty = Number(el.closest('.qty').querySelector('output').textContent);
    cambiarQty(clave, qty - 1);
  });
  on(drawer, 'click', '[data-quitar]', (_e, el) => quitar(el.closest('[data-clave]').dataset.clave));
  on(drawer, 'click', '[data-confirmar]', () => { cerrarModal(drawer); abrirCheckout(); });

  document.addEventListener('cart:open', () => { avisosAbiertos = []; pintarCarrito(); });
  document.addEventListener('cart:changed', () => { if (drawer.classList.contains('is-open')) pintarCarrito(); });
}
