// En la base se guardan RUTAS de imagen (no URLs). Acá se arma la URL pública del bucket.
import { supabase } from '../supabase-client.js';

const memo = new Map();

export function imgUrl(ruta) {
  if (!ruta) return '';
  if (!memo.has(ruta)) {
    memo.set(ruta, supabase.storage.from('productos').getPublicUrl(ruta).data.publicUrl);
  }
  return memo.get(ruta);
}
