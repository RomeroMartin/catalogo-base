// Pestaña Pedidos: filtros, detalle, cambio de estado (el trigger de la base ajusta el stock) y exportación a Excel.
import { supabase } from '../../supabase-client.js';
import { esc, on, toast } from '../../lib/dom.js';
import { money } from '../../lib/format.js';
import { descargarXLSX } from '../../lib/xlsx.js';
import { ESTADOS, fechaHora, soloDigitos } from './util.js';

let pedidos = [];
let filtroEstado = '';
let filtroTexto = '';

const visibles = () => {
  const q = filtroTexto.trim().toLowerCase();
  return pedidos.filter((p) => (!filtroEstado || p.estado === filtroEstado) &&
    (!q || `${p.codigo} ${p.cliente_nombre ?? ''} ${p.cliente_email ?? ''}`.toLowerCase().includes(q)));
};

const textoDireccion = (p) => {
  if (p.metodo_entrega !== 'envio') return 'Retiro por el local';
  const d = p.direccion_envio ?? {};
  return 'Envío a ' + ([`${d.calle ?? ''} ${d.numero ?? ''}`.trim(), d.ciudad, d.cp && `(${d.cp})`, d.provincia].filter(Boolean).join(', ') || '(sin dirección)');
};

function pintar(cont) {
  const lista = visibles();
  cont.innerHTML = lista.length ? lista.map((p) => {
    const [texto, clase] = ESTADOS[p.estado] ?? [p.estado, ''];
    const tel = soloDigitos(p.cliente_telefono);
    return `
      <details class="order order-admin" data-id="${esc(p.id)}">
        <summary>
          <strong>${esc(p.codigo)}</strong>
          <span>${esc(p.cliente_nombre ?? 'Sin nombre')}</span>
          <span class="muted">${esc(fechaHora(p.creado))}</span>
          <span class="badge ${clase}" data-badge>${esc(texto)}</span>
          <strong>${money(p.total)}</strong>
        </summary>
        <div class="order-detail">
          <ul style="list-style:none;padding:0;display:grid;gap:var(--space-2)">
            ${p.pedido_items.map((i) => `<li><span>${esc(i.nombre)}${i.modelo ? ` — ${esc(i.modelo)}` : ''} <span class="muted">x${i.cantidad}</span></span><span>${money(i.subtotal)}</span></li>`).join('')}
          </ul>
          <p class="muted">${esc(textoDireccion(p))}</p>
          ${p.notas ? `<p class="muted">Notas: ${esc(p.notas)}</p>` : ''}
          <p class="muted">${esc(p.cliente_email ?? '')} · ${esc(p.cliente_telefono ?? '')}</p>
          <div class="row">
            <div class="field"><label for="est-${esc(p.id)}">Estado</label>
              <select class="select" id="est-${esc(p.id)}" data-estado data-previo="${esc(p.estado)}">
                ${Object.entries(ESTADOS).map(([k, [t]]) => `<option value="${k}" ${k === p.estado ? 'selected' : ''}>${t}</option>`).join('')}
              </select></div>
            ${tel ? `<a class="btn btn-whatsapp btn-sm" href="https://wa.me/${tel}" target="_blank" rel="noopener">Escribir por WhatsApp</a>` : ''}
          </div>
          <p class="field-hint">Al pasar a <strong>Confirmado</strong> se descuenta el stock; al <strong>Cancelar</strong> se repone.</p>
        </div>
      </details>`;
  }).join('') : '<div class="empty"><span class="emoji" aria-hidden="true">📦</span>No hay pedidos con esos filtros.</div>';
}

// Exporta a Excel (.xlsx, como tabla) los pedidos que se están viendo con los filtros actuales
function exportar() {
  const lista = visibles();
  if (!lista.length) { toast('No hay pedidos para exportar con esos filtros', 'error'); return; }
  descargarXLSX(`pedidos-${new Date().toISOString().slice(0, 10)}.xlsx`, {
    hoja: 'Pedidos', tabla: 'Pedidos',
    columnas: [
      { titulo: 'Código' }, { titulo: 'Fecha', tipo: 'fecha' }, { titulo: 'Cliente' }, { titulo: 'Email' }, { titulo: 'Teléfono' },
      { titulo: 'Estado' }, { titulo: 'Entrega' }, { titulo: 'Total', tipo: 'moneda' }, { titulo: 'Productos' },
    ],
    filas: lista.map((p) => [
      p.codigo, p.creado, p.cliente_nombre, p.cliente_email, p.cliente_telefono,
      ESTADOS[p.estado]?.[0] ?? p.estado, textoDireccion(p), p.total,
      p.pedido_items.map((i) => `${i.nombre}${i.modelo ? ` (${i.modelo})` : ''} x${i.cantidad}`).join(' | '),
    ]),
  });
}

export async function render(el) {
  filtroEstado = ''; filtroTexto = '';
  const { data, error } = await supabase.from('pedidos').select('*, pedido_items(*)').order('creado', { ascending: false }).limit(500);
  if (error) throw error;
  pedidos = data;

  el.innerHTML = `
    <div class="section-head"><h1 style="font-size:1.8rem">Pedidos</h1><button class="btn btn-sm" type="button" data-exportar>Exportar a Excel</button></div>
    <div class="toolbar">
      <div class="field"><label class="sr-only" for="ped-buscar">Buscar</label><input class="input" id="ped-buscar" type="search" placeholder="Buscar por código o cliente…"></div>
      <div class="field"><label class="sr-only" for="ped-estado">Estado</label>
        <select class="select" id="ped-estado"><option value="">Todos los estados</option>${Object.entries(ESTADOS).map(([k, [t]]) => `<option value="${k}">${t}</option>`).join('')}</select></div>
    </div>
    <div id="lista-pedidos-admin"></div>`;
  const cont = el.querySelector('#lista-pedidos-admin');
  pintar(cont);

  el.querySelector('#ped-buscar').addEventListener('input', (ev) => { filtroTexto = ev.target.value; pintar(cont); });
  el.querySelector('#ped-estado').addEventListener('change', (ev) => { filtroEstado = ev.target.value; pintar(cont); });
  on(el, 'click', '[data-exportar]', exportar);

  on(el, 'change', '[data-estado]', async (_e, sel) => {
    const id = sel.closest('details').dataset.id;
    const p = pedidos.find((x) => x.id === id);
    sel.disabled = true;
    const { error: err } = await supabase.from('pedidos').update({ estado: sel.value }).eq('id', id);
    sel.disabled = false;
    if (err) { console.error(err); sel.value = sel.dataset.previo; toast('No pudimos cambiar el estado', 'error'); return; }
    p.estado = sel.value;
    sel.dataset.previo = sel.value;
    const [texto, clase] = ESTADOS[p.estado];
    const badge = sel.closest('details').querySelector('[data-badge]');
    badge.textContent = texto; badge.className = `badge ${clase}`;
    toast(`Pedido ${p.codigo}: ${texto}`, 'ok');
  });
}
