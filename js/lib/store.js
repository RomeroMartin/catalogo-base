// ▓ MOTOR — igual para todos los clientes; no se edita por un pedido de diseño (ver docs/GUIA-TECNICA-CORE.md)
// Configuración de la tienda y categorías, con caché de 5 minutos en sessionStorage.
import { supabase } from '../supabase-client.js';

const CACHE_KEY = 'cb_store_v1';
const CACHE_MS = 5 * 60 * 1000;

function leerCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    if (c && Date.now() - c.t < CACHE_MS) return c.data;
  } catch { /* sin caché: no pasa nada */ }
  return null;
}

export function invalidarStore() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignorar */ }
}

// Devuelve { config, categorias }. Lanza error si la base no responde.
export async function getStore() {
  const cacheado = leerCache();
  if (cacheado) return cacheado;

  const [cfg, cats] = await Promise.all([
    supabase.from('config').select('*').eq('id', 1).single(),
    supabase.from('categorias').select('*').eq('activa', true).order('orden'),
  ]);
  if (cfg.error) throw cfg.error;
  if (cats.error) throw cats.error;

  const data = { config: cfg.data, categorias: cats.data };
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data })); } catch { /* ignorar */ }
  return data;
}

const soloDigitos = (s) => String(s ?? '').replace(/\D/g, '');

// "@mitienda" o "https://instagram.com/mitienda/" → "mitienda"
function usuarioInstagram(valor) {
  return String(valor ?? '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
}

// Completa el HTML con los datos de la tienda:
//   [data-config="clave"]            → textContent (oculta el elemento si el valor está vacío y lleva data-hide-empty)
//   [data-config="whatsapp-link"]    → href https://wa.me/<número>
//   [data-config="instagram-link"]   → href de Instagram
//   [data-config="email-link"]       → href mailto:
// y define las variables CSS --cat-<slug> con el color de cada categoría.
export function applyBranding({ config, categorias }) {
  const enlaces = {
    'whatsapp-link': config.whatsapp ? `https://wa.me/${soloDigitos(config.whatsapp)}` : '',
    'instagram-link': config.instagram ? `https://instagram.com/${usuarioInstagram(config.instagram)}` : '',
    'email-link': config.email ? `mailto:${config.email}` : '',
  };

  document.querySelectorAll('[data-config]').forEach((el) => {
    const clave = el.dataset.config;
    if (clave in enlaces) {
      if (enlaces[clave]) el.setAttribute('href', enlaces[clave]);
      else el.classList.add('hidden');
      return;
    }
    const valor = config[clave];
    if (valor == null || valor === '') {
      if (el.hasAttribute('data-hide-empty')) el.classList.add('hidden');
      return;
    }
    el.textContent = valor;
  });

  const titulo = document.documentElement.dataset.pageTitle;
  document.title = titulo
    ? `${titulo} · ${config.nombre_tienda}`
    : [config.nombre_tienda, config.eslogan].filter(Boolean).join(' — ');

  const raiz = document.documentElement.style;
  categorias.forEach((c) => { if (c.color) raiz.setProperty(`--cat-${c.slug}`, c.color); });
}
