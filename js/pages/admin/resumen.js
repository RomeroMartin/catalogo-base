// Pestaña Resumen: tarjetas, ventas de los últimos 6 meses, más vendidos y pedidos por estado.
import { supabase } from '../../supabase-client.js';
import { esc } from '../../lib/dom.js';
import { money } from '../../lib/format.js';
import { ESTADOS } from './util.js';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Últimos 6 meses (incluido el actual) como { clave: 'YYYY-MM', etiqueta }
function ultimosMeses(n = 6) {
  const hoy = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - (n - 1 - i), 1));
    return { clave: d.toISOString().slice(0, 7), etiqueta: MESES[d.getUTCMonth()] };
  });
}

export async function render(el) {
  const [ventas, top, pedidos, productos] = await Promise.all([
    supabase.from('v_ventas_mensuales').select('mes,pedidos,total'),
    supabase.from('v_mas_vendidos').select('nombre,unidades,total').order('unidades', { ascending: false }).limit(5),
    supabase.from('pedidos').select('estado'),
    supabase.from('productos').select('id,tiene_variantes,stock,modelos(stock)'),
  ]);
  const fallo = [ventas, top, pedidos, productos].find((r) => r.error);
  if (fallo) throw fallo.error;

  const porMes = new Map(ventas.data.map((v) => [String(v.mes).slice(0, 7), Number(v.total)]));
  const meses = ultimosMeses().map((m) => ({ ...m, total: porMes.get(m.clave) ?? 0 }));
  const maximo = Math.max(...meses.map((m) => m.total), 1);
  const mesActual = meses[meses.length - 1];

  const conteo = Object.fromEntries(Object.keys(ESTADOS).map((k) => [k, 0]));
  pedidos.data.forEach((p) => { conteo[p.estado] = (conteo[p.estado] ?? 0) + 1; });

  const sinStock = productos.data.filter((p) => (p.tiene_variantes ? p.modelos.every((m) => m.stock <= 0) : p.stock <= 0)).length;

  el.innerHTML = `
    <h1 style="font-size:1.8rem;margin-bottom:var(--space-4)">Resumen</h1>
    <div class="stats">
      <div class="stat"><div class="muted">Ventas del mes</div><div class="n">${money(mesActual.total)}</div></div>
      <div class="stat"><div class="muted">Pedidos pendientes</div><div class="n">${conteo.pendiente}</div></div>
      <div class="stat"><div class="muted">Productos</div><div class="n">${productos.data.length}</div></div>
      <div class="stat"><div class="muted">Sin stock</div><div class="n ${sinStock ? 'stock-0' : ''}">${sinStock}</div></div>
    </div>

    <h2 style="font-size:1.2rem;margin:var(--space-6) 0 var(--space-3)">Ventas de los últimos 6 meses</h2>
    <div class="bars" role="img" aria-label="Ventas por mes: ${meses.map((m) => `${m.etiqueta} ${money(m.total)}`).join(', ')}">
      ${meses.map((m) => `<div class="bar" title="${esc(money(m.total))}"><i style="height:${Math.max((m.total / maximo) * 100, m.total ? 4 : 1)}%"></i>${m.etiqueta}</div>`).join('')}
    </div>
    <p class="muted" style="margin-top:var(--space-2);font-size:.85rem">No se cuentan los pedidos cancelados.</p>

    <h2 style="font-size:1.2rem;margin:var(--space-6) 0 var(--space-3)">Los 5 más vendidos</h2>
    ${top.data.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Producto</th><th class="num">Unidades</th><th class="num">Total</th></tr></thead>
      <tbody>${top.data.map((t) => `<tr><td>${esc(t.nombre)}</td><td class="num">${t.unidades}</td><td class="num">${money(t.total)}</td></tr>`).join('')}</tbody>
    </table></div>` : '<p class="muted">Todavía no hay ventas.</p>'}

    <h2 style="font-size:1.2rem;margin:var(--space-6) 0 var(--space-3)">Pedidos por estado</h2>
    <div class="row">${Object.entries(ESTADOS).map(([k, [texto, clase]]) => `<span class="badge ${clase}">${texto}: ${conteo[k]}</span>`).join('')}</div>`;
}
