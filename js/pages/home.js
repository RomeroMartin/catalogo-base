// ░ SITIO — capa de diseño: se puede rediseñar por cliente usando las funciones del motor (js/lib/)
// Home: categorías, destacados y textos de la tienda (todo sale de la base).
import { initLayout } from '../components/layout.js';
import { cardHTML, emojiSiFalla, skeletonCards } from '../components/producto-card.js';
import { getStore, applyBranding } from '../lib/store.js';
import { listProductos } from '../lib/api.js';
import { $, esc, on } from '../lib/dom.js';
import { SITE } from '../site.config.js';

initLayout();

const contCategorias = $('#categorias');
const contDestacados = $('#destacados');

function pintarCategorias(categorias) {
  contCategorias.innerHTML = categorias.map((c) => `
    <a class="cat-card" href="catalogo.html?cat=${esc(c.slug)}" style="--cat-color:var(--cat-${esc(c.slug)}, var(--color-line))">
      <span class="emoji" aria-hidden="true">${esc(c.emoji ?? '')}</span>${esc(c.nombre)}
    </a>`).join('');
}

async function pintarDestacados() {
  contDestacados.innerHTML = skeletonCards(4);
  try {
    const destacados = (await listProductos()).filter((p) => p.destacado).slice(0, 8);
    if (!destacados.length) { contDestacados.closest('section').classList.add('hidden'); return; }
    contDestacados.innerHTML = destacados.map((p) => cardHTML(p)).join('');
  } catch (err) {
    console.error('No se pudieron cargar los destacados', err);
    contDestacados.innerHTML = `<div class="empty" style="grid-column:1/-1">No pudimos cargar los productos. <button class="btn btn-sm" type="button" id="reintentar">Reintentar</button></div>`;
  }
}

// En el home, tocar "Agregar" lleva al catálogo (ahí vive el carrito)
on(contDestacados, 'click', '[data-agregar]', (_e, el) => { location.href = `catalogo.html?p=${encodeURIComponent(el.dataset.agregar)}`; });
on(contDestacados, 'click', '#reintentar', pintarDestacados);
emojiSiFalla(contDestacados);

// Formulario de contacto: solo si el cliente configuró Formspree
function formularioContacto() {
  if (!SITE.formspreeId) return;
  $('#contacto-form').innerHTML = `
    <form class="stack" method="post" action="https://formspree.io/f/${esc(SITE.formspreeId)}">
      <h3>Escribinos</h3>
      <div class="field"><label for="c-nombre">Nombre</label><input class="input" id="c-nombre" name="nombre" required autocomplete="name"></div>
      <div class="field"><label for="c-email">Email</label><input class="input" id="c-email" name="email" type="email" required autocomplete="email"></div>
      <div class="field"><label for="c-msg">Mensaje</label><textarea class="textarea" id="c-msg" name="mensaje" required></textarea></div>
      <button class="btn btn-primary" type="submit">Enviar</button>
    </form>`;
}

try {
  const store = await getStore();
  applyBranding(store);
  // Si el cliente no completó el título de la portada, se usa el nombre de la tienda; sin "sobre nosotros", se oculta la sección
  const { config } = store;
  if (!config.hero_titulo) { const h1 = $('h1[data-config="hero_titulo"]'); h1.textContent = config.nombre_tienda; h1.classList.remove('hidden'); }
  if (!config.sobre_titulo && !config.sobre_texto) $('#sobre')?.classList.add('hidden');
  pintarCategorias(store.categorias);
} catch (err) {
  console.error('No se pudo cargar la configuración de la tienda', err);
  contCategorias.innerHTML = '<div class="empty" style="grid-column:1/-1">No pudimos cargar la tienda. Probá recargar la página.</div>';
}
formularioContacto();
pintarDestacados();
