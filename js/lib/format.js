// Formatos de dinero, fechas y slugs (es-AR, pesos sin centavos).
import { SITE } from '../site.config.js';

const formatoMoneda = new Intl.NumberFormat(SITE.locale, {
  style: 'currency', currency: SITE.moneda, maximumFractionDigits: 0,
});

export const money = (n) => formatoMoneda.format(Number(n) || 0);

export function fecha(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(SITE.locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// "Funda de almohadón" → "funda-de-almohadon"
export function slugify(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
