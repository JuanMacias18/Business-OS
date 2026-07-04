-- LOOP A (03-05 §8.1): transiciones validas e invalidas de la FSM.
begin;
select plan(11);

insert into public.tenants (id, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'staff-a@example.com');

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'staff');

insert into public.productos (id, tenant_id, nombre, precio, stock) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Producto A', 10000, 5);

-- Pedido "de control": lo llevamos por el camino feliz completo.
insert into public.orders (id, tenant_id, total) values
  ('00000000-a000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 10000);
insert into public.order_items (order_id, tenant_id, producto_id, cantidad, precio_unitario) values
  ('00000000-a000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', 1, 10000);

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

-- creado -> pendiente_pago (valido)
select lives_ok(
  $$select public.solicitar_pago('00000000-a000-0000-0000-000000000001')$$,
  'creado -> pendiente_pago es una transicion valida'
);

select is(
  (select estado from public.orders where id = '00000000-a000-0000-0000-000000000001'),
  'pendiente_pago',
  'el pedido de control quedo en pendiente_pago'
);

-- pendiente_pago -> confirmado (valido)
select lives_ok(
  $$select public.confirmar_pago('00000000-a000-0000-0000-000000000001')$$,
  'pendiente_pago -> confirmado es una transicion valida'
);

-- confirmado -> preparando (valido)
select lives_ok(
  $$select public.avanzar_pedido('00000000-a000-0000-0000-000000000001', 'preparando')$$,
  'confirmado -> preparando es una transicion valida'
);

-- preparando -> entregado (valido)
select lives_ok(
  $$select public.avanzar_pedido('00000000-a000-0000-0000-000000000001', 'entregado')$$,
  'preparando -> entregado es una transicion valida'
);

-- entregado -> cualquier otro estado: invalido, ni siquiera la funcion lo permite
-- (avanzar_pedido no filtra por estado actual; el TRIGGER es quien rechaza).
select throws_ok(
  $$select public.avanzar_pedido('00000000-a000-0000-0000-000000000001', 'preparando')$$,
  null,
  'transicion invalida de entregado a preparando',
  'entregado -> preparando es invalida (no se puede reabrir un pedido terminado)'
);

reset role;

-- Pedido de control 2: para probar saltos invalidos directos (bypass
-- de las funciones, como postgres) contra el TRIGGER puro.
insert into public.orders (id, tenant_id, total) values
  ('00000000-a000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 10000);

select throws_ok(
  $$update public.orders set estado = 'confirmado' where id = '00000000-a000-0000-0000-000000000002'$$,
  null,
  'transicion invalida de creado a confirmado',
  'el trigger rechaza saltarse pendiente_pago (creado -> confirmado directo)'
);

select throws_ok(
  $$update public.orders set estado = 'preparando' where id = '00000000-a000-0000-0000-000000000002'$$,
  null,
  'transicion invalida de creado a preparando',
  'el trigger rechaza creado -> preparando directo'
);

-- confirmar_pago() sobre un pedido que sigue en creado (nunca se llamo
-- solicitar_pago): la funcion misma lo rechaza antes de llegar al trigger.
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

select throws_ok(
  $$select public.confirmar_pago('00000000-a000-0000-0000-000000000002')$$,
  null,
  'pedido 00000000-a000-0000-0000-000000000002 no existe, no es de tu tenant, o no esta pendiente de pago',
  'confirmar_pago() rechaza un pedido que sigue en creado'
);

-- cancelar_pedido() sobre el pedido de control (ya entregado): rechazado.
select throws_ok(
  $$select public.cancelar_pedido('00000000-a000-0000-0000-000000000001')$$,
  null,
  'pedido 00000000-a000-0000-0000-000000000001 no existe, no es de tu tenant, o no esta pendiente de pago',
  'cancelar_pedido() rechaza un pedido ya entregado'
);

select is(
  (select estado from public.orders where id = '00000000-a000-0000-0000-000000000001'),
  'entregado',
  'el pedido de control sigue entregado (el intento de cancelar no lo toco)'
);

select * from finish();
rollback;
