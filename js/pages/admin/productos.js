// Pestaña Productos: lista con filtros rápidos, alta/edición (con modelos) y baja.
// Guardado NO atómico, en este orden: 1) fotos nuevas (compresión + subida)  2) producto  3) modelos (diferencia por id).
import { supabase } from '../../supabase-client.js';
import { esc, on, toast, cerrarModal } from '../../lib/dom.js';
import { money } from '../../lib/format.js';
import { imgUrl } from '../../lib/image-url.js';
import { abrirDialogo, confirmar, conCarga, claseStock } from './util.js';
import { MAX_FOTOS, procesarImagen, subirFoto, borrarArchivos, rutasDe, kb } from '../../lib/image-upload.js';

let contenedor = null;
let productos = [];
let categorias = [];
let filtro = '';

const stockTotal = (p) => (p.tiene_variantes ? p.modelos.reduce((s, m) => s + m.stock, 0) : p.stock);

async function cargar() {
  const [prods, cats] = await Promise.all([
    supabase.from('productos').select('*, categoria:categorias(id,nombre), modelos(id,nombre,stock,orden)').order('orden').order('nombre'),
    supabase.from('categorias').select('id,nombre,activa').order('orden'),
  ]);
  if (prods.error) throw prods.error;
  if (cats.error) throw cats.error;
  productos = prods.data;
  categorias = cats.data;
}

// ── Lista ──
function pintarLista() {
  const q = filtro.trim().toLowerCase();
  const visibles = productos.filter((p) => !q || `${p.nombre} ${p.categoria?.nombre ?? ''}`.toLowerCase().includes(q));
  const tbody = contenedor.querySelector('tbody');
  tbody.innerHTML = visibles.length ? visibles.map((p) => {
    const portada = p.imagenes?.[0]?.thumb;
    const total = stockTotal(p);
    return `
      <tr data-id="${esc(p.id)}">
        <td>${portada ? `<img class="thumb-sm" src="${esc(imgUrl(portada))}" alt="" width="44" height="44" loading="lazy">` : `<span class="thumb-sm" style="display:inline-flex;align-items:center;justify-content:center" aria-hidden="true">${esc(p.emoji || '🛍️')}</span>`}</td>
        <td><strong>${esc(p.nombre)}</strong>${p.tiene_variantes ? ` <span class="badge badge-primary">${p.modelos.length} modelos</span>` : ''}</td>
        <td>${esc(p.categoria?.nombre ?? '')}</td>
        <td class="num">${money(p.precio)}</td>
        <td class="num ${claseStock(total)}">${total}</td>
        <td><label class="check"><input type="checkbox" data-toggle="disponible" ${p.disponible ? 'checked' : ''} aria-label="Disponible: ${esc(p.nombre)}"><span class="sr-only">Disponible</span></label></td>
        <td><label class="check"><input type="checkbox" data-toggle="destacado" ${p.destacado ? 'checked' : ''} aria-label="Destacado: ${esc(p.nombre)}"><span class="sr-only">Destacado</span></label></td>
        <td style="white-space:nowrap"><button class="btn btn-sm" type="button" data-editar>Editar</button> <button class="btn btn-sm btn-ghost" type="button" data-eliminar>Eliminar</button></td>
      </tr>`;
  }).join('') : `<tr><td colspan="8"><div class="empty">No hay productos${q ? ' con esa búsqueda' : ' todavía'}.</div></td></tr>`;
}

// ── Formulario ──
const filaModelo = (m = {}) => `
  <div class="row" data-fila-modelo data-id="${m.id ?? ''}" style="flex-wrap:nowrap">
    <input class="input" name="modelo-nombre" placeholder="Nombre del modelo" value="${esc(m.nombre ?? '')}" aria-label="Nombre del modelo" required>
    <input class="input" name="modelo-stock" type="number" min="0" step="1" inputmode="numeric" value="${m.stock ?? 0}" style="max-width:90px" aria-label="Stock del modelo">
    <button class="btn btn-ghost btn-sm" type="button" data-quitar-modelo aria-label="Quitar modelo"><span aria-hidden="true">✕</span></button>
  </div>`;

const campo = (id, label, control, hint = '') =>
  `<div class="field" data-campo="${id}"><label for="f-${id}">${label}</label>${control}${hint ? `<span class="field-hint">${hint}</span>` : ''}<span class="field-error" role="alert"></span></div>`;

function abrirFormulario(producto = null) {
  const esNuevo = !producto;
  let existe = !esNuevo; // ¿el producto ya está guardado en la base? (si un guardado falla a mitad, el reintento actualiza en vez de insertar)
  const p = producto ?? { id: crypto.randomUUID(), nombre: '', categoria_id: categorias[0]?.id, precio: 0, descripcion: '', descripcion_larga: '', orden: 0, destacado: false, disponible: true, tiene_variantes: false, stock: 0, modelos: [], emoji: '' };
  // Fotos: las que ya tiene el producto + las nuevas elegidas (se comprimen y suben recién al guardar)
  let fotos = (p.imagenes ?? []).map((im) => ({ id: crypto.randomUUID(), existente: im, archivo: null, preview: imgUrl(im.thumb), subida: null }));
  const removidas = []; // fotos existentes que se quitaron: sus archivos se borran después de guardar bien
  const modelosIniciales = p.tiene_variantes ? [...p.modelos].sort((a, b) => a.orden - b.orden) : [];

  const el = abrirDialogo({
    titulo: esNuevo ? 'Nuevo producto' : 'Editar producto',
    formId: 'form-producto',
    cuerpo: `
      ${campo('nombre', 'Nombre', `<input class="input" id="f-nombre" name="nombre" value="${esc(p.nombre)}" required>`)}
      ${campo('categoria', 'Categoría', `<select class="select" id="f-categoria" name="categoria">${categorias.map((c) => `<option value="${c.id}" ${c.id === p.categoria_id ? 'selected' : ''}>${esc(c.nombre)}${c.activa ? '' : ' (inactiva)'}</option>`).join('')}</select>`)}
      ${campo('precio', 'Precio ($, sin centavos)', `<input class="input" id="f-precio" name="precio" type="number" min="0" step="1" inputmode="numeric" value="${p.precio}" required>`)}
      ${campo('emoji', 'Emoji (se ve si no hay foto)', `<input class="input" id="f-emoji" name="emoji" value="${esc(p.emoji)}" maxlength="8">`)}
      ${campo('descripcion', 'Descripción corta', `<input class="input" id="f-descripcion" name="descripcion" value="${esc(p.descripcion)}">`)}
      ${campo('descripcion_larga', 'Descripción larga', `<textarea class="textarea" id="f-descripcion_larga" name="descripcion_larga">${esc(p.descripcion_larga ?? '')}</textarea>`)}
      ${campo('orden', 'Orden (menor = primero)', `<input class="input" id="f-orden" name="orden" type="number" step="1" inputmode="numeric" value="${p.orden}">`)}
      <label class="check"><input type="checkbox" name="disponible" ${p.disponible ? 'checked' : ''}> Disponible (visible en el catálogo)</label>
      <label class="check"><input type="checkbox" name="destacado" ${p.destacado ? 'checked' : ''}> Destacado (aparece en el inicio)</label>
      <label class="check"><input type="checkbox" name="tiene_variantes" ${p.tiene_variantes ? 'checked' : ''}> Tiene modelos (cada uno con su stock)</label>
      <div id="bloque-simple">${campo('stock', 'Stock', `<input class="input" id="f-stock" name="stock" type="number" min="0" step="1" inputmode="numeric" value="${p.stock}">`)}</div>
      <div id="bloque-modelos" class="stack">
        <span class="label">Modelos (mínimo 2)</span>
        <div id="lista-modelos" class="stack">${(modelosIniciales.length ? modelosIniciales : [{}, {}]).map(filaModelo).join('')}</div>
        <div><button class="btn btn-sm" type="button" data-agregar-modelo>+ Agregar modelo</button></div>
        <span class="field-error" id="error-modelos" role="alert"></span>
      </div>
      <div class="stack" id="bloque-fotos">
        <span class="label">Fotos <span class="muted" id="cuenta-fotos"></span></span>
        <div class="photos" id="grilla-fotos"></div>
        <label class="dropzone" id="zona-fotos" for="f-fotos"><input class="sr-only" id="f-fotos" type="file" accept="image/*" multiple><span>Tocá para elegir fotos o arrastralas acá<br><span class="muted" style="font-size:.85rem">La primera es la portada. Se achican solas antes de subirse.</span></span></label>
        <div class="muted" id="progreso-fotos" role="status" aria-live="polite"></div>
      </div>
      <div class="form-error hidden" id="msg-producto" role="alert"></div>`,
    pie: `<button class="btn" type="button" data-cerrar>Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button>`,
    alCerrar: () => fotos.forEach((f) => { if (f.archivo) URL.revokeObjectURL(f.preview); }),
  });

  const form = el.querySelector('#form-producto');
  const grilla = el.querySelector('#grilla-fotos');
  const progreso = (texto) => { el.querySelector('#progreso-fotos').textContent = texto; };

  function pintarFotos() {
    el.querySelector('#cuenta-fotos').textContent = `(${fotos.length} de ${MAX_FOTOS})`;
    grilla.innerHTML = fotos.map((f, i) => `
      <div class="photo" data-fid="${f.id}">
        <img src="${esc(f.preview)}" alt="Foto ${i + 1}${i === 0 ? ' (portada)' : ''}" width="110" height="110">
        ${i === 0 ? '<span class="badge badge-primary" style="position:absolute;top:4px;left:4px">Portada</span>' : ''}
        ${f.archivo ? '<span class="badge" style="position:absolute;top:4px;right:4px">Nueva</span>' : ''}
        <div class="photo-tools">
          <span>
            <button class="btn btn-ghost btn-sm" type="button" data-foto-sube aria-label="Subir foto ${i + 1}" ${i === 0 ? 'disabled' : ''}><span aria-hidden="true">↑</span></button>
            <button class="btn btn-ghost btn-sm" type="button" data-foto-baja aria-label="Bajar foto ${i + 1}" ${i === fotos.length - 1 ? 'disabled' : ''}><span aria-hidden="true">↓</span></button>
          </span>
          <button class="btn btn-ghost btn-sm" type="button" data-foto-quitar aria-label="Quitar foto ${i + 1}"><span aria-hidden="true">✕</span></button>
        </div>
      </div>`).join('');
  }

  function agregarArchivos(lista) {
    const imagenes = [...lista].filter((a) => a.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(a.name));
    const lugar = MAX_FOTOS - fotos.length;
    if (imagenes.length > lugar) toast(`Máximo ${MAX_FOTOS} fotos por producto`, 'error');
    imagenes.slice(0, Math.max(lugar, 0)).forEach((archivo) => fotos.push({ id: crypto.randomUUID(), existente: null, archivo, preview: URL.createObjectURL(archivo), subida: null }));
    pintarFotos();
  }

  pintarFotos();
  el.querySelector('#f-fotos').addEventListener('change', (ev) => { agregarArchivos(ev.target.files); ev.target.value = ''; });
  const zona = el.querySelector('#zona-fotos');
  ['dragenter', 'dragover'].forEach((n) => zona.addEventListener(n, (ev) => { ev.preventDefault(); zona.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((n) => zona.addEventListener(n, (ev) => { ev.preventDefault(); zona.classList.remove('is-over'); }));
  zona.addEventListener('drop', (ev) => agregarArchivos(ev.dataTransfer.files));

  const indiceFoto = (b) => fotos.findIndex((f) => f.id === b.closest('[data-fid]').dataset.fid);
  const mover = (i, delta) => { const j = i + delta; if (j < 0 || j >= fotos.length) return; [fotos[i], fotos[j]] = [fotos[j], fotos[i]]; pintarFotos(); };
  on(el, 'click', '[data-foto-sube]', (_e, b) => mover(indiceFoto(b), -1));
  on(el, 'click', '[data-foto-baja]', (_e, b) => mover(indiceFoto(b), 1));
  on(el, 'click', '[data-foto-quitar]', (_e, b) => {
    const [f] = fotos.splice(indiceFoto(b), 1);
    if (f.archivo) URL.revokeObjectURL(f.preview);
    if (f.existente) removidas.push(f.existente);
    pintarFotos();
  });
  const alternarBloques = () => {
    const v = form.elements.tiene_variantes.checked;
    el.querySelector('#bloque-simple').classList.toggle('hidden', v);
    el.querySelector('#bloque-modelos').classList.toggle('hidden', !v);
  };
  alternarBloques();
  form.elements.tiene_variantes.addEventListener('change', alternarBloques);

  on(el, 'click', '[data-agregar-modelo]', () => el.querySelector('#lista-modelos').insertAdjacentHTML('beforeend', filaModelo()));
  on(el, 'click', '[data-quitar-modelo]', (_e, b) => b.closest('[data-fila-modelo]').remove());

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const msg = el.querySelector('#msg-producto');
    msg.classList.add('hidden');
    const marcar = (id, texto) => { const f = form.querySelector(`[data-campo="${id}"]`); f.classList.toggle('has-error', !!texto); f.querySelector('.field-error').textContent = texto || ''; };
    ['nombre', 'precio', 'stock'].forEach((c) => marcar(c, ''));
    el.querySelector('#error-modelos').textContent = '';

    const v = form.elements;
    const variantes = v.tiene_variantes.checked;
    const nombre = v.nombre.value.trim(), precio = Number(v.precio.value), stock = Number(v.stock.value || 0);
    let ok = true;
    if (!nombre) { marcar('nombre', 'Ingresá el nombre.'); ok = false; }
    if (!Number.isInteger(precio) || precio < 0) { marcar('precio', 'El precio tiene que ser un número entero, 0 o más.'); ok = false; }
    if (!variantes && (!Number.isInteger(stock) || stock < 0)) { marcar('stock', 'El stock tiene que ser un número entero, 0 o más.'); ok = false; }

    const filas = variantes ? [...el.querySelectorAll('[data-fila-modelo]')].map((f, i) => ({
      id: f.dataset.id ? Number(f.dataset.id) : null,
      nombre: f.querySelector('[name="modelo-nombre"]').value.trim(),
      stock: Number(f.querySelector('[name="modelo-stock"]').value),
      orden: i + 1,
    })) : [];
    if (variantes) {
      const nombres = filas.map((m) => m.nombre.toLowerCase());
      let err = '';
      if (filas.length < 2) err = 'Cargá al menos 2 modelos.';
      else if (filas.some((m) => !m.nombre)) err = 'Todos los modelos necesitan nombre.';
      else if (new Set(nombres).size !== nombres.length) err = 'Dos modelos no pueden tener el mismo nombre.';
      else if (filas.some((m) => !Number.isInteger(m.stock) || m.stock < 0)) err = 'El stock de cada modelo tiene que ser un número entero, 0 o más.';
      if (err) { el.querySelector('#error-modelos').textContent = err; ok = false; }
    }
    if (!ok) return;

    await conCarga(btn, async () => {
      const subidasEstaVez = []; // fotos subidas en ESTE intento (si el producto no se guarda, se borran)
      try {
        // 1) Fotos nuevas: se comprimen y suben de a una (así no se agota la memoria en celulares viejos)
        const nuevasFotos = fotos.filter((f) => f.archivo && !f.subida);
        for (const [i, f] of nuevasFotos.entries()) {
          try {
            progreso(`Comprimiendo foto ${i + 1} de ${nuevasFotos.length}…`);
            const proc = await procesarImagen(f.archivo);
            progreso(`Subiendo foto ${i + 1} de ${nuevasFotos.length}… (${kb(proc.thumb.blob.size)} + ${kb(proc.full.blob.size)})`);
            f.subida = await subirFoto(p.id, proc);
            subidasEstaVez.push(f);
          } catch (errFoto) {
            console.error(errFoto);
            await borrarArchivos(rutasDe(subidasEstaVez.map((x) => x.subida)));
            subidasEstaVez.forEach((x) => { x.subida = null; });
            progreso('');
            msg.textContent = /No pudimos leer|sigue pesando/.test(errFoto.message) ? errFoto.message : 'No pudimos subir las fotos. Revisá tu conexión y probá de nuevo.';
            msg.classList.remove('hidden');
            return;
          }
        }
        const imagenes = fotos.map((f) => f.existente ?? f.subida);

        // 2) Producto
        progreso('Guardando…');
        const fila = {
          nombre, categoria_id: Number(v.categoria.value), precio, emoji: v.emoji.value.trim(),
          descripcion: v.descripcion.value.trim(), descripcion_larga: v.descripcion_larga.value.trim() || null,
          orden: Number(v.orden.value) || 0, destacado: v.destacado.checked, disponible: v.disponible.checked,
          tiene_variantes: variantes, stock: variantes ? 0 : stock, imagenes,
        };
        const r1 = existe
          ? await supabase.from('productos').update(fila).eq('id', p.id)
          : await supabase.from('productos').insert({ id: p.id, ...fila });
        if (r1.error) {
          // No se guardó: las fotos recién subidas quedarían huérfanas, se borran
          await borrarArchivos(rutasDe(subidasEstaVez.map((x) => x.subida)));
          subidasEstaVez.forEach((x) => { x.subida = null; });
          throw r1.error;
        }
        existe = true;
        // Las fotos subidas ya forman parte del producto; las quitadas se borran del bucket (al mejor esfuerzo)
        fotos.forEach((f) => { if (f.subida) { f.existente = f.subida; } });
        await borrarArchivos(rutasDe(removidas));
        removidas.length = 0;

        // 3) Modelos: se borran los quitados, se actualizan los existentes y se insertan los nuevos
        const originales = p.modelos.map((m) => m.id);
        const conservados = filas.filter((m) => m.id).map((m) => m.id);
        const aBorrar = originales.filter((id) => !conservados.includes(id));
        if (aBorrar.length) { const r = await supabase.from('modelos').delete().in('id', aBorrar); if (r.error) throw r.error; }
        for (const m of filas.filter((x) => x.id)) {
          const r = await supabase.from('modelos').update({ nombre: m.nombre, stock: m.stock, orden: m.orden }).eq('id', m.id);
          if (r.error) throw r.error;
        }
        const nuevos = filas.filter((x) => !x.id).map((m) => ({ producto_id: p.id, nombre: m.nombre, stock: m.stock, orden: m.orden }));
        if (nuevos.length) { const r = await supabase.from('modelos').insert(nuevos); if (r.error) throw r.error; }

        progreso('');
        cerrarModal(el);
        toast('Producto guardado', 'ok');
        await recargar();
      } catch (err) {
        console.error(err);
        msg.textContent = err.code === '23505'
          ? 'Ya existe un modelo con ese nombre en este producto.'
          : 'No pudimos guardar todo. Revisá los datos y probá de nuevo (el formulario sigue abierto).';
        msg.classList.remove('hidden');
        progreso('');
      }
    });
  });
}

async function recargar() {
  await cargar();
  pintarLista();
}

async function eliminar(id) {
  const p = productos.find((x) => x.id === id);
  if (!p || !(await confirmar(`¿Eliminar "${p.nombre}"? Se borran también sus modelos y fotos. No se puede deshacer.`))) return;
  const { error } = await supabase.from('productos').delete().eq('id', id);
  if (error) { console.error(error); toast('No pudimos eliminar el producto', 'error'); return; }
  // Archivos del bucket, "al mejor esfuerzo": si falla no se avisa como error
  try {
    const { data: archivos } = await supabase.storage.from('productos').list(id);
    if (archivos?.length) await supabase.storage.from('productos').remove(archivos.map((a) => `${id}/${a.name}`));
  } catch (err) { console.warn('No se pudieron limpiar las fotos', err); }
  toast('Producto eliminado', 'ok');
  await recargar();
}

export async function render(el) {
  contenedor = el;
  filtro = '';
  await cargar();
  el.innerHTML = `
    <div class="section-head"><h1 style="font-size:1.8rem">Productos</h1><button class="btn btn-primary" type="button" data-nuevo>+ Nuevo producto</button></div>
    <div class="field" style="max-width:360px;margin-bottom:var(--space-4)"><label class="sr-only" for="prod-buscar">Buscar</label><input class="input" id="prod-buscar" type="search" placeholder="Buscar producto o categoría…"></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th></th><th>Nombre</th><th>Categoría</th><th class="num">Precio</th><th class="num">Stock</th><th>Disponible</th><th>Destacado</th><th></th></tr></thead>
      <tbody></tbody>
    </table></div>`;
  pintarLista();

  el.querySelector('#prod-buscar').addEventListener('input', (ev) => { filtro = ev.target.value; pintarLista(); });
  on(el, 'click', '[data-nuevo]', () => {
    if (!categorias.length) { toast('Primero creá una categoría', 'error'); return; }
    abrirFormulario();
  });
  on(el, 'click', '[data-editar]', (_e, b) => abrirFormulario(productos.find((x) => x.id === b.closest('tr').dataset.id)));
  on(el, 'click', '[data-eliminar]', (_e, b) => eliminar(b.closest('tr').dataset.id));
  on(el, 'change', '[data-toggle]', async (_e, chk) => {
    const p = productos.find((x) => x.id === chk.closest('tr').dataset.id);
    const campoTog = chk.dataset.toggle;
    const { error } = await supabase.from('productos').update({ [campoTog]: chk.checked }).eq('id', p.id);
    if (error) { console.error(error); chk.checked = !chk.checked; toast('No pudimos guardar el cambio', 'error'); return; }
    p[campoTog] = chk.checked;
    toast('Guardado', 'ok');
  });
}
