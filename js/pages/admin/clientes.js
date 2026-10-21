// ▒ PANEL — igual para todos los clientes (solo cambian colores y logo desde theme.css)
// Pestaña Clientes: lista con cantidad de pedidos, detalle con sus pedidos y exportación a Excel.
import { supabase } from '../../supabase-client.js';
import { esc, on, toast } from '../../lib/dom.js';
import { money, fecha } from '../../lib/format.js';
import { descargarXLSX } from '../../lib/xlsx.js';
import { ESTADOS, marcaTiempo, soloDigitos } from './util.js';

let clientes = [];
let pedidos = [];

function detalle(id) {
  const c = clientes.find((x) => x.id === id);
  const suyos = pedidos.filter((p) => p.cliente_id === id);
  const d = c.direccion ?? {};
  const dir = [`${d.calle ?? ''} ${d.numero ?? ''}`.trim(), d.ciudad, d.cp && `(${d.cp})`, d.provincia].filter(Boolean).join(', ');
  const tel = soloDigitos(c.telefono);
  return `
    <div class="panel stack" style="margin-top:var(--space-4)">
      <h2 style="font-size:1.3rem">${esc(c.nombre ?? 'Sin nombre')}</h2>
      <p class="muted">${esc(c.email ?? '')} · ${esc(c.telefono ?? '')}${dir ? ` · ${esc(dir)}` : ''}</p>
      ${tel ? `<div><a class="btn btn-whatsapp btn-sm" href="https://wa.me/${tel}" target="_blank" rel="noopener">Escribir por WhatsApp</a></div>` : ''}
      <h3 style="font-size:1rem;font-family:var(--font-body)">Pedidos (${suyos.length})</h3>
      ${suyos.length ? `<ul style="list-style:none;padding:0;display:grid;gap:var(--space-2)">${suyos.map((p) => {
        const [t, clase] = ESTADOS[p.estado] ?? [p.estado, ''];
        return `<li class="row" style="justify-content:space-between"><span><strong>${esc(p.codigo)}</strong> <span class="muted">${esc(fecha(p.creado))}</span></span><span><span class="badge ${clase}">${esc(t)}</span> ${money(p.total)}</span></li>`;
      }).join('')}</ul>` : '<p class="muted">Todavía no hizo pedidos.</p>'}
    </div>`;
}

export async function render(el) {
  const [cli, ped] = await Promise.all([
    supabase.from('clientes').select('*').order('creado', { ascending: false }),
    supabase.from('pedidos').select('id,codigo,cliente_id,creado,total,estado').order('creado', { ascending: false }),
  ]);
  if (cli.error) throw cli.error;
  if (ped.error) throw ped.error;
  clientes = cli.data; pedidos = ped.data;
  const cantidad = (id) => pedidos.filter((p) => p.cliente_id === id).length;

  el.innerHTML = `
    <div class="section-head"><h1 style="font-size:1.8rem">Clientes</h1><button class="btn btn-sm" type="button" data-exportar>Exportar a Excel</button></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Alta</th><th class="num">Pedidos</th></tr></thead>
      <tbody>${clientes.length ? clientes.map((c) => `
        <tr data-id="${esc(c.id)}">
          <td><button class="btn btn-ghost btn-sm" type="button" data-ver>${esc(c.nombre ?? 'Sin nombre')}</button></td>
          <td>${esc(c.email ?? '')}</td><td>${esc(c.telefono ?? '')}</td><td>${esc(fecha(c.creado))}</td><td class="num">${cantidad(c.id)}</td>
        </tr>`).join('') : '<tr><td colspan="5"><div class="empty">Todavía no hay clientes.</div></td></tr>'}</tbody>
    </table></div>
    <div id="detalle-cliente"></div>`;

  on(el, 'click', '[data-ver]', (_e, b) => {
    const cont = el.querySelector('#detalle-cliente');
    cont.innerHTML = detalle(b.closest('tr').dataset.id);
    cont.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  on(el, 'click', '[data-exportar]', () => {
    if (!clientes.length) { toast('Todavía no hay clientes para exportar', 'error'); return; }
    descargarXLSX(`clientes_${marcaTiempo()}.xlsx`, {
      hoja: 'Clientes', tabla: 'Clientes',
      columnas: [{ titulo: 'Nombre' }, { titulo: 'Email' }, { titulo: 'Teléfono' }, { titulo: 'Alta', tipo: 'dia' }, { titulo: 'Pedidos', tipo: 'numero' }],
      filas: clientes.map((c) => [c.nombre, c.email, c.telefono, c.creado, cantidad(c.id)]),
    });
  });
}
