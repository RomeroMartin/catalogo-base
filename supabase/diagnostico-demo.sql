-- ============================================================
-- CATALOGO-BASE · supabase/diagnostico-demo.sql   (SOLO LECTURA: no modifica nada)
-- Muestra qué hay en el proyecto de Supabase antes de limpiarlo con reiniciar-demo.sql.
-- Se pega en SQL Editor y se ejecuta. Devuelve una sola tabla de resumen.
-- ============================================================
select 'Pedidos (se borrarán)'                         as concepto, count(*)::text as cantidad from public.pedidos
union all select 'Ítems de pedidos (se borrarán)',      count(*)::text from public.pedido_items
union all select 'Carritos guardados (se borrarán)',    count(*)::text from public.carritos
union all select 'Usuarios que NO son admin (se borrarán con sus datos)', count(*)::text
  from auth.users where id not in (select user_id from public.admins)
union all select 'Usuarios admin (se conservan)',       count(*)::text from public.admins
union all select 'Productos (se borrarán y se recargan los 12 de ejemplo)', count(*)::text from public.productos
union all select 'Categorías que no son del demo (se borrarán)', count(*)::text
  from public.categorias where slug not in ('hogar', 'textiles', 'accesorios', 'regalos')
union all select 'Productos con fotos en Storage (hay que vaciar el bucket a mano)', count(*)::text
  from public.productos where jsonb_array_length(imagenes) > 0
union all select 'Nombre de la tienda (config)',        coalesce(nombre_tienda, '(vacío)') from public.config where id = 1
union all select 'WhatsApp (config)',                   coalesce(whatsapp, '(vacío)')      from public.config where id = 1
union all select 'Instagram (config)',                  coalesce(instagram, '(vacío)')     from public.config where id = 1
union all select 'Email de contacto (config)',          coalesce(email, '(vacío)')         from public.config where id = 1;

-- Detalle de los usuarios que se van a borrar (para revisar que no haya ninguno que quieras conservar)
select u.email, c.nombre, c.telefono, u.created_at::date as alta,
       (u.id in (select user_id from public.admins)) as es_admin
from auth.users u left join public.clientes c on c.id = u.id
order by es_admin desc, u.created_at;
