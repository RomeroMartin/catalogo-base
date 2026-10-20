// Tarjeta de producto y utilidades de imagen, compartidas por el home y el catálogo.
import { esc } from '../lib/dom.js';
import { money } from '../lib/format.js';
import { imgUrl } from '../lib/image-url.js';
import { estaAgotado } from '../lib/api.js';

// Imagen de portada (miniatura) o, si no hay foto, el emoji del producto.
export function mediaHTML(p, version = 'thumb', tam = 400) {
  const ruta = p.imagenes?.[0]?.[version];
  if (!ruta) return `<span aria-hidden="true">${esc(p.emoji || '🛍️')}</span>`;
  return `<img src="${esc(imgUrl(ruta))}" alt="${esc(p.nombre)}" width="${tam}" height="${tam}" loading="lazy" decoding="async" data-emoji="${esc(p.emoji || '🛍️')}">`;
}

// Cuando una imagen falla (el evento "error" no burbujea: se escucha en captura) se muestra el emoji.
export function emojiSiFalla(contenedor) {
  contenedor.addEventListener('error', (ev) => {
    const img = ev.target;
    if (img.tagName !== 'IMG' || !img.dataset.emoji) return;
    const span = document.createElement('span');
    span.setAttribute('aria-hidden', 'true');
    span.textContent = img.dataset.emoji;
    img.replaceWith(span);
  }, true);
}

// Variable CSS con el color de la categoría (la define applyBranding en :root)
const colorCat = (p) => (p.categoria?.slug ? `style="--cat-color:var(--cat-${esc(p.categoria.slug)}, var(--color-line))"` : '');

// `nivel`: h3 cuando la tarjeta está bajo un h2 (home); h2 en el catálogo, donde el título de la página es el h1
export function cardHTML(p, nivel = 'h3') {
  const agotado = estaAgotado(p);
  const badges = [
    agotado ? '<span class="badge badge-danger">Sin stock</span>' : '',
    p.tiene_variantes && !agotado ? '<span class="badge badge-primary">+ modelos</span>' : '',
  ].join('');
  const boton = agotado
    ? '<button class="btn btn-sm" type="button" disabled>Sin stock</button>'
    : p.tiene_variantes
      ? `<button class="btn btn-primary btn-sm" type="button" data-abrir="${esc(p.id)}">Ver modelos</button>`
      : `<button class="btn btn-primary btn-sm" type="button" data-agregar="${esc(p.id)}">Agregar</button>`;
  return `
    <article class="card${agotado ? ' is-soldout' : ''}" ${colorCat(p)}>
      <a class="card-media" href="catalogo.html?p=${esc(p.id)}" data-abrir="${esc(p.id)}" aria-label="Ver ${esc(p.nombre)}">
        ${mediaHTML(p)}
        <span class="card-badges">${badges}</span>
      </a>
      <div class="card-body">
        <${nivel} class="card-title">${esc(p.nombre)}</${nivel}>
        <span class="card-price">${money(p.precio)}</span>
        ${boton}
      </div>
    </article>`;
}

export const skeletonCards = (n = 8) => Array.from({ length: n }, () =>
  '<div class="card" aria-hidden="true"><div class="card-media skeleton"></div><div class="card-body"><div class="skeleton" style="height:16px"></div><div class="skeleton" style="height:16px;width:50%"></div></div></div>').join('');
