// ▒ PANEL — igual para todos los clientes (solo cambian colores y logo desde theme.css)
// Utilidades compartidas por las pestañas del panel.
import { esc, on, abrirModal, cerrarModal } from '../../lib/dom.js';

export const ESTADOS = {
  pendiente: ['Pendiente', 'badge-warn'],
  confirmado: ['Confirmado', 'badge-primary'],
  enviado: ['Enviado', 'badge-primary'],
  entregado: ['Entregado', 'badge-ok'],
  cancelado: ['Cancelado', 'badge-danger'],
};

export function fechaHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Nivel de stock → clase de color (0 rojo, ≤3 ámbar, resto verde)
export const claseStock = (n) => (n <= 0 ? 'stock-0' : n <= 3 ? 'stock-low' : 'stock-ok');

// Deshabilita el botón mientras corre la tarea (anti doble clic)
export async function conCarga(boton, tarea) {
  if (boton.disabled) return;
  boton.disabled = true;
  boton.classList.add('is-loading');
  try { return await tarea(); } finally { boton.disabled = false; boton.classList.remove('is-loading'); }
}

// Diálogo genérico. Devuelve el elemento .modal; se elimina del DOM al cerrarse.
export function abrirDialogo({ titulo, cuerpo, pie = '', formId = '', alCerrar = null }) {
  const el = document.createElement('div');
  el.className = 'modal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', titulo);
  const interior = `<div class="modal-body stack">${cuerpo}</div>${pie ? `<div class="modal-foot">${pie}</div>` : ''}`;
  el.innerHTML = `
    <div class="modal-head"><h2 style="font-size:1.3rem">${esc(titulo)}</h2>
      <button class="icon-btn" type="button" data-cerrar aria-label="Cerrar"><span aria-hidden="true">✕</span></button></div>
    ${formId ? `<form id="${formId}" novalidate>${interior}</form>` : interior}`;
  document.body.append(el);
  on(el, 'click', '[data-cerrar]', () => cerrarModal(el));
  abrirModal(el, { onClose: () => { if (alCerrar) alCerrar(); setTimeout(() => el.remove(), 300); } });
  return el;
}

// Confirmación de acciones destructivas. Devuelve una promesa con true/false.
export function confirmar(texto, { si = 'Eliminar', peligro = true } = {}) {
  return new Promise((resolver) => {
    let decidido = false;
    const el = abrirDialogo({
      titulo: 'Confirmá la acción',
      cuerpo: `<p>${esc(texto)}</p>`,
      pie: `<button class="btn" type="button" data-no>Cancelar</button><button class="btn ${peligro ? 'btn-danger' : 'btn-primary'}" type="button" data-si>${esc(si)}</button>`,
    });
    const fin = (valor) => { decidido = true; resolver(valor); cerrarModal(el); };
    on(el, 'click', '[data-si]', () => fin(true));
    on(el, 'click', '[data-no]', () => fin(false));
    // Si se cierra con Esc / clic afuera / ✕, cuenta como "no"
    const obs = new MutationObserver(() => { if (!el.classList.contains('is-open') && !decidido) { decidido = true; resolver(false); obs.disconnect(); } });
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  });
}

// Marca de fecha y hora para nombres de archivo: 2026-10-21_1530
export function marcaTiempo() {
  const d = new Date(), z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}`;
}

export const soloDigitos = (s) => String(s ?? '').replace(/\D/g, '');

export const errorAmable = (err, porDefecto = 'No pudimos completar la operación. Probá de nuevo.') => {
  console.error(err);
  return porDefecto;
};
