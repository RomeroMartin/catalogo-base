-- ============================================================
-- CATALOGO-BASE · supabase/tests/rls_tests.sql
-- Pegar en Supabase → SQL Editor y ejecutar. NO deja datos: el script
-- termina siempre con un error "RESULTADO ..." que revierte todo.
-- Si dice "TODOS LOS TESTS OK" la seguridad funciona.
-- ============================================================
do $$
declare
  ua uuid := gen_random_uuid();   -- cliente A
  ub uuid := gen_random_uuid();   -- cliente B
  uadm uuid := gen_random_uuid(); -- admin
  cat_id bigint;
  p1 uuid; p2 uuid; p3 uuid; m1 bigint;
  n int; n2 int; total int := 0;
  fallos text[] := '{}';
  r jsonb;
  ped_a uuid;
begin
  -- ── Datos de prueba (como superusuario) ──
  insert into auth.users (id, email, raw_user_meta_data) values
    (ua, 'a@test.local', '{"nombre":"Cliente A","telefono":"111"}'),
    (ub, 'b@test.local', '{"nombre":"Cliente B"}'),
    (uadm, 'admin@test.local', '{"nombre":"Admin"}');
  insert into public.admins (user_id) values (uadm);
  insert into public.config (id, nombre_tienda, whatsapp) values (1, 'Test', '5491100000000')
    on conflict (id) do nothing;
  insert into public.categorias (nombre, slug) values ('Cat Test', 'cat-test') returning id into cat_id;
  insert into public.productos (nombre, categoria_id, precio, stock) values ('Simple', cat_id, 1000, 5) returning id into p1;
  insert into public.productos (nombre, categoria_id, precio, tiene_variantes) values ('Variantes', cat_id, 2000, true) returning id into p2;
  insert into public.modelos (producto_id, nombre, stock) values (p2, 'Rojo', 2) returning id into m1;
  insert into public.productos (nombre, categoria_id, precio, stock, disponible) values ('Oculto', cat_id, 500, 9, false) returning id into p3;

  total := total+1;
  select count(*) into n from public.clientes where id in (ua, ub, uadm);
  if n <> 3 then fallos := array_append(fallos, 'trigger handle_new_user no creó los 3 clientes'); end if;

  -- ═══ ANÓNIMO ═══
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;

  total := total+1;
  select count(*) into n from public.productos where categoria_id = cat_id;
  if n <> 2 then fallos := array_append(fallos, format('anon ve %s productos (esperado 2, sin el oculto)', n)); end if;

  total := total+1;
  begin insert into public.productos (nombre, categoria_id, precio) values ('X', cat_id, 1);
        fallos := array_append(fallos, 'anon pudo insertar producto');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  begin perform public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', p1, 'cantidad', 1)), 'retiro');
        fallos := array_append(fallos, 'anon pudo ejecutar crear_pedido');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  begin perform 1 from public.v_ventas_mensuales;
        fallos := array_append(fallos, 'anon pudo leer reportes');
  exception when insufficient_privilege then null; end;

  total := total+1;
  begin select count(*) into n from public.clientes;
        if n <> 0 then fallos := array_append(fallos, 'anon ve clientes'); end if;
  exception when insufficient_privilege then null; end;
  reset role;

  -- ═══ CLIENTE A ═══
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;

  total := total+1;
  begin
    r := public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', p1, 'cantidad', 2)), 'retiro', null, 'nota');
    ped_a := (r->>'id')::uuid;
    if (r->>'total')::int <> 2000 then fallos := array_append(fallos, 'total mal calculado'); end if;
    if r->>'codigo' !~ '^[A-Z]+-[0-9]{5}$' then fallos := array_append(fallos, 'código con formato inesperado: ' || (r->>'codigo')); end if;
  exception when others then fallos := array_append(fallos, 'A no pudo crear pedido válido: ' || sqlerrm); end;

  total := total+1;
  begin
    r := public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', p2, 'modelo_id', m1, 'cantidad', 1)), 'envio',
                             '{"calle":"X 1"}'::jsonb);
    if (r->>'total')::int <> 2000 then fallos := array_append(fallos, 'pedido con variante: total mal'); end if;
  exception when others then fallos := array_append(fallos, 'A no pudo pedir variante: ' || sqlerrm); end;

  total := total+1;
  begin perform public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', p2, 'cantidad', 1)), 'retiro');
        fallos := array_append(fallos, 'se aceptó producto con variantes sin modelo');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  begin perform public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', p1, 'cantidad', 6)), 'retiro');
        fallos := array_append(fallos, 'se aceptó cantidad mayor al stock');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  begin perform public.crear_pedido(jsonb_build_array(jsonb_build_object('producto_id', p3, 'cantidad', 1)), 'retiro');
        fallos := array_append(fallos, 'se aceptó producto no disponible');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  begin perform public.crear_pedido('[]'::jsonb, 'retiro');
        fallos := array_append(fallos, 'se aceptó carrito vacío');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  begin insert into public.pedidos (codigo, cliente_id, total, metodo_entrega) values ('HACK-1', ua, 1, 'retiro');
        fallos := array_append(fallos, 'A pudo insertar pedido directo');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  begin insert into public.pedido_items (pedido_id, nombre, precio, cantidad, subtotal) values (ped_a, 'x', 1, 1, 1);
        fallos := array_append(fallos, 'A pudo insertar ítem directo');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  update public.pedidos set estado = 'entregado' where id = ped_a;
  get diagnostics n = row_count;
  if n <> 0 then fallos := array_append(fallos, 'A pudo cambiar el estado de su pedido'); end if;

  total := total+1;
  select count(*) into n from public.pedidos;
  if n <> 2 then fallos := array_append(fallos, format('A ve %s pedidos (esperado 2)', n)); end if;

  total := total+1;
  select count(*) into n from public.pedido_items;
  if n <> 2 then fallos := array_append(fallos, format('A ve %s ítems (esperado 2)', n)); end if;

  total := total+1;
  select count(*) into n from public.clientes;
  if n <> 1 then fallos := array_append(fallos, format('A ve %s clientes (esperado 1)', n)); end if;

  total := total+1;
  update public.clientes set telefono = '999' where id = ua;
  get diagnostics n = row_count;
  if n <> 1 then fallos := array_append(fallos, 'A no pudo editar su propio perfil'); end if;

  total := total+1;
  update public.clientes set telefono = '999' where id = ub;
  get diagnostics n = row_count;
  if n <> 0 then fallos := array_append(fallos, 'A pudo editar el perfil de B'); end if;

  total := total+1;
  insert into public.carritos (cliente_id, items) values (ua, '[]');
  begin insert into public.carritos (cliente_id, items) values (ub, '[]');
        fallos := array_append(fallos, 'A pudo crear el carrito de B');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  update public.productos set precio = 1 where id = p1;
  get diagnostics n = row_count;
  if n <> 0 then fallos := array_append(fallos, 'A pudo editar un producto'); end if;

  total := total+1;
  update public.config set nombre_tienda = 'hack';
  get diagnostics n = row_count;
  if n <> 0 then fallos := array_append(fallos, 'A pudo editar la config'); end if;

  total := total+1;
  begin insert into public.admins (user_id) values (ua);
        fallos := array_append(fallos, 'A pudo hacerse admin');
  exception when insufficient_privilege or raise_exception or invalid_authorization_specification then null; end;

  total := total+1;
  select count(*) into n from public.productos where id = p3;
  if n <> 0 then fallos := array_append(fallos, 'A ve un producto no disponible'); end if;
  reset role;

  -- ═══ CLIENTE B ═══
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;

  total := total+1;
  select count(*) into n from public.pedidos;
  if n <> 0 then fallos := array_append(fallos, format('B ve %s pedidos de A', n)); end if;

  total := total+1;
  select count(*) into n from public.pedido_items;
  if n <> 0 then fallos := array_append(fallos, format('B ve %s ítems de A', n)); end if;

  total := total+1;
  select count(*) into n from public.carritos;
  if n <> 0 then fallos := array_append(fallos, 'B ve el carrito de A'); end if;
  reset role;

  -- ═══ ADMIN ═══
  perform set_config('request.jwt.claims', json_build_object('sub', uadm, 'role', 'authenticated')::text, true);
  set local role authenticated;

  total := total+1;
  select count(*) into n from public.pedidos;
  if n <> 2 then fallos := array_append(fallos, format('admin ve %s pedidos (esperado 2)', n)); end if;

  total := total+1;
  select count(*) into n from public.productos where id = p3;
  if n <> 1 then fallos := array_append(fallos, 'admin no ve el producto oculto'); end if;

  total := total+1;
  begin insert into public.productos (nombre, categoria_id, precio) values ('Nuevo', cat_id, 10);
  exception when others then fallos := array_append(fallos, 'admin no pudo crear producto: ' || sqlerrm); end;

  -- stock: confirmar descuenta, cancelar repone
  total := total+1;
  update public.pedidos set estado = 'confirmado' where id = ped_a;
  select stock into n from public.productos where id = p1;
  if n <> 3 then fallos := array_append(fallos, format('al confirmar el stock quedó %s (esperado 3)', n)); end if;

  total := total+1;
  select coalesce(sum(v.total),0), coalesce(sum(v.pedidos),0) into n, n2 from public.v_ventas_mensuales v;
  if n <> 4000 or n2 <> 2 then fallos := array_append(fallos, format('vista ventas: total=%s pedidos=%s (esperado 4000/2)', n, n2)); end if;

  total := total+1;
  select count(*) into n from public.v_mas_vendidos;
  if n <> 2 then fallos := array_append(fallos, format('vista más vendidos: %s filas (esperado 2)', n)); end if;

  total := total+1;
  update public.pedidos set estado = 'enviado' where id = ped_a;   -- no debe descontar dos veces
  select stock into n from public.productos where id = p1;
  if n <> 3 then fallos := array_append(fallos, format('descuento doble de stock: %s (esperado 3)', n)); end if;

  total := total+1;
  update public.pedidos set estado = 'cancelado' where id = ped_a;
  select stock into n from public.productos where id = p1;
  if n <> 5 then fallos := array_append(fallos, format('al cancelar el stock quedó %s (esperado 5)', n)); end if;
  reset role;

  if array_length(fallos, 1) is null then
    raise exception 'RESULTADO: TODOS LOS TESTS OK (%/%). Se revirtió todo, no quedó nada guardado.', total, total;
  else
    raise exception 'RESULTADO: FALLARON % de % tests: %', array_length(fallos, 1), total, array_to_string(fallos, ' | ');
  end if;
end $$;
