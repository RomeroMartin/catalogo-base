// ▒ PANEL — igual para todos los clientes (solo cambian colores y logo desde theme.css)
// Pestaña Configuración: datos de la tienda (tabla config, fila id = 1).
import { supabase } from '../../supabase-client.js';
import { esc, toast } from '../../lib/dom.js';
import { invalidarStore } from '../../lib/store.js';
import { conCarga, soloDigitos } from './util.js';

const CAMPOS = [
  ['nombre_tienda', 'Nombre de la tienda', 'text', true],
  ['eslogan', 'Eslogan', 'text'],
  ['hero_titulo', 'Título de la portada', 'text'],
  ['hero_texto', 'Texto de la portada', 'textarea'],
  ['sobre_titulo', 'Título de "Sobre nosotros"', 'text'],
  ['sobre_texto', 'Texto de "Sobre nosotros"', 'textarea'],
  ['whatsapp', 'WhatsApp (solo números, con código de país)', 'tel', true, 'Ejemplo Argentina: 5491155556666 (sin +, espacios ni guiones).'],
  ['instagram', 'Instagram (usuario)', 'text'],
  ['email', 'Email de contacto', 'email'],
  ['envio_texto', 'Texto de envíos', 'textarea'],
  ['saludo_whatsapp', 'Saludo del mensaje de WhatsApp', 'text', true],
  ['prefijo_pedido', 'Prefijo de los códigos de pedido', 'text', true, 'Ejemplo: CN → CN-00001.'],
];

export async function render(el) {
  const { data, error } = await supabase.from('config').select('*').eq('id', 1).single();
  if (error) throw error;

  el.innerHTML = `
    <h1 style="font-size:1.8rem;margin-bottom:var(--space-4)">Configuración de la tienda</h1>
    <form class="stack" id="form-config" novalidate style="max-width:640px">
      ${CAMPOS.map(([k, label, tipo, req, hint]) => `
        <div class="field" data-campo="${k}"><label for="c-${k}">${label}</label>
          ${tipo === 'textarea'
            ? `<textarea class="textarea" id="c-${k}" name="${k}">${esc(data[k] ?? '')}</textarea>`
            : `<input class="input" id="c-${k}" name="${k}" type="${tipo}" value="${esc(data[k] ?? '')}" ${req ? 'required' : ''}>`}
          ${hint ? `<span class="field-hint">${hint}</span>` : ''}<span class="field-error" role="alert"></span></div>`).join('')}
      <div class="form-msg hidden" role="status"></div>
      <div><button class="btn btn-primary" type="submit">Guardar cambios</button></div>
    </form>`;

  const form = el.querySelector('#form-config');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const marcar = (k, texto) => { const f = form.querySelector(`[data-campo="${k}"]`); f.classList.toggle('has-error', !!texto); f.querySelector('.field-error').textContent = texto || ''; };
    const msg = form.querySelector('.form-msg');
    msg.className = 'form-msg hidden';
    const valores = Object.fromEntries(CAMPOS.map(([k]) => [k, form.elements[k].value.trim()]));
    let ok = true;
    CAMPOS.forEach(([k, , , req]) => { marcar(k, ''); if (req && !valores[k]) { marcar(k, 'Este dato es obligatorio.'); ok = false; } });
    valores.whatsapp = soloDigitos(valores.whatsapp);
    if (valores.whatsapp && !/^\d{10,15}$/.test(valores.whatsapp)) { marcar('whatsapp', 'Usá solo números, con código de país (10 a 15 dígitos).'); ok = false; }
    valores.prefijo_pedido = valores.prefijo_pedido.toUpperCase();
    if (valores.prefijo_pedido && !/^[A-Z0-9]{1,8}$/.test(valores.prefijo_pedido)) { marcar('prefijo_pedido', 'Usá hasta 8 letras o números, sin espacios.'); ok = false; }
    if (valores.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email)) { marcar('email', 'Ingresá un email válido.'); ok = false; }
    if (!ok) return;

    await conCarga(form.querySelector('button[type="submit"]'), async () => {
      const { error: err } = await supabase.from('config').update(Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v === '' && !CAMPOS.find((c) => c[0] === k)[3] ? null : v]))).eq('id', 1);
      if (err) { console.error(err); msg.className = 'form-msg form-error'; msg.textContent = 'No pudimos guardar los cambios. Probá de nuevo.'; return; }
      invalidarStore(); // el sitio público toma los datos nuevos enseguida
      form.elements.whatsapp.value = valores.whatsapp;
      form.elements.prefijo_pedido.value = valores.prefijo_pedido;
      msg.className = 'form-msg form-ok'; msg.textContent = 'Cambios guardados. Ya se ven en el sitio.';
      toast('Configuración guardada', 'ok');
    });
  });
}
