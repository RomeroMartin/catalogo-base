// Consultas del lado público: catálogo completo (se filtra en el navegador).
import { supabase } from '../supabase-client.js';

const SELECT_PRODUCTOS =
  'id,nombre,precio,descripcion,descripcion_larga,imagenes,emoji,tiene_variantes,stock,destacado,orden,' +
  'categoria:categorias(id,nombre,slug,color,emoji),modelos(id,nombre,stock,orden)';

const CACHE_MS = 2 * 60 * 1000;
let cache = null; // { t, data }

function ordenarModelos(productos) {
  productos.forEach((p) => p.modelos?.sort((a, b) => a.orden - b.orden || a.id - b.id));
  return productos;
}

// Todos los productos disponibles, en una sola consulta (caché en memoria de 2 min).
export async function listProductos({ forzar = false } = {}) {
  if (!forzar && cache && Date.now() - cache.t < CACHE_MS) return cache.data;
  const { data, error } = await supabase.from('productos').select(SELECT_PRODUCTOS).eq('disponible', true).order('orden');
  if (error) throw error;
  cache = { t: Date.now(), data: ordenarModelos(data) };
  return cache.data;
}

// Para rehidratar el carrito: siempre datos frescos, sin caché.
export async function getProductosPorIds(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('productos').select(SELECT_PRODUCTOS).eq('disponible', true).in('id', ids);
  if (error) throw error;
  return ordenarModelos(data);
}

// "Funda de Almohadón" → "funda de almohadon" (para buscar sin tildes ni mayúsculas)
export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function stockModelo(producto, modeloId) {
  if (!producto.tiene_variantes) return producto.stock;
  return producto.modelos.find((m) => m.id === modeloId)?.stock ?? 0;
}

// Sin variantes: stock <= 0. Con variantes: todos los modelos en 0.
export function estaAgotado(producto) {
  return producto.tiene_variantes
    ? producto.modelos.every((m) => m.stock <= 0)
    : producto.stock <= 0;
}
