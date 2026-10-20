// Compresión de fotos en el navegador y subida a Supabase Storage (bucket `productos`).
// Cada foto se guarda en DOS archivos: `thumb` (400 px) y `full` (1200 px). No se guarda el original.
import { supabase } from '../supabase-client.js';

export const MAX_FOTOS = 8;
const LIMITE_BYTES = 1024 * 1024; // el bucket rechaza archivos de más de 1 MB
const VERSIONES = [
  { clave: 'thumb', lado: 400, calidad: 0.75 },
  { clave: 'full', lado: 1200, calidad: 0.8 },
];

// ── Lectura de la imagen (respeta la orientación EXIF del celular) ──
async function leerImagen(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch { /* se prueba con <img> */ }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error('No pudimos leer esta imagen. Probá con JPG o PNG.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const aBlob = (canvas, tipo, calidad) => new Promise((resolver) => canvas.toBlob(resolver, tipo, calidad));

// JPEG no tiene transparencia: se pinta un fondo blanco debajo
function sobreBlanco(canvas) {
  const plano = document.createElement('canvas');
  plano.width = canvas.width; plano.height = canvas.height;
  const ctx = plano.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, plano.width, plano.height);
  ctx.drawImage(canvas, 0, 0);
  return plano;
}

const codificar = (canvas, ext, calidad) =>
  ext === 'webp' ? aBlob(canvas, 'image/webp', calidad) : aBlob(sobreBlanco(canvas), 'image/jpeg', calidad);

// Dibuja la imagen en un canvas (sin agrandar fotos chicas) y la comprime.
// Devuelve { blob, ext }. Prueba WebP; si el navegador devuelve otra cosa (Safari a veces entrega PNG), usa JPEG.
async function comprimir(fuente, lado, calidad) {
  const escala = Math.min(1, lado / Math.max(fuente.width, fuente.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(fuente.width * escala));
  canvas.height = Math.max(1, Math.round(fuente.height * escala));
  canvas.getContext('2d').drawImage(fuente, 0, 0, canvas.width, canvas.height);

  let ext = 'webp';
  let blob = await codificar(canvas, ext, calidad);
  if (!blob || blob.type !== 'image/webp') { ext = 'jpg'; blob = await codificar(canvas, ext, calidad); }

  // Si pesa 1 MB o más, se baja la calidad de a 0.1 y se reintenta
  let q = calidad;
  while (blob && blob.size >= LIMITE_BYTES && q > 0.3) {
    q = Math.round((q - 0.1) * 100) / 100;
    blob = await codificar(canvas, ext, q);
  }
  if (!blob || blob.size >= LIMITE_BYTES) throw new Error('La foto sigue pesando demasiado después de comprimirla.');
  return { blob, ext };
}

// Procesa UNA foto (de a una, para no agotar la memoria de celulares viejos).
// Devuelve { thumb: {blob, ext}, full: {blob, ext} }
export async function procesarImagen(file) {
  const fuente = await leerImagen(file);
  try {
    const resultado = {};
    for (const v of VERSIONES) resultado[v.clave] = await comprimir(fuente, v.lado, v.calidad);
    return resultado;
  } finally {
    if (typeof fuente.close === 'function') fuente.close(); // libera memoria
  }
}

// ── Subida / borrado ──
// Rutas: <producto_id>/<uuid>-thumb.webp y <producto_id>/<uuid>-full.webp (nombres únicos → cacheables un año)
export async function subirFoto(productoId, procesada) {
  const base = `${productoId}/${crypto.randomUUID()}`;
  const subidas = [];
  try {
    const rutas = {};
    for (const v of VERSIONES) {
      const { blob, ext } = procesada[v.clave];
      const ruta = `${base}-${v.clave}.${ext}`;
      const { error } = await supabase.storage.from('productos').upload(ruta, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
      if (error) throw error;
      subidas.push(ruta);
      rutas[v.clave] = ruta;
    }
    return rutas; // { thumb, full }: lo que se guarda en productos.imagenes
  } catch (err) {
    await borrarArchivos(subidas); // no dejar archivos huérfanos si falló a mitad
    throw err;
  }
}

// Borra archivos del bucket "al mejor esfuerzo": nunca lanza error.
export async function borrarArchivos(rutas) {
  const lista = rutas.filter(Boolean);
  if (!lista.length) return;
  try {
    const { error } = await supabase.storage.from('productos').remove(lista);
    if (error) console.warn('No se pudieron borrar algunos archivos', error);
  } catch (err) { console.warn('No se pudieron borrar algunos archivos', err); }
}

export const rutasDe = (fotos) => fotos.flatMap((f) => [f.thumb, f.full]);
export const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
