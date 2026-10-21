// ▓ MOTOR — lógica del pedido, sin nada de HTML. Igual para todos los clientes (ver docs/GUIA-TECNICA-CORE.md).
// El diseño de la ventana de confirmación vive en js/components/checkout-ui.js y se puede rediseñar por cliente;
// todo lo que importa (precios del servidor, stock, errores, WhatsApp, vaciar el carrito) se hace acá.
import { supabase } from '../supabase-client.js';
import { money } from './format.js';
import { getStore } from './store.js';
import { rehidratar, vaciar } from './cart.js';

const soloDigitos = (s) => String(s ?? '').replace(/\D/g, '');

export const CAMPOS_DIRECCION = ['calle', 'numero', 'ciudad', 'cp', 'provincia'];
const MENSAJE_GENERICO = 'No pudimos crear tu pedido. Revisá tu carrito y probá de nuevo.';
const MENSAJE_CONEXION = 'No pudimos enviar tu pedido. Revisá tu conexión y probá de nuevo.';

// Texto del pedido para WhatsApp. Con pedido guardado se arma con los datos que devolvió el servidor.
export function armarMensaje({ saludo, items, total, entrega, direccion, notas, codigo }) {
  const lineas = items.map((i) => `• ${i.nombre}${i.modelo ? ` — ${i.modelo}` : ''} x${i.cantidad} — ${money(i.subtotal)}`);
  const dir = !entrega ? '' : entrega === 'envio'
    ? `Envío a ${[`${direccion.calle} ${direccion.numero}`.trim(), direccion.ciudad, direccion.cp && `(${direccion.cp})`, direccion.provincia].filter(Boolean).join(', ')}`
    : 'Retiro por el local';
  return [saludo, '', ...lineas, '', `Total: ${money(total)}`, dir, notas ? `Notas: ${notas}` : '', codigo ? `Pedido: ${codigo}` : '']
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n').trim();
}

export const linkWhatsApp = (numero, texto) => `https://wa.me/${soloDigitos(numero)}?text=${encodeURIComponent(texto)}`;

// Enlace de WhatsApp para quien pide SIN cuenta (no se guarda ningún pedido)
export function enlaceWhatsAppInvitado(config, { lineas, total }) {
  const items = lineas.map((l) => ({ nombre: l.producto.nombre, modelo: l.modelo?.nombre, cantidad: l.qty, subtotal: l.subtotal }));
  return linkWhatsApp(config.whatsapp, armarMensaje({ saludo: config.saludo_whatsapp, items, total, entrega: null, direccion: {}, notas: '' }));
}

// Enlace de WhatsApp de un pedido ya guardado
export function enlaceWhatsAppPedido(config, pedido, { entrega, direccion, notas }) {
  return linkWhatsApp(config.whatsapp, armarMensaje({
    saludo: config.saludo_whatsapp, items: pedido.items, total: pedido.total, entrega, direccion, notas, codigo: pedido.codigo,
  }));
}

// Junta todo lo necesario para mostrar la confirmación: carrito rehidratado (datos frescos), config y sesión.
// Devuelve { datos: { lineas, avisos, total }, config, usuario | null, direccion }
export async function prepararCheckout() {
  const [datos, store, sesion] = await Promise.all([rehidratar(), getStore(), supabase.auth.getSession().then((r) => r.data.session)]);
  const usuario = sesion?.user ?? null;
  let direccion = {};
  if (usuario && datos.lineas.length) {
    const { data } = await supabase.from('clientes').select('direccion').eq('id', usuario.id).maybeSingle();
    direccion = data?.direccion ?? {};
  }
  return { datos, config: store.config, usuario, direccion };
}

// Para envío a domicilio, calle, número y ciudad son obligatorios. Devuelve { campo: mensaje } (vacío = todo bien).
export function validarEntrega(entrega, direccion) {
  const errores = {};
  if (entrega === 'envio') {
    if (!direccion.calle) errores.calle = 'Ingresá la calle.';
    if (!direccion.numero) errores.numero = 'Ingresá el número.';
    if (!direccion.ciudad) errores.ciudad = 'Ingresá la ciudad.';
  }
  return errores;
}

// Crea el pedido en el servidor (única forma de crearlos: función crear_pedido, que recalcula los precios y revisa el stock).
// Si sale bien: vacía el carrito y guarda la dirección en el perfil si cambió. Nunca lanza error.
//   → { ok: true, pedido: { id, codigo, total, items } }  |  { ok: false, mensaje }
export async function crearPedido({ lineas, entrega, direccion, notas, usuario, direccionPrevia }) {
  try {
    const { data, error } = await supabase.rpc('crear_pedido', {
      p_items: lineas.map((l) => ({ producto_id: l.producto.id, modelo_id: l.modelo?.id ?? null, cantidad: l.qty })),
      p_metodo_entrega: entrega,
      p_direccion: entrega === 'envio' ? direccion : null,
      p_notas: notas || null,
    });
    if (error) {
      console.error('crear_pedido falló', error);
      // Solo se muestran tal cual los mensajes que escribió la función de la base (raise exception → P0001) o el aviso de sesión;
      // cualquier otro error (detalles internos) se reemplaza por un mensaje genérico.
      const propio = error.code === 'P0001' || error.code === '28000';
      return { ok: false, mensaje: propio ? error.message : MENSAJE_GENERICO };
    }
    vaciar();
    // Guarda la dirección en el perfil si cambió (si falla, no afecta al pedido)
    if (usuario && entrega === 'envio' && JSON.stringify(direccion) !== JSON.stringify(direccionPrevia)) {
      supabase.from('clientes').update({ direccion }).eq('id', usuario.id).then(({ error: e }) => { if (e) console.error(e); });
    }
    return { ok: true, pedido: data };
  } catch (err) {
    console.error('Error al crear el pedido', err);
    return { ok: false, mensaje: MENSAJE_CONEXION };
  }
}

// Vuelve a pedir datos frescos del carrito (después de un rechazo del servidor)
export { rehidratar };
