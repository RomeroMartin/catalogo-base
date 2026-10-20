// Inyecta header, drawer del carrito y footer en todas las páginas.
// Cada HTML tiene <div id="app-header"></div> y <div id="app-footer"></div>.
// <html data-root=""> (o "../" en admin/) indica cómo llegar a la raíz del sitio.
import { SITE } from '../site.config.js';
import { $, on, abrirModal, cerrarModal } from '../lib/dom.js';
import { onAuth, isAdmin } from '../lib/auth.js';

const raiz = document.documentElement.dataset.root || '';

// Cantidad de unidades en el carrito (el carrito completo vive en cart.js, Fase 6).
function contarCarrito() {
  try {
    const items = JSON.parse(localStorage.getItem(SITE.carritoKey)) || [];
    return items.reduce((n, it) => n + (Number(it.qty) || 0), 0);
  } catch { return 0; }
}

function pintarContador() {
  const n = contarCarrito();
  const el = $('#cart-count');
  if (!el) return;
  el.textContent = n || '';
  el.dataset.n = String(n);
  el.setAttribute('aria-label', `${n} ${n === 1 ? 'producto' : 'productos'} en el carrito`);
}

export function initLayout() {
  const pagina = document.documentElement.dataset.page || '';
  const link = (href, texto, id) =>
    `<a href="${raiz}${href}"${pagina === id ? ' aria-current="page"' : ''}>${texto}</a>`;

  const header = $('#app-header');
  if (header) {
    header.outerHTML = `
      <header class="site-header">
        <div class="container">
          <a class="brand" href="${raiz}index.html" data-config="nombre_tienda">&nbsp;</a>
          <nav class="nav" aria-label="Principal">
            ${link('index.html', 'Inicio', 'home')}${link('catalogo.html', 'Catálogo', 'catalogo')}${link('index.html#contacto', 'Contacto', 'contacto')}
          </nav>
          <div class="header-actions">
            <a class="icon-btn" id="account-link" href="${raiz}cuenta.html"><span aria-hidden="true">👤</span> <span id="account-label">Ingresar</span></a>
            <a class="icon-btn hidden" id="admin-link" href="${raiz}admin/index.html">Panel</a>
            <button class="icon-btn" id="cart-btn" type="button" aria-label="Abrir carrito"><span aria-hidden="true">🛒</span><span class="cart-count" id="cart-count" aria-live="polite" data-n="0"></span></button>
            <button class="icon-btn menu-toggle" id="menu-btn" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="mobile-nav"><span aria-hidden="true">☰</span></button>
          </div>
        </div>
        <nav class="mobile-nav" id="mobile-nav" aria-label="Menú móvil">
          ${link('index.html', 'Inicio', 'home')}${link('catalogo.html', 'Catálogo', 'catalogo')}${link('index.html#contacto', 'Contacto', 'contacto')}
        </nav>
      </header>
      <aside class="drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-label="Carrito" tabindex="-1">
        <div class="drawer-head"><h2 style="font-size:1.25rem">Tu carrito</h2><button class="icon-btn" type="button" data-cerrar-carrito aria-label="Cerrar carrito"><span aria-hidden="true">✕</span></button></div>
        <div class="drawer-body" id="cart-body"><p class="muted">Tu carrito está vacío.</p></div>
        <div class="drawer-foot" id="cart-foot"></div>
      </aside>`;
  }

  const footer = $('#app-footer');
  if (footer) {
    const credito = SITE.credito?.texto
      ? `<a href="${SITE.credito.url}" target="_blank" rel="noopener">${SITE.credito.texto}</a>` : '';
    footer.outerHTML = `
      <footer class="site-footer">
        <div class="container">
          <span>© ${new Date().getFullYear()} <span data-config="nombre_tienda"></span></span>
          <span>${credito}</span>
        </div>
      </footer>`;
  }

  // Menú móvil
  const menuBtn = $('#menu-btn');
  menuBtn?.addEventListener('click', () => {
    const abierto = $('#mobile-nav').classList.toggle('is-open');
    menuBtn.setAttribute('aria-expanded', String(abierto));
  });

  // Carrito (la lógica real llega en la Fase 6; acá solo se abre y cierra)
  const drawer = $('#cart-drawer');
  $('#cart-btn')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('cart:open'));
    abrirModal(drawer);
  });
  if (drawer) on(drawer, 'click', '[data-cerrar-carrito]', () => cerrarModal(drawer));

  pintarContador();
  document.addEventListener('cart:changed', pintarContador);
  window.addEventListener('storage', pintarContador);

  // Estado de sesión en el header
  onAuth(async (_evento, sesion) => {
    const label = $('#account-label');
    if (label) label.textContent = sesion ? 'Mi cuenta' : 'Ingresar';
    const admin = sesion ? await isAdmin(sesion.user) : false;
    $('#admin-link')?.classList.toggle('hidden', !admin);
  });
}
