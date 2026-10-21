// ▓ MOTOR — igual para todos los clientes; no se edita por un pedido de diseño (ver docs/GUIA-TECNICA-CORE.md)
// Utilidades de DOM: selectores, escape de texto, toasts, modales y delegación de eventos.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Escapa texto que viene de la base antes de ponerlo en innerHTML.
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// Delegación de eventos: on(contenedor, 'click', '[data-accion]', (ev, elemento) => ...)
export function on(el, evento, selector, handler) {
  el.addEventListener(evento, (ev) => {
    const objetivo = ev.target.closest(selector);
    if (objetivo && el.contains(objetivo)) handler(ev, objetivo);
  });
}

// ── Toasts (avisos breves, anunciados a lectores de pantalla) ──
export function toast(mensaje, tipo = '') {
  let caja = $('.toasts');
  if (!caja) {
    caja = document.createElement('div');
    caja.className = 'toasts';
    caja.setAttribute('aria-live', 'polite');
    document.body.append(caja);
  }
  const t = document.createElement('div');
  t.className = 'toast' + (tipo ? ` toast-${tipo}` : '');
  t.textContent = mensaje;
  caja.append(t);
  setTimeout(() => t.remove(), 4000);
}

// ── Modales y drawers (con foco atrapado, Esc y devolución del foco) ──
const FOCUSABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const abiertos = []; // pila de { el, opener, onKey }

function overlay() {
  let ov = $('.overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'overlay';
    ov.addEventListener('click', () => {
      const ultimo = abiertos[abiertos.length - 1];
      if (ultimo) cerrarModal(ultimo.el);
    });
    document.body.append(ov);
  }
  return ov;
}

// opciones.onClose se llama cada vez que el modal se cierra (botón, Esc o clic afuera).
export function abrirModal(el, opciones = {}) {
  if (abiertos.some((m) => m.el === el)) return;
  const opener = document.activeElement;
  const onKey = (ev) => {
    if (abiertos[abiertos.length - 1]?.el !== el) return;
    if (ev.key === 'Escape') { cerrarModal(el); return; }
    if (ev.key !== 'Tab') return;
    const items = $$(FOCUSABLES, el).filter((n) => n.offsetParent !== null);
    if (!items.length) { ev.preventDefault(); return; }
    const primero = items[0], ultimo = items[items.length - 1];
    if (ev.shiftKey && document.activeElement === primero) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primero.focus(); }
  };
  abiertos.push({ el, opener, onKey, onClose: opciones.onClose });
  document.addEventListener('keydown', onKey);
  overlay().classList.add('is-open');
  document.body.classList.add('no-scroll');
  el.classList.add('is-open');
  el.setAttribute('aria-modal', 'true');
  if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');
  const destino = $('[autofocus]', el) || $(FOCUSABLES, el) || el;
  if (destino === el) el.tabIndex = -1;
  destino.focus();
}

export function cerrarModal(el) {
  const i = abiertos.findIndex((m) => m.el === el);
  if (i === -1) return;
  const [{ opener, onKey, onClose }] = abiertos.splice(i, 1);
  document.removeEventListener('keydown', onKey);
  el.classList.remove('is-open');
  if (!abiertos.length) {
    overlay().classList.remove('is-open');
    document.body.classList.remove('no-scroll');
  }
  if (opener && typeof opener.focus === 'function') opener.focus();
  if (onClose) onClose();
}
