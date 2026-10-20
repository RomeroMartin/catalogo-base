// Estado del carrito. Se guarda SOLO { producto_id, modelo_id, qty } (nunca precios ni imágenes)
// y se "rehidrata" desde la base cada vez que hace falta mostrarlo.
// Si el cliente está logueado, el carrito también se sincroniza con la tabla `carritos`.
import { SITE } from '../site.config.js';
import { supabase } from '../supabase-client.js';
import { onAuth } from './auth.js';
import { getProductosPorIds } from './api.js';

const KEY = SITE.carritoKey;
const KEY_T = `${KEY}_t`;                 // cuándo se modificó por última vez (para elegir el más nuevo)
const OWNER = `${KEY}_owner`;            // de quién es el carrito guardado (vacío = invitado)
const MERGED = (uid) => `${KEY}_merged_${uid}`; // marca: este usuario ya fusionó su carrito en este navegador
const MAX_LINEA = 99;

export const lineKey = (productoId, modeloId) => `${productoId}:${modeloId ?? 0}`;

// ── Lectura / escritura local ──
function leer() {
  try {
    const crudo = JSON.parse(localStorage.getItem(KEY));
    if (!Array.isArray(crudo)) return [];
    return crudo
      .filter((i) => i && typeof i.producto_id === 'string' && Number(i.qty) > 0)
      .map((i) => ({ producto_id: i.producto_id, modelo_id: i.modelo_id ?? null, qty: Math.min(Math.floor(Number(i.qty)), MAX_LINEA) }));
  } catch { return []; }
}

let remotoPausado = false; // evita devolver a la base lo que justo vino de la base
let usuarioId = null;      // usuario logueado cuyo carrito se está sincronizando

function guardar(items, { remoto = true } = {}) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    localStorage.setItem(KEY_T, String(Date.now()));
    if (usuarioId) localStorage.setItem(OWNER, usuarioId); else localStorage.removeItem(OWNER);
  } catch { /* sin almacenamiento: el carrito vive solo en esta página */ }
  document.dispatchEvent(new CustomEvent('cart:changed'));
  if (remoto && !remotoPausado) programarGuardadoRemoto();
}

export const items = () => leer();
export const contar = () => leer().reduce((n, i) => n + i.qty, 0);
export const cantidadEn = (productoId, modeloId = null) =>
  leer().find((i) => lineKey(i.producto_id, i.modelo_id) === lineKey(productoId, modeloId))?.qty ?? 0;

// Agrega unidades. `maximo` (stock conocido) recorta la cantidad. Devuelve { ok, qty, tope }.
export function agregar(productoId, modeloId = null, cantidad = 1, maximo = MAX_LINEA) {
  const lista = leer();
  const k = lineKey(productoId, modeloId);
  const linea = lista.find((i) => lineKey(i.producto_id, i.modelo_id) === k);
  const tope = Math.min(maximo, MAX_LINEA);
  const actual = linea?.qty ?? 0;
  if (actual >= tope) return { ok: false, qty: actual, tope };
  const nueva = Math.min(actual + cantidad, tope);
  if (linea) linea.qty = nueva; else lista.push({ producto_id: productoId, modelo_id: modeloId ?? null, qty: nueva });
  guardar(lista);
  return { ok: true, qty: nueva, tope };
}

export function cambiarQty(clave, qty) {
  const lista = leer().map((i) => (lineKey(i.producto_id, i.modelo_id) === clave ? { ...i, qty: Math.min(qty, MAX_LINEA) } : i))
    .filter((i) => i.qty > 0);
  guardar(lista);
}

export const quitar = (clave) => cambiarQty(clave, 0);
export const vaciar = () => guardar([]);
export const reemplazar = (lista, opciones) => guardar(lista, opciones);

// ── Rehidratación: datos frescos de la base ──
// Devuelve { lineas, avisos, total }. Saca las líneas que ya no existen o están agotadas
// y recorta cantidades al stock, avisando qué pasó.
export async function rehidratar() {
  const actuales = leer();
  if (!actuales.length) return { lineas: [], avisos: [], total: 0 };

  const productos = await getProductosPorIds([...new Set(actuales.map((i) => i.producto_id))]);
  const porId = new Map(productos.map((p) => [p.id, p]));
  const lineas = [], avisos = [], conservar = [];
  let cambio = false;

  for (const it of actuales) {
    const p = porId.get(it.producto_id);
    if (!p) { avisos.push('Sacamos un producto porque ya no está disponible.'); cambio = true; continue; }
    const modelo = p.tiene_variantes ? p.modelos.find((m) => m.id === it.modelo_id) : null;
    const nombre = modelo ? `${p.nombre} (${modelo.nombre})` : p.nombre;
    if (p.tiene_variantes && !modelo) { avisos.push(`Sacamos ${p.nombre} porque ese modelo ya no está disponible.`); cambio = true; continue; }
    const stock = modelo ? modelo.stock : p.stock;
    if (stock <= 0) { avisos.push(`Sacamos ${nombre} porque ya no está disponible.`); cambio = true; continue; }
    let qty = it.qty;
    if (qty > stock) { qty = stock; avisos.push(`Ajustamos la cantidad de ${nombre} al stock disponible (${stock}).`); cambio = true; }
    conservar.push({ ...it, qty });
    lineas.push({ clave: lineKey(p.id, modelo?.id), producto: p, modelo, qty, stock, nombre, precio: p.precio, subtotal: p.precio * qty });
  }
  if (cambio) guardar(conservar);
  return { lineas, avisos, total: lineas.reduce((s, l) => s + l.subtotal, 0) };
}

// ── Sincronización con la cuenta (tabla carritos) ──
let timer = null;

function programarGuardadoRemoto() {
  if (!usuarioId) return;
  clearTimeout(timer);
  timer = setTimeout(guardarRemoto, 600);
}

async function guardarRemoto() {
  if (!usuarioId) return;
  const { error } = await supabase.from('carritos').upsert({ cliente_id: usuarioId, items: leer() });
  if (error) console.error('No se pudo guardar el carrito en la cuenta', error);
}

// Suma cantidades por línea (la misma línea en ambos lados se suma)
function fusionar(a, b) {
  const mapa = new Map();
  [...a, ...b].forEach((i) => {
    const k = lineKey(i.producto_id, i.modelo_id);
    const previa = mapa.get(k);
    mapa.set(k, { ...i, qty: Math.min((previa?.qty ?? 0) + i.qty, MAX_LINEA) });
  });
  return [...mapa.values()];
}

async function sincronizarAlIngresar(uid) {
  // Se lee el dueño ANTES de asignar usuarioId (guardar() lo pisa con el usuario actual)
  const duenio = localStorage.getItem(OWNER);
  usuarioId = uid;
  const { data, error } = await supabase.from('carritos').select('items,actualizado').eq('cliente_id', uid).maybeSingle();
  if (error) { console.error('No se pudo leer el carrito de la cuenta', error); return; }
  const remoto = Array.isArray(data?.items) ? data.items : [];

  // Si el carrito guardado en este navegador es de OTRA cuenta, no es de este usuario: se descarta
  // (no se mezcla). Solo un carrito de invitado (sin dueño) se fusiona con el de la cuenta.
  const ajeno = !!duenio && duenio !== uid;
  const local = ajeno ? [] : leer();

  let final;
  const traeInvitado = !duenio && local.length > 0; // cosas agregadas como invitado: siempre se suman a las de la cuenta
  if (ajeno || traeInvitado || !localStorage.getItem(MERGED(uid))) {
    // Primer ingreso en este navegador (o carrito de invitado): se suman invitado + cuenta, una sola vez
    final = fusionar(local, remoto);
    try { localStorage.setItem(MERGED(uid), '1'); } catch { /* ignorar */ }
  } else {
    // Ya fusionado antes: gana el más reciente, para no duplicar cantidades en cada visita
    const tLocal = Number(localStorage.getItem(KEY_T)) || 0;
    const tRemoto = data?.actualizado ? Date.parse(data.actualizado) : 0;
    final = tRemoto > tLocal ? remoto : local;
  }
  remotoPausado = true;
  guardar(final, { remoto: false });
  remotoPausado = false;
  if (JSON.stringify(final) !== JSON.stringify(remoto)) await guardarRemoto();
}

// Se llama una vez por página (desde layout.js). Todo dentro de onAuth() (regla anti-deadlock).
export function initCartSync() {
  onAuth((evento, sesion) => {
    if (sesion && (evento === 'INITIAL_SESSION' || evento === 'SIGNED_IN')) {
      if (usuarioId !== sesion.user.id) sincronizarAlIngresar(sesion.user.id);
    } else if (evento === 'INITIAL_SESSION' && !sesion && localStorage.getItem(OWNER)) {
      // Hay un carrito de una cuenta, pero ya no hay sesión (venció o se cerró sin avisar a esta pestaña):
      // no se le muestra a un invitado. El de la cuenta queda guardado en la base.
      usuarioId = null;
      remotoPausado = true;
      guardar([], { remoto: false });
      remotoPausado = false;
    } else if (evento === 'SIGNED_OUT') {
      // Cerrar sesión vacía la vista local; el carrito remoto queda guardado.
      // (INITIAL_SESSION sin usuario es un invitado: NO se vacía.)
      try { localStorage.removeItem(MERGED(usuarioId)); } catch { /* ignorar */ }
      usuarioId = null;
      remotoPausado = true;
      guardar([], { remoto: false });
      remotoPausado = false;
    }
  });
}
