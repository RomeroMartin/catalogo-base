// Pestaña Stock: edición rápida. Una fila por producto simple o por modelo; guarda al salir del campo.
import { supabase } from '../../supabase-client.js';
import { esc, on, toast } from '../../lib/dom.js';
import { claseStock } from './util.js';

export async function render(el) {
  const { data, error } = await supabase
    .from('productos').select('id,nombre,tiene_variantes,stock,disponible,modelos(id,nombre,stock,orden)').order('nombre');
  if (error) throw error;

  const filas = [];
  data.forEach((p) => {
    if (p.tiene_variantes) {
      [...p.modelos].sort((a, b) => a.orden - b.orden).forEach((m) => filas.push({ tabla: 'modelos', id: m.id, nombre: p.nombre, modelo: m.nombre, stock: m.stock, oculto: !p.disponible }));
    } else {
      filas.push({ tabla: 'productos', id: p.id, nombre: p.nombre, modelo: '', stock: p.stock, oculto: !p.disponible });
    }
  });

  el.innerHTML = `
    <h1 style="font-size:1.8rem;margin-bottom:var(--space-2)">Stock</h1>
    <p class="muted" style="margin-bottom:var(--space-4)">Cambiá la cantidad y salí del campo: se guarda sola. Rojo = sin stock, ámbar = quedan pocas, verde = hay.</p>
    <div class="field" style="max-width:360px;margin-bottom:var(--space-4)"><label class="sr-only" for="stock-buscar">Buscar</label><input class="input" id="stock-buscar" type="search" placeholder="Buscar producto…"></div>
    <div class="table-wrap"><table class="table" id="tabla-stock">
      <thead><tr><th>Producto</th><th>Modelo</th><th class="num">Stock</th></tr></thead>
      <tbody>${filas.map((f) => `
        <tr data-tabla="${f.tabla}" data-id="${esc(f.id)}" data-nombre="${esc((f.nombre + ' ' + f.modelo).toLowerCase())}">
          <td>${esc(f.nombre)}${f.oculto ? ' <span class="badge">Oculto</span>' : ''}</td>
          <td>${esc(f.modelo) || '<span class="muted">—</span>'}</td>
          <td class="num"><input class="input ${claseStock(f.stock)}" style="width:90px;text-align:right" type="number" min="0" step="1" inputmode="numeric" value="${f.stock}" data-previo="${f.stock}" aria-label="Stock de ${esc(f.nombre)} ${esc(f.modelo)}"></td>
        </tr>`).join('')}</tbody>
    </table></div>`;

  document.getElementById('stock-buscar').addEventListener('input', (ev) => {
    const q = ev.target.value.trim().toLowerCase();
    el.querySelectorAll('tbody tr').forEach((tr) => { tr.hidden = q && !tr.dataset.nombre.includes(q); });
  });

  on(el, 'change', 'input[type="number"]', async (_e, input) => {
    const tr = input.closest('tr');
    const valor = Number(input.value);
    if (!Number.isInteger(valor) || valor < 0) {
      toast('El stock tiene que ser un número entero, 0 o más', 'error');
      input.value = input.dataset.previo;
      return;
    }
    input.disabled = true;
    const { error: err } = await supabase.from(tr.dataset.tabla).update({ stock: valor }).eq('id', tr.dataset.id);
    input.disabled = false;
    if (err) {
      console.error(err);
      toast('No pudimos guardar el stock', 'error');
      input.value = input.dataset.previo;
      return;
    }
    input.dataset.previo = String(valor);
    input.className = `input ${claseStock(valor)}`;
    toast('Stock guardado', 'ok');
  });
}
