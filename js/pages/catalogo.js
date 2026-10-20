// Catálogo: filtros por categoría (sincronizados con la URL), búsqueda, orden y modal de producto.
import { initLayout } from '../components/layout.js';
import { cardHTML, mediaHTML, emojiSiFalla, skeletonCards } from '../components/producto-card.js';
import { getStore, applyBranding } from '../lib/store.js';
import { listProductos, normalizar, estaAgotado, stockModelo } from '../lib/api.js';
import { agregar as agregarAlCarrito } from '../lib/cart.js';
import { $, $$, esc, on, toast, abrirModal, cerrarModal } from '../lib/dom.js';
import { money } from '../lib/format.js';
import { imgUrl } from '../lib/image-url.js';

const grilla = $('#grilla');
const chips = $('#chips');
const modal = $('#modal-producto');

let productos = [];
let categorias = [];
let estado = { cat: '', q: '', orden: 'destacados' };

// ── URL: ?cat=<slug> y ?p=<id> ──
const params = () => new URLSearchParams(location.search);

function urlCon(cambios) {
  const p = params();
  for (const [k, v] of Object.entries(cambios)) v ? p.set(k, v) : p.delete(k);
  const qs = p.toString();
  return location.pathname + (qs ? `?${qs}` : '');
}

// ── Filtrado, búsqueda y orden (todo en el navegador) ──
function visibles() {
  const q = normalizar(estado.q);
  let lista = productos.filter((p) =>
    (!estado.cat || p.categoria?.slug === estado.cat) &&
    (!q || normalizar(`${p.nombre} ${p.descripcion} ${p.categoria?.nombre ?? ''}`).includes(q)));
  const cmp = {
    'precio-asc': (a, b) => a.precio - b.precio,
    'precio-desc': (a, b) => b.precio - a.precio,
    nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
    destacados: (a, b) => Number(b.destacado) - Number(a.destacado) || a.orden - b.orden,
  }[estado.orden];
  return lista.sort(cmp);
}

function pintarChips() {
  const chip = (slug, texto) =>
    `<button class="chip" type="button" data-cat="${esc(slug)}" aria-pressed="${estado.cat === slug}">${texto}</button>`;
  chips.innerHTML = chip('', 'Todas') +
    categorias.map((c) => chip(c.slug, `${esc(c.emoji ?? '')} ${esc(c.nombre)}`.trim())).join('');
}

function pintarGrilla() {
  const lista = visibles();
  grilla.innerHTML = lista.length
    ? lista.map((p, i) => cardHTML(p, 'h2', i < 4)).join('')
    : `<div class="empty" style="grid-column:1/-1"><span class="emoji" aria-hidden="true">🔍</span>No encontramos productos con esa búsqueda.</div>`;
}

function pintarTodo() { pintarChips(); pintarGrilla(); }

// ── Modal de producto ──
let carrusel = { i: 0, n: 0 };

function moverCarrusel(delta) {
  if (carrusel.n < 2) return;
  carrusel.i = (carrusel.i + delta + carrusel.n) % carrusel.n;
  actualizarCarrusel();
}

function actualizarCarrusel() {
  $('.carousel-track', modal).style.transform = `translateX(-${carrusel.i * 100}%)`;
  $$('.carousel-dots button', modal).forEach((b, i) => b.setAttribute('aria-current', String(i === carrusel.i)));
}

function abrirProducto(id, { empujar = true } = {}) {
  const p = productos.find((x) => x.id === id);
  if (!p) return;
  const fotos = p.imagenes ?? [];
  const slides = fotos.length
    ? fotos.map((f) => `<div class="carousel-slide"><img src="${esc(imgUrl(f.full))}" alt="${esc(p.nombre)}" width="1200" height="1200" decoding="async" data-emoji="${esc(p.emoji || '🛍️')}"></div>`).join('')
    : `<div class="carousel-slide" aria-hidden="true">${esc(p.emoji || '🛍️')}</div>`;
  carrusel = { i: 0, n: Math.max(fotos.length, 1) };

  const primero = p.tiene_variantes ? p.modelos.find((m) => m.stock > 0) : null;
  const modelos = p.tiene_variantes
    ? `<div class="stack"><span class="label" id="lbl-modelo">Modelo</span>
        <div class="chips" role="group" aria-labelledby="lbl-modelo" style="flex-wrap:wrap">
          ${p.modelos.map((m) => `<button class="chip${m.stock <= 0 ? ' is-disabled' : ''}" type="button" data-modelo="${m.id}" aria-pressed="${m.id === primero?.id}" ${m.stock <= 0 ? 'disabled' : ''}>${esc(m.nombre)}${m.stock <= 0 ? ' · Sin stock' : ''}</button>`).join('')}
        </div></div>` : '';

  modal.setAttribute('aria-label', p.nombre);
  modal.innerHTML = `
    <div class="modal-head"><h2 style="font-size:1.3rem">${esc(p.nombre)}</h2><button class="icon-btn" type="button" data-cerrar aria-label="Cerrar"><span aria-hidden="true">✕</span></button></div>
    <div class="modal-body">
      <div class="product-modal">
        <div class="carousel" aria-roledescription="carrusel">
          <div class="carousel-track">${slides}</div>
          ${carrusel.n > 1 ? `<button class="carousel-btn prev" type="button" data-mover="-1" aria-label="Foto anterior"><span aria-hidden="true">‹</span></button>
          <button class="carousel-btn next" type="button" data-mover="1" aria-label="Foto siguiente"><span aria-hidden="true">›</span></button>
          <div class="carousel-dots">${fotos.map((_, i) => `<button type="button" data-ir="${i}" aria-label="Foto ${i + 1}" aria-current="${i === 0}"></button>`).join('')}</div>` : ''}
        </div>
        <div class="stack">
          <p class="card-price" style="font-size:1.4rem">${money(p.precio)}</p>
          <p>${esc(p.descripcion)}</p>
          ${p.descripcion_larga ? `<p class="muted" style="white-space:pre-line">${esc(p.descripcion_larga)}</p>` : ''}
          ${modelos}
          <p class="stock-low" id="aviso-stock" aria-live="polite"></p>
        </div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-primary" type="button" id="btn-agregar" data-agregar="${esc(p.id)}">Agregar al carrito</button></div>`;

  modal.dataset.producto = p.id;
  actualizarAviso(p);
  if (empujar) history.pushState({ p: id }, '', urlCon({ p: id }));
  abrirModal(modal, { onClose: () => { if (params().has('p')) history.pushState({}, '', urlCon({ p: '' })); } });
}

// Cantidad baja ("¡Quedan 2!") y estado del botón según el modelo elegido
function actualizarAviso(p) {
  const btn = $('#btn-agregar', modal);
  const sel = $('[data-modelo][aria-pressed="true"]', modal);
  const stock = p.tiene_variantes ? p.modelos.find((m) => m.id === Number(sel?.dataset.modelo))?.stock ?? 0 : p.stock;
  $('#aviso-stock', modal).textContent = stock > 0 && stock <= 3 ? `¡Quedan ${stock}!` : '';
  const agotado = estaAgotado(p) || stock <= 0;
  btn.disabled = agotado;
  btn.textContent = agotado ? 'Sin stock' : 'Agregar al carrito';
}

// Agrega al carrito respetando el stock disponible
function agregar(productoId, modeloId = null) {
  const p = productos.find((x) => x.id === productoId);
  if (!p) return;
  const stock = stockModelo(p, modeloId);
  const r = agregarAlCarrito(productoId, modeloId, 1, stock);
  if (r.ok) toast(`${p.nombre} agregado al carrito`, 'ok');
  else toast(`Ya tenés todo el stock disponible (${stock}) en tu carrito`);
}

// ── Eventos (delegación, sin onclick inline) ──
on(chips, 'click', '[data-cat]', (_e, el) => {
  estado.cat = el.dataset.cat;
  history.pushState({}, '', urlCon({ cat: estado.cat }));
  pintarTodo();
});

$('#buscar').addEventListener('input', (() => {
  let t;
  return (ev) => { clearTimeout(t); t = setTimeout(() => { estado.q = ev.target.value; pintarGrilla(); }, 150); };
})());
$('#orden').addEventListener('change', (ev) => { estado.orden = ev.target.value; pintarGrilla(); });

on(grilla, 'click', '[data-abrir]', (ev, el) => { ev.preventDefault(); abrirProducto(el.dataset.abrir); });
on(grilla, 'click', '[data-agregar]', (_e, el) => agregar(el.dataset.agregar));

on(modal, 'click', '[data-cerrar]', () => cerrarModal(modal));
on(modal, 'click', '[data-mover]', (_e, el) => moverCarrusel(Number(el.dataset.mover)));
on(modal, 'click', '[data-ir]', (_e, el) => { carrusel.i = Number(el.dataset.ir); actualizarCarrusel(); });
on(modal, 'click', '[data-modelo]', (_e, el) => {
  $$('[data-modelo]', modal).forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
  actualizarAviso(productos.find((x) => x.id === modal.dataset.producto));
});
on(modal, 'click', '[data-agregar]', (_e, el) => {
  const sel = $('[data-modelo][aria-pressed="true"]', modal);
  agregar(el.dataset.agregar, sel ? Number(sel.dataset.modelo) : null);
});

// Swipe táctil del carrusel
let x0 = null;
modal.addEventListener('touchstart', (ev) => { if (ev.target.closest('.carousel')) x0 = ev.touches[0].clientX; }, { passive: true });
modal.addEventListener('touchend', (ev) => {
  if (x0 === null) return;
  const dx = ev.changedTouches[0].clientX - x0;
  x0 = null;
  if (Math.abs(dx) > 40) moverCarrusel(dx < 0 ? 1 : -1);
}, { passive: true });
modal.addEventListener('keydown', (ev) => {
  if (ev.key === 'ArrowLeft') moverCarrusel(-1);
  if (ev.key === 'ArrowRight') moverCarrusel(1);
});

emojiSiFalla(grilla);
emojiSiFalla(modal);

// "Atrás" / "adelante" del navegador: se relee la URL
window.addEventListener('popstate', () => {
  estado.cat = params().get('cat') ?? '';
  pintarTodo();
  const id = params().get('p');
  if (id) abrirProducto(id, { empujar: false });
  else if (modal.classList.contains('is-open')) cerrarModal(modal);
});

// ── Arranque ──
async function cargar() {
  grilla.innerHTML = skeletonCards();
  try {
    const [store, lista] = await Promise.all([getStore(), listProductos({ forzar: true })]);
    applyBranding(store);
    categorias = store.categorias;
    productos = lista;
    const cat = params().get('cat') ?? '';
    estado.cat = categorias.some((c) => c.slug === cat) ? cat : '';
    pintarTodo();
    const id = params().get('p');
    if (id) abrirProducto(id, { empujar: false });
  } catch (err) {
    console.error('No se pudo cargar el catálogo', err);
    grilla.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="emoji" aria-hidden="true">😕</span>No pudimos cargar los productos.<br><button class="btn" type="button" id="reintentar" style="margin-top:var(--space-3)">Reintentar</button></div>`;
  }
}
on(grilla, 'click', '#reintentar', cargar);

initLayout();
cargar();
