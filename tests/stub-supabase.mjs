// Reemplazo de la librería de Supabase SOLO para las pruebas: responde con datos de ejemplo y no sale a internet.
// La prueba lo sirve en lugar de https://cdn.jsdelivr.net/npm/@supabase/supabase-js@…/+esm
//
// Interruptores (se ponen en localStorage desde la prueba):
//   stubuser=1   → hay una sesión iniciada (usuario "u1")
//   esadmin=1    → ese usuario es administrador
// Y en window: __fail = true hace fallar todas las escrituras; __log guarda cada escritura; __rpc guarda el último crear_pedido.

export function createClient(url) {
  const cats = [
    { id: 1, slug: 'velas', nombre: 'Velas', color: '#F4E1D2', emoji: '🕯️', orden: 1, activa: true },
    { id: 2, slug: 'hogar', nombre: 'Hogar', color: '#DDE8E0', emoji: '🏠', orden: 2, activa: true },
  ];
  const mes = (d) => { const x = new Date(); x.setUTCMonth(x.getUTCMonth() - d, 1); return x.toISOString().slice(0, 7) + '-01T00:00:00+00:00'; };
  const prods = [
    { id: 'a1', nombre: 'Vela de soja', categoria_id: 1, categoria: cats[0], precio: 8500, descripcion: 'Aroma lavanda', descripcion_larga: null, imagenes: [{ thumb: 'a1/old-thumb.webp', full: 'a1/old-full.webp' }], emoji: '🕯️', tiene_variantes: false, stock: 2, disponible: true, destacado: true, orden: 1, modelos: [] },
    { id: 'a2', nombre: 'Funda de almohadón', categoria_id: 2, categoria: cats[1], precio: 9800, descripcion: 'Lino lavado', descripcion_larga: null, imagenes: [], emoji: '🛏️', tiene_variantes: true, stock: 0, disponible: true, destacado: true, orden: 2, modelos: [{ id: 1, nombre: 'Arena', stock: 5, orden: 1 }, { id: 2, nombre: 'Terracota', stock: 0, orden: 2 }] },
    // Nombre hostil a propósito: si algún lugar no escapa el texto, se ejecuta onerror y la prueba falla.
    { id: 'a3', nombre: 'XSS-PRUEBA <img src=x onerror=window.__xss=1>', categoria_id: 2, categoria: cats[1], precio: 1000, descripcion: '', descripcion_larga: null, imagenes: [], emoji: '☕', tiene_variantes: false, stock: 3, disponible: true, destacado: false, orden: 3, modelos: [] },
  ];
  const pedidos = [
    { id: 'p1', codigo: 'CN-00001', creado: '2026-10-20T12:00:00Z', total: 17000, estado: 'pendiente', metodo_entrega: 'envio', direccion_envio: { calle: 'C', numero: '1', ciudad: 'CABA' }, notas: null, cliente_id: 'u2', cliente_nombre: 'Lucía', cliente_email: 'l@x.example', cliente_telefono: '+54 9 11 5555-6666', pedido_items: [{ nombre: 'Vela de soja', modelo: null, cantidad: 2, subtotal: 17000, producto_id: 'a1', modelo_id: null }] },
    { id: 'p2', codigo: 'CN-00002', creado: '2026-10-19T12:00:00Z', total: 9800, estado: 'entregado', metodo_entrega: 'retiro', direccion_envio: null, notas: null, cliente_id: 'u3', cliente_nombre: 'Mateo', cliente_email: 'm@x.example', cliente_telefono: '', pedido_items: [{ nombre: 'Funda de almohadón', modelo: 'Arena', cantidad: 1, subtotal: 9800, producto_id: 'a2', modelo_id: 1 }] },
  ];
  const clientes = [{ id: 'u2', nombre: 'Lucía', email: 'l@x.example', telefono: '1155556666', direccion: {}, creado: '2026-10-01T00:00:00Z' }];
  const config = { id: 1, nombre_tienda: 'Tienda de prueba', whatsapp: '5491100000000', saludo_whatsapp: 'Hola! Quisiera hacer este pedido:', prefijo_pedido: 'TP', eslogan: 'Eslogan', hero_titulo: 'Título de portada', hero_texto: 'Texto de portada', sobre_titulo: 'Sobre nosotros', sobre_texto: 'Texto', instagram: '@tienda', email: 'tienda@example.com', envio_texto: 'Envíos a todo el país' };
  const DATA = { categorias: cats, productos: prods, pedidos, clientes, config, v_ventas_mensuales: [{ mes: mes(0), pedidos: 2, total: 26800 }, { mes: mes(2), pedidos: 1, total: 5000 }], v_mas_vendidos: [{ nombre: 'Vela de soja', unidades: 4, total: 34000 }] };

  const log = (x) => { window.__log = (window.__log || []).concat([x]); };
  const tabla = (t) => {
    const st = { op: 'select', f: [] };
    const o = {
      select(c, opt) { st.opt = opt; return o; }, insert(v) { st.op = 'insert'; st.v = v; return o; }, update(v) { st.op = 'update'; st.v = v; return o; },
      delete() { st.op = 'delete'; return o; }, upsert(v) { st.op = 'upsert'; st.v = v; return o; },
      eq(k, v) { st.f.push([k, v]); return o; }, in(k, v) { st.f.push([k, v]); return o; }, order() { return o; }, limit() { return o; },
      single() { st.single = true; return o; }, maybeSingle() { st.single = true; return o; },
      then(resolver) {
        if (st.op !== 'select') log({ t, op: st.op, v: st.v, f: st.f });
        if (window.__fail && st.op !== 'select') return resolver({ data: null, error: { message: 'boom', code: 'XX' } });
        let d = DATA[t] ?? null;
        if (t === 'admins') d = localStorage.getItem('esadmin') ? { user_id: 'u1' } : null;
        if (t === 'carritos') d = null;
        if (st.single && Array.isArray(d)) d = d[0];
        if (st.opt?.head) return resolver({ data: null, count: 2, error: null });
        return resolver({ data: d, error: null });
      },
    };
    return o;
  };

  const sesion = localStorage.getItem('stubuser') ? { user: { id: 'u1', email: 'cliente@example.com', user_metadata: { nombre: 'Cliente de prueba' } } } : null;
  return {
    from: tabla,
    rpc: async (nombre, args) => {
      window.__rpc = args;
      if (window.__rpcFalla) return { data: null, error: { code: 'P0001', message: 'Sin stock suficiente de "Vela de soja"' } };
      return { data: { id: 'p9', codigo: 'TP-00009', total: 8500, items: [{ nombre: 'Vela de soja', modelo: null, precio: 8500, cantidad: 1, subtotal: 8500 }] }, error: null };
    },
    storage: { from: () => ({
      getPublicUrl: (p) => ({ data: { publicUrl: `${location.origin}/__img/${p}` } }),
      list: async () => ({ data: [] }),
      upload: async (path, blob, opts) => { log({ t: 'storage', op: 'upload', path, type: blob.type, size: blob.size, opts }); return { error: null }; },
      remove: async (a) => { log({ t: 'storage', op: 'remove', v: a }); return { error: null }; },
    }) },
    auth: {
      onAuthStateChange(cb) { setTimeout(() => cb('INITIAL_SESSION', sesion), 0); return { data: { subscription: { unsubscribe() {} } } }; },
      getUser: async () => ({ data: { user: sesion?.user || null } }),
      getSession: async () => ({ data: { session: sesion } }),
      signInWithPassword: async () => ({ error: { code: 'invalid_credentials' } }),
      signUp: async () => ({ data: { session: null }, error: null }),
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async () => ({ error: null }),
      signOut: async () => {},
    },
  };
}
