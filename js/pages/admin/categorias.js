// Pestaña Categorías: alta, edición, orden con ↑↓, activar/desactivar y borrado.
import { supabase } from '../../supabase-client.js';
import { esc, on, toast, cerrarModal } from '../../lib/dom.js';
import { slugify } from '../../lib/format.js';
import { invalidarStore } from '../../lib/store.js';
import { abrirDialogo, confirmar, conCarga } from './util.js';

let cont = null;
let categorias = [];

async function cargar() {
  const { data, error } = await supabase.from('categorias').select('*').order('orden').order('id');
  if (error) throw error;
  categorias = data;
}

function pintar() {
  cont.innerHTML = categorias.length ? `
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Orden</th><th>Categoría</th><th>Slug</th><th>Activa</th><th></th></tr></thead>
      <tbody>${categorias.map((c, i) => `
        <tr data-id="${c.id}">
          <td style="white-space:nowrap">
            <button class="btn btn-ghost btn-sm" type="button" data-mover="-1" aria-label="Subir ${esc(c.nombre)}" ${i === 0 ? 'disabled' : ''}><span aria-hidden="true">↑</span></button>
            <button class="btn btn-ghost btn-sm" type="button" data-mover="1" aria-label="Bajar ${esc(c.nombre)}" ${i === categorias.length - 1 ? 'disabled' : ''}><span aria-hidden="true">↓</span></button>
          </td>
          <td><span class="badge" style="background:${esc(c.color || 'transparent')}">${esc(c.emoji ?? '')} ${esc(c.nombre)}</span></td>
          <td class="muted">${esc(c.slug)}</td>
          <td><label class="check"><input type="checkbox" data-activa ${c.activa ? 'checked' : ''} aria-label="Activa: ${esc(c.nombre)}"><span class="sr-only">Activa</span></label></td>
          <td style="white-space:nowrap"><button class="btn btn-sm" type="button" data-editar>Editar</button> <button class="btn btn-sm btn-ghost" type="button" data-eliminar>Eliminar</button></td>
        </tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty">Todavía no hay categorías. Creá la primera.</div>';
}

function abrirFormulario(cat = null) {
  const nueva = !cat;
  const c = cat ?? { nombre: '', slug: '', color: '#F4E1D2', emoji: '', activa: true };
  let slugManual = !nueva; // al editar, el slug no se toca solo
  const el = abrirDialogo({
    titulo: nueva ? 'Nueva categoría' : 'Editar categoría',
    formId: 'form-categoria',
    cuerpo: `
      <div class="field" data-campo="nombre"><label for="k-nombre">Nombre</label><input class="input" id="k-nombre" name="nombre" value="${esc(c.nombre)}" required><span class="field-error" role="alert"></span></div>
      <div class="field" data-campo="slug"><label for="k-slug">Slug (para el link)</label><input class="input" id="k-slug" name="slug" value="${esc(c.slug)}" required><span class="field-hint">Se arma solo con el nombre. Solo minúsculas, números y guiones.</span><span class="field-error" role="alert"></span></div>
      <div class="field"><label for="k-emoji">Emoji</label><input class="input" id="k-emoji" name="emoji" value="${esc(c.emoji ?? '')}" maxlength="8"></div>
      <div class="field"><label for="k-color">Color</label><input class="input" id="k-color" name="color" type="color" value="${esc(c.color || '#F4E1D2')}" style="padding:4px"></div>
      <label class="check"><input type="checkbox" name="activa" ${c.activa ? 'checked' : ''}> Activa (se muestra en el sitio)</label>
      <div class="form-error hidden" id="msg-cat" role="alert"></div>`,
    pie: '<button class="btn" type="button" data-cerrar>Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button>',
  });
  const form = el.querySelector('#form-categoria');
  form.elements.nombre.addEventListener('input', () => { if (!slugManual) form.elements.slug.value = slugify(form.elements.nombre.value); });
  form.elements.slug.addEventListener('input', () => { slugManual = true; });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const marcar = (k, t) => { const f = form.querySelector(`[data-campo="${k}"]`); f.classList.toggle('has-error', !!t); f.querySelector('.field-error').textContent = t || ''; };
    const msg = el.querySelector('#msg-cat'); msg.classList.add('hidden');
    const nombre = form.elements.nombre.value.trim();
    const slug = slugify(form.elements.slug.value);
    marcar('nombre', ''); marcar('slug', '');
    let ok = true;
    if (!nombre) { marcar('nombre', 'Ingresá el nombre.'); ok = false; }
    if (!slug) { marcar('slug', 'Ingresá un slug válido.'); ok = false; }
    if (!ok) return;
    await conCarga(form.querySelector('button[type="submit"]'), async () => {
      const fila = { nombre, slug, emoji: form.elements.emoji.value.trim() || null, color: form.elements.color.value, activa: form.elements.activa.checked };
      const r = nueva
        ? await supabase.from('categorias').insert({ ...fila, orden: Math.max(0, ...categorias.map((x) => x.orden)) + 1 })
        : await supabase.from('categorias').update(fila).eq('id', cat.id);
      if (r.error) {
        console.error(r.error);
        msg.textContent = r.error.code === '23505' ? 'Ya existe una categoría con ese nombre o slug.' : 'No pudimos guardar la categoría. Probá de nuevo.';
        msg.classList.remove('hidden');
        return;
      }
      invalidarStore();
      cerrarModal(el);
      toast('Categoría guardada', 'ok');
      await recargar();
    });
  });
}

async function recargar() { await cargar(); pintar(); }

// Intercambia el orden con la vecina (se renumera todo para evitar empates)
async function mover(id, delta) {
  const i = categorias.findIndex((c) => c.id === id);
  const j = i + delta;
  if (j < 0 || j >= categorias.length) return;
  const nuevo = [...categorias];
  [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
  const cambios = nuevo.map((c, idx) => ({ c, orden: idx + 1 })).filter(({ c, orden }) => c.orden !== orden);
  const resultados = await Promise.all(cambios.map(({ c, orden }) => supabase.from('categorias').update({ orden }).eq('id', c.id)));
  if (resultados.some((r) => r.error)) { toast('No pudimos cambiar el orden', 'error'); }
  invalidarStore();
  await recargar();
}

async function eliminar(id) {
  const c = categorias.find((x) => x.id === id);
  const { count, error } = await supabase.from('productos').select('id', { count: 'exact', head: true }).eq('categoria_id', id);
  if (error) { console.error(error); toast('No pudimos revisar la categoría', 'error'); return; }
  if (count > 0) {
    toast(`"${c.nombre}" tiene ${count} producto${count === 1 ? '' : 's'}. No se puede borrar: desactivala o mové sus productos a otra categoría.`, 'error');
    return;
  }
  if (!(await confirmar(`¿Eliminar la categoría "${c.nombre}"?`))) return;
  const r = await supabase.from('categorias').delete().eq('id', id);
  if (r.error) { console.error(r.error); toast('No pudimos eliminar la categoría', 'error'); return; }
  invalidarStore();
  toast('Categoría eliminada', 'ok');
  await recargar();
}

export async function render(el) {
  await cargar();
  el.innerHTML = `
    <div class="section-head"><h1 style="font-size:1.8rem">Categorías</h1><button class="btn btn-primary" type="button" data-nueva>+ Nueva categoría</button></div>
    <div id="lista-categorias"></div>`;
  cont = el.querySelector('#lista-categorias');
  pintar();

  on(el, 'click', '[data-nueva]', () => abrirFormulario());
  on(el, 'click', '[data-editar]', (_e, b) => abrirFormulario(categorias.find((c) => c.id === Number(b.closest('tr').dataset.id))));
  on(el, 'click', '[data-eliminar]', (_e, b) => eliminar(Number(b.closest('tr').dataset.id)));
  on(el, 'click', '[data-mover]', (_e, b) => mover(Number(b.closest('tr').dataset.id), Number(b.dataset.mover)));
  on(el, 'change', '[data-activa]', async (_e, chk) => {
    const c = categorias.find((x) => x.id === Number(chk.closest('tr').dataset.id));
    const r = await supabase.from('categorias').update({ activa: chk.checked }).eq('id', c.id);
    if (r.error) { console.error(r.error); chk.checked = !chk.checked; toast('No pudimos guardar el cambio', 'error'); return; }
    c.activa = chk.checked; invalidarStore(); toast('Guardado', 'ok');
  });
}
