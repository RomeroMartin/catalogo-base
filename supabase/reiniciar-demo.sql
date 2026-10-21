-- ============================================================
-- CATALOGO-BASE · supabase/reiniciar-demo.sql
-- DEJA EL DEMO COMO NUEVO. ⚠️ BORRA DATOS. SOLO PARA EL PROYECTO DE SUPABASE DEL DEMO.
--
-- NUNCA correrlo en el proyecto de un cliente real: borra todos sus pedidos, clientes y productos.
-- (Por seguridad, se frena solo si el nombre de la tienda no empieza con "Casa Nube".)
--
-- Orden de uso:
--   1. (Opcional) supabase/diagnostico-demo.sql → mira qué se va a borrar.
--   2. Este archivo → borra pedidos, clientes de prueba, carritos y catálogo.
--   3. supabase/seed.sql → vuelve a cargar la tienda "Casa Nube" y sus 12 productos de ejemplo.
--   4. A mano: Storage → bucket "productos" → borrar las carpetas (las fotos viejas quedan huérfanas).
--
-- Se conservan: la estructura, la seguridad (RLS), las categorías base y TODOS los usuarios administradores
-- (a los que solo se les borran el nombre, el teléfono y la dirección del perfil).
-- Corre en una sola transacción: si algo falla, no se borra nada.
-- ============================================================
begin;

do $$
begin
  if coalesce((select nombre_tienda from public.config where id = 1), '') not ilike 'Casa Nube%' then
    raise exception 'Frenado: este script es solo para el DEMO (la tienda se tiene que llamar "Casa Nube..."). No se borró nada.';
  end if;
  if not exists (select 1 from public.admins) then
    raise exception 'Frenado: no hay ningún usuario administrador en la tabla admins. No se borró nada.';
  end if;
end $$;

-- Pedidos (los ítems se borran en cascada) y el contador de códigos: el próximo pedido vuelve a ser CN-00001
delete from public.pedidos;
alter sequence public.pedidos_numero_seq restart with 1;

-- Carritos guardados
delete from public.carritos;

-- Usuarios de prueba: todos los que NO son administradores (su perfil se borra en cascada)
delete from auth.users where id not in (select user_id from public.admins);

-- Datos personales de los administradores: el perfil queda anónimo
update public.clientes
   set nombre = 'Administrador del demo', telefono = null, direccion = '{}'::jsonb, ultimo_acceso = null
 where id in (select user_id from public.admins);

-- Catálogo: se borran todos los productos (sus modelos, en cascada) y las categorías que no son del demo
delete from public.productos;
delete from public.categorias where slug not in ('hogar', 'textiles', 'accesorios', 'regalos');
update public.categorias set activa = true;

commit;

-- Listo. Ahora correr supabase/seed.sql para recargar la configuración y los productos de ejemplo.
