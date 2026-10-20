-- ============================================================
-- CATALOGO-BASE · schema.sql
-- Se pega UNA vez en Supabase → SQL Editor de cada proyecto nuevo.
-- Es idempotente en lo posible (create or replace / if not exists).
-- ============================================================

-- ── Utilidades ───────────────────────────────────────────────
create or replace function public.set_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado = now();
  return new;
end $$;

-- ── Tablas ───────────────────────────────────────────────────

-- Configuración de la tienda (una sola fila, id = 1)
create table if not exists public.config (
  id              int primary key default 1 check (id = 1),
  nombre_tienda   text not null,
  eslogan         text,
  hero_titulo     text,
  hero_texto      text,
  sobre_titulo    text,
  sobre_texto     text,
  whatsapp        text not null,                 -- solo dígitos, con código de país
  instagram       text,
  email           text,
  envio_texto     text,
  saludo_whatsapp text not null default 'Hola! Quisiera hacer este pedido:',
  prefijo_pedido  text not null default 'PED',   -- ej. 'SG' → SG-00042
  actualizado     timestamptz not null default now()
);

create table if not exists public.categorias (
  id      bigint generated always as identity primary key,
  nombre  text not null unique,
  slug    text not null unique,                  -- para ?cat= en la URL
  color   text,                                  -- hex, ej. '#F4E1D2'
  emoji   text,
  orden   int not null default 0,
  activa  boolean not null default true
);

create table if not exists public.productos (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null check (length(trim(nombre)) > 0),
  categoria_id      bigint not null references public.categorias(id),
  precio            integer not null check (precio >= 0),
  descripcion       text not null default '',
  descripcion_larga text,
  imagenes          jsonb not null default '[]'::jsonb,  -- [{"thumb":"<path>","full":"<path>"}]
  emoji             text not null default '',
  tiene_variantes   boolean not null default false,
  stock             integer not null default 0 check (stock >= 0),  -- solo si NO tiene variantes
  disponible        boolean not null default true,
  destacado         boolean not null default false,
  orden             int not null default 0,
  creado            timestamptz not null default now(),
  actualizado       timestamptz not null default now(),
  check (jsonb_typeof(imagenes) = 'array')
);

create table if not exists public.modelos (
  id          bigint generated always as identity primary key,
  producto_id uuid not null references public.productos(id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  stock       integer not null default 0 check (stock >= 0),
  orden       int not null default 0,
  unique (producto_id, nombre)
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.clientes (
  id            uuid primary key references auth.users(id) on delete cascade,
  nombre        text,
  email         text,
  telefono      text,
  direccion     jsonb not null default '{}'::jsonb,  -- {calle,numero,ciudad,cp,provincia}
  creado        timestamptz not null default now(),
  ultimo_acceso timestamptz
);

create table if not exists public.carritos (
  cliente_id  uuid primary key references auth.users(id) on delete cascade,
  items       jsonb not null default '[]'::jsonb,   -- [{producto_id, modelo_id, qty}]
  actualizado timestamptz not null default now(),
  check (jsonb_typeof(items) = 'array')
);

create sequence if not exists public.pedidos_numero_seq;

create table if not exists public.pedidos (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint not null unique default nextval('public.pedidos_numero_seq'),
  codigo           text not null unique,
  cliente_id       uuid not null references auth.users(id),
  cliente_nombre   text,
  cliente_email    text,
  cliente_telefono text,
  total            integer not null default 0 check (total >= 0),
  estado           text not null default 'pendiente'
                     check (estado in ('pendiente','confirmado','enviado','entregado','cancelado')),
  metodo_entrega   text not null check (metodo_entrega in ('envio','retiro')),
  direccion_envio  jsonb,
  notas            text,
  stock_descontado boolean not null default false,
  creado           timestamptz not null default now(),
  actualizado      timestamptz not null default now()
);

create table if not exists public.pedido_items (
  id          bigint generated always as identity primary key,
  pedido_id   uuid not null references public.pedidos(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  modelo_id   bigint references public.modelos(id) on delete set null,
  nombre      text not null,          -- snapshot
  modelo      text,                   -- snapshot
  precio      integer not null,       -- snapshot
  cantidad    integer not null check (cantidad > 0),
  subtotal    integer not null
);

-- ── Índices (Postgres NO indexa las FKs solo) ────────────────
create index if not exists idx_productos_catalogo on public.productos (categoria_id, disponible, orden);
create index if not exists idx_productos_destacado on public.productos (destacado) where destacado;
create index if not exists idx_modelos_producto   on public.modelos (producto_id);
create index if not exists idx_pedidos_cliente    on public.pedidos (cliente_id, creado desc);
create index if not exists idx_pedidos_estado     on public.pedidos (estado, creado desc);
create index if not exists idx_items_pedido       on public.pedido_items (pedido_id);
create index if not exists idx_items_producto     on public.pedido_items (producto_id);

-- ── Triggers de "actualizado" ────────────────────────────────
drop trigger if exists trg_config_upd    on public.config;
drop trigger if exists trg_productos_upd on public.productos;
drop trigger if exists trg_carritos_upd  on public.carritos;
drop trigger if exists trg_pedidos_upd   on public.pedidos;
create trigger trg_config_upd    before update on public.config    for each row execute function public.set_actualizado();
create trigger trg_productos_upd before update on public.productos for each row execute function public.set_actualizado();
create trigger trg_carritos_upd  before update on public.carritos  for each row execute function public.set_actualizado();
create trigger trg_pedidos_upd   before update on public.pedidos   for each row execute function public.set_actualizado();

-- ── Seguridad: ¿es admin? ────────────────────────────────────
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ── Alta automática del cliente al registrarse ───────────────
-- (Funciona aunque se active la confirmación por email: no depende de sesión.)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.clientes (id, nombre, email, telefono)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'nombre','')), ''),
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'telefono','')), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Crear pedido de forma atómica y con precios del servidor ─
-- p_items: [{"producto_id":"<uuid>","modelo_id":<bigint|null>,"cantidad":<int>}]
-- Devuelve: {id, codigo, total, items:[{nombre,modelo,precio,cantidad,subtotal}]}
create or replace function public.crear_pedido(
  p_items          jsonb,
  p_metodo_entrega text,
  p_direccion      jsonb default null,
  p_notas          text  default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_cli       public.clientes%rowtype;
  v_pedido_id uuid := gen_random_uuid();
  v_numero    bigint;
  v_prefijo   text;
  v_codigo    text;
  v_total     integer := 0;
  v_item      jsonb;
  v_prod      public.productos%rowtype;
  v_mod       public.modelos%rowtype;
  v_cant      integer;
  v_modelo    text;
  v_modelo_id bigint;
  v_lineas    jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión para hacer un pedido' using errcode = '28000';
  end if;
  if p_metodo_entrega is null or p_metodo_entrega not in ('envio','retiro') then
    raise exception 'Método de entrega inválido';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Demasiados productos en un solo pedido';
  end if;

  select * into v_cli from public.clientes where id = v_uid;
  select prefijo_pedido into v_prefijo from public.config where id = 1;

  v_numero := nextval('public.pedidos_numero_seq');
  v_codigo := coalesce(v_prefijo, 'PED') || '-' || lpad(v_numero::text, 5, '0');

  insert into public.pedidos (id, numero, codigo, cliente_id, cliente_nombre, cliente_email,
                              cliente_telefono, total, estado, metodo_entrega, direccion_envio, notas)
  values (v_pedido_id, v_numero, v_codigo, v_uid, v_cli.nombre, v_cli.email, v_cli.telefono,
          0, 'pendiente', p_metodo_entrega,
          case when p_metodo_entrega = 'envio' then p_direccion else null end,
          left(p_notas, 500));

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_item->>'cantidad')::integer;
    if v_cant is null or v_cant < 1 or v_cant > 99 then
      raise exception 'Cantidad inválida';
    end if;

    select * into v_prod from public.productos
      where id = (v_item->>'producto_id')::uuid and disponible;
    if not found then
      raise exception 'Uno de los productos ya no está disponible';
    end if;

    v_modelo := null; v_modelo_id := null;
    if v_prod.tiene_variantes then
      select * into v_mod from public.modelos
        where id = (v_item->>'modelo_id')::bigint and producto_id = v_prod.id;
      if not found then
        raise exception 'Falta elegir el modelo de "%"', v_prod.nombre;
      end if;
      if v_mod.stock < v_cant then
        raise exception 'Sin stock suficiente de "% — %"', v_prod.nombre, v_mod.nombre;
      end if;
      v_modelo := v_mod.nombre; v_modelo_id := v_mod.id;
    elsif v_prod.stock < v_cant then
      raise exception 'Sin stock suficiente de "%"', v_prod.nombre;
    end if;

    insert into public.pedido_items (pedido_id, producto_id, modelo_id, nombre, modelo, precio, cantidad, subtotal)
    values (v_pedido_id, v_prod.id, v_modelo_id, v_prod.nombre, v_modelo,
            v_prod.precio, v_cant, v_prod.precio * v_cant);

    v_total := v_total + v_prod.precio * v_cant;
    v_lineas := v_lineas || jsonb_build_object(
      'nombre', v_prod.nombre, 'modelo', v_modelo, 'precio', v_prod.precio,
      'cantidad', v_cant, 'subtotal', v_prod.precio * v_cant);
  end loop;

  update public.pedidos set total = v_total where id = v_pedido_id;

  return jsonb_build_object('id', v_pedido_id, 'codigo', v_codigo, 'total', v_total, 'items', v_lineas);
end $$;

-- ── Stock: descuenta al confirmar, repone al cancelar ────────
create or replace function public.ajustar_stock_por_estado()
returns trigger language plpgsql security definer set search_path = public as $$
declare it record;
begin
  -- pendiente → confirmado/enviado/entregado: descontar (una sola vez)
  if new.estado in ('confirmado','enviado','entregado') and not old.stock_descontado then
    for it in select producto_id, modelo_id, cantidad from public.pedido_items where pedido_id = new.id loop
      if it.modelo_id is not null then
        update public.modelos set stock = greatest(stock - it.cantidad, 0) where id = it.modelo_id;
      elsif it.producto_id is not null then
        update public.productos set stock = greatest(stock - it.cantidad, 0) where id = it.producto_id;
      end if;
    end loop;
    new.stock_descontado := true;
  -- cualquier estado → cancelado: reponer si se había descontado
  elsif new.estado = 'cancelado' and old.stock_descontado then
    for it in select producto_id, modelo_id, cantidad from public.pedido_items where pedido_id = new.id loop
      if it.modelo_id is not null then
        update public.modelos set stock = stock + it.cantidad where id = it.modelo_id;
      elsif it.producto_id is not null then
        update public.productos set stock = stock + it.cantidad where id = it.producto_id;
      end if;
    end loop;
    new.stock_descontado := false;
  end if;
  return new;
end $$;

drop trigger if exists trg_pedidos_stock on public.pedidos;
create trigger trg_pedidos_stock
  before update of estado on public.pedidos
  for each row when (old.estado is distinct from new.estado)
  execute function public.ajustar_stock_por_estado();

-- ── RLS ──────────────────────────────────────────────────────
alter table public.config       enable row level security;
alter table public.categorias   enable row level security;
alter table public.productos    enable row level security;
alter table public.modelos      enable row level security;
alter table public.admins       enable row level security;
alter table public.clientes     enable row level security;
alter table public.carritos     enable row level security;
alter table public.pedidos      enable row level security;
alter table public.pedido_items enable row level security;

-- config
drop policy if exists config_read  on public.config;
drop policy if exists config_admin on public.config;
create policy config_read  on public.config for select using (true);
create policy config_admin on public.config for update using (public.es_admin()) with check (public.es_admin());

-- categorias
drop policy if exists categorias_read  on public.categorias;
drop policy if exists categorias_admin on public.categorias;
create policy categorias_read  on public.categorias for select using (activa or public.es_admin());
create policy categorias_admin on public.categorias for all using (public.es_admin()) with check (public.es_admin());

-- productos
drop policy if exists productos_read  on public.productos;
drop policy if exists productos_admin on public.productos;
create policy productos_read  on public.productos for select using (disponible or public.es_admin());
create policy productos_admin on public.productos for all using (public.es_admin()) with check (public.es_admin());

-- modelos
drop policy if exists modelos_read  on public.modelos;
drop policy if exists modelos_admin on public.modelos;
create policy modelos_read  on public.modelos for select using (true);
create policy modelos_admin on public.modelos for all using (public.es_admin()) with check (public.es_admin());

-- admins: cada usuario solo ve si él mismo es admin; nadie escribe desde la API
drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select using (user_id = auth.uid());

-- clientes
drop policy if exists clientes_read   on public.clientes;
drop policy if exists clientes_update on public.clientes;
drop policy if exists clientes_delete on public.clientes;
create policy clientes_read   on public.clientes for select using (id = auth.uid() or public.es_admin());
create policy clientes_update on public.clientes for update using (id = auth.uid()) with check (id = auth.uid());
create policy clientes_delete on public.clientes for delete using (public.es_admin());

-- carritos
drop policy if exists carritos_own on public.carritos;
create policy carritos_own on public.carritos for all
  using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());

-- pedidos: SIN policy de insert (solo crear_pedido, que es security definer)
drop policy if exists pedidos_read   on public.pedidos;
drop policy if exists pedidos_update on public.pedidos;
drop policy if exists pedidos_delete on public.pedidos;
create policy pedidos_read   on public.pedidos for select using (cliente_id = auth.uid() or public.es_admin());
create policy pedidos_update on public.pedidos for update using (public.es_admin()) with check (public.es_admin());
create policy pedidos_delete on public.pedidos for delete using (public.es_admin());

-- pedido_items: SIN policy de insert
drop policy if exists items_read   on public.pedido_items;
drop policy if exists items_delete on public.pedido_items;
create policy items_read on public.pedido_items for select using (
  exists (select 1 from public.pedidos p
          where p.id = pedido_id and (p.cliente_id = auth.uid() or public.es_admin())));
create policy items_delete on public.pedido_items for delete using (public.es_admin());

-- ── Vistas de reportes (security_invoker: respetan RLS del que consulta) ──
create or replace view public.v_ventas_mensuales with (security_invoker = true) as
  select date_trunc('month', creado) as mes, count(*)::int as pedidos, coalesce(sum(total),0)::bigint as total
  from public.pedidos where estado <> 'cancelado' group by 1;

create or replace view public.v_mas_vendidos with (security_invoker = true) as
  select i.producto_id, i.nombre, sum(i.cantidad)::int as unidades, sum(i.subtotal)::bigint as total
  from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
  where p.estado <> 'cancelado' group by i.producto_id, i.nombre;

-- ── Privilegios explícitos (no depender de los defaults de Supabase) ──
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.config, public.categorias, public.productos, public.modelos to anon, authenticated;
grant update on public.config to authenticated;
grant insert, update, delete on public.categorias, public.productos, public.modelos to authenticated;

grant select on public.admins to authenticated;
grant select, update on public.clientes to authenticated;
grant delete on public.clientes to authenticated;
grant select, insert, update, delete on public.carritos to authenticated;
grant select, update, delete on public.pedidos to authenticated;
grant select, delete on public.pedido_items to authenticated;

grant usage, select on all sequences in schema public to authenticated;  -- identity de categorias/modelos

grant select on public.v_ventas_mensuales, public.v_mas_vendidos to authenticated;

grant execute on function public.es_admin()        to anon, authenticated;
grant execute on function public.crear_pedido(jsonb, text, jsonb, text) to authenticated;
-- handle_new_user y ajustar_stock_por_estado los ejecutan triggers (no necesitan grant)

-- ── Storage: bucket público de imágenes de productos ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 1048576, array['image/webp','image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists productos_img_read   on storage.objects;
drop policy if exists productos_img_insert on storage.objects;
drop policy if exists productos_img_update on storage.objects;
drop policy if exists productos_img_delete on storage.objects;
create policy productos_img_read   on storage.objects for select using (bucket_id = 'productos');
create policy productos_img_insert on storage.objects for insert with check (bucket_id = 'productos' and public.es_admin());
create policy productos_img_update on storage.objects for update using (bucket_id = 'productos' and public.es_admin());
create policy productos_img_delete on storage.objects for delete using (bucket_id = 'productos' and public.es_admin());
