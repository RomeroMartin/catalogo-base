-- ============================================================
-- CATALOGO-BASE · supabase/seed.sql  (datos de DEMO, tienda ficticia)
-- Correr DESPUÉS de schema.sql. Es re-ejecutable.
-- ============================================================
insert into public.config (id, nombre_tienda, eslogan, hero_titulo, hero_texto, sobre_titulo, sobre_texto,
                           whatsapp, instagram, email, envio_texto, saludo_whatsapp, prefijo_pedido)
values (1, 'Casa Nube', 'Objetos lindos para tu hogar',
        'Cosas simples que hacen tu casa más tuya',
        'Textiles, decoración y regalos elegidos con cariño. Hacé tu pedido en minutos y lo coordinamos por WhatsApp.',
        'Quiénes somos',
        'Casa Nube es una tienda de demostración. Acá va la historia real de cada cliente: quién es, qué vende y por qué lo hace.',
        '5491100000000', 'casanube', 'hola@casanube.example',
        'Enviamos a todo el país. Retiro sin cargo en zona norte.',
        'Hola Casa Nube! Quisiera hacer este pedido:', 'CN')
on conflict (id) do update set
  nombre_tienda = excluded.nombre_tienda, eslogan = excluded.eslogan, hero_titulo = excluded.hero_titulo,
  hero_texto = excluded.hero_texto, sobre_titulo = excluded.sobre_titulo, sobre_texto = excluded.sobre_texto,
  whatsapp = excluded.whatsapp, instagram = excluded.instagram, email = excluded.email,
  envio_texto = excluded.envio_texto, saludo_whatsapp = excluded.saludo_whatsapp, prefijo_pedido = excluded.prefijo_pedido;

insert into public.categorias (nombre, slug, color, emoji, orden) values
  ('Hogar',      'hogar',      '#F3E3D3', '🏠', 1),
  ('Textiles',   'textiles',   '#DCE8F2', '🧺', 2),
  ('Accesorios', 'accesorios', '#E6E0F2', '✨', 3),
  ('Regalos',    'regalos',    '#F7DDE2', '🎁', 4)
on conflict (slug) do nothing;

-- Productos (solo si la tabla está vacía, para no duplicar al re-ejecutar)
do $$
declare
  c_hogar bigint; c_text bigint; c_acc bigint; c_reg bigint; pid uuid;
begin
  if exists (select 1 from public.productos) then return; end if;
  select id into c_hogar from public.categorias where slug = 'hogar';
  select id into c_text  from public.categorias where slug = 'textiles';
  select id into c_acc   from public.categorias where slug = 'accesorios';
  select id into c_reg   from public.categorias where slug = 'regalos';

  -- Sin variantes
  insert into public.productos (nombre, categoria_id, precio, descripcion, descripcion_larga, emoji, stock, destacado, orden) values
   ('Vela de soja Lavanda', c_hogar, 8500, 'Vela artesanal de 200 g.', 'Cera de soja con aroma a lavanda. Dura unas 40 horas.', '🕯️', 12, true, 1),
   ('Difusor de ambiente',  c_hogar, 12900, 'Difusor con varillas, 150 ml.', null, '🌿', 8, false, 2),
   ('Posavasos de cerámica (x4)', c_hogar, 9800, 'Set de cuatro posavasos.', null, '☕', 15, false, 3),
   ('Tote bag de algodón',  c_acc, 7400, 'Bolso de tela resistente.', null, '👜', 20, true, 1),
   ('Llavero de lana',      c_acc, 2900, 'Llavero tejido a mano.', null, '🔑', 30, false, 2),
   ('Caja de regalo chica', c_reg, 6500, 'Caja con papel de seda y tarjeta.', null, '🎁', 10, false, 1),
   ('Set de tarjetas (x6)', c_reg, 3800, 'Tarjetas ilustradas con sobre.', null, '💌', 25, false, 2);

  -- Con variantes (modelos con stock propio)
  insert into public.productos (nombre, categoria_id, precio, descripcion, descripcion_larga, emoji, tiene_variantes, destacado, orden)
   values ('Funda de almohadón', c_text, 11500, 'Funda de 50×50 cm con cierre.', 'Lino lavado, disponible en varios colores.', '🛋️', true, true, 1)
   returning id into pid;
  insert into public.modelos (producto_id, nombre, stock, orden) values
   (pid, 'Arena', 6, 1), (pid, 'Verde salvia', 4, 2), (pid, 'Terracota', 0, 3);

  insert into public.productos (nombre, categoria_id, precio, descripcion, emoji, tiene_variantes, orden)
   values ('Manta de algodón', c_text, 28900, 'Manta liviana 150×200 cm.', '🧣', true, 2) returning id into pid;
  insert into public.modelos (producto_id, nombre, stock, orden) values
   (pid, 'Crudo', 5, 1), (pid, 'Gris', 3, 2);

  insert into public.productos (nombre, categoria_id, precio, descripcion, emoji, tiene_variantes, orden)
   values ('Repasador de cocina (x2)', c_text, 6200, 'Dos repasadores de algodón.', '🍽️', true, 3) returning id into pid;
  insert into public.modelos (producto_id, nombre, stock, orden) values
   (pid, 'Rayas', 10, 1), (pid, 'Lisos', 10, 2), (pid, 'Cuadros', 2, 3);

  insert into public.productos (nombre, categoria_id, precio, descripcion, emoji, tiene_variantes, orden)
   values ('Scrunchie de seda', c_acc, 3400, 'Elástico de pelo, seda lavable.', '🎀', true, 3) returning id into pid;
  insert into public.modelos (producto_id, nombre, stock, orden) values
   (pid, 'Negro', 9, 1), (pid, 'Rosa', 7, 2), (pid, 'Marfil', 5, 3);

  insert into public.productos (nombre, categoria_id, precio, descripcion, emoji, tiene_variantes, orden)
   values ('Taza esmaltada', c_reg, 7900, 'Taza retro de 350 ml.', '🫖', true, 3) returning id into pid;
  insert into public.modelos (producto_id, nombre, stock, orden) values
   (pid, 'Blanca', 8, 1), (pid, 'Celeste', 6, 2);
end $$;
