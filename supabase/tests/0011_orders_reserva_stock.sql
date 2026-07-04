-- Reserva atomica de stock, liberacion al cancelar, y expiracion
-- automatica (03-05 §4, §5; LOOP C).
begin;
select plan(9);

insert into public.tenants (id, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'staff-a@example.com');

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'staff');

insert into public.productos (id, tenant_id, nombre, precio, stock) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Producto con stock 2', 10000, 2);

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

-- Pedido 1: reserva 1 unidad -> stock queda en 1.
insert into public.orders (id, tenant_id, total) values
  ('00000000-a000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 10000);
insert into public.order_items (order_id, tenant_id, producto_id, cantidad, precio_unitario) values
  ('00000000-a000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', 1, 10000);

select public.solicitar_pago('00000000-a000-0000-0000-000000000001');

select is(
  (select stock from public.productos where id = 'f0000000-0000-0000-0000-000000000001'),
  1,
  'reservar 1 unidad decrementa el stock de 2 a 1'
);

select is(
  (select liberada from public.stock_reservations where order_id = '00000000-a000-0000-0000-000000000001'),
  false,
  'la reserva queda activa (no liberada) mientras esta pendiente_pago'
);

-- Cancelar libera la reserva: stock vuelve a 2.
select public.cancelar_pedido('00000000-a000-0000-0000-000000000001');

select is(
  (select stock from public.productos where id = 'f0000000-0000-0000-0000-000000000001'),
  2,
  'cancelar el pedido libera la reserva: stock vuelve a 2'
);

select is(
  (select liberada from public.stock_reservations where order_id = '00000000-a000-0000-0000-000000000001'),
  true,
  'la reserva queda marcada liberada tras cancelar'
);

-- Pedido 2: pedir mas de lo disponible falla limpio, sin tocar el stock.
insert into public.orders (id, tenant_id, total) values
  ('00000000-a000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 100000);
insert into public.order_items (order_id, tenant_id, producto_id, cantidad, precio_unitario) values
  ('00000000-a000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', 10, 10000);

select throws_ok(
  $$select public.solicitar_pago('00000000-a000-0000-0000-000000000002')$$,
  null,
  'stock insuficiente para producto f0000000-0000-0000-0000-000000000001',
  'pedir 10 unidades con stock=2 falla limpio'
);

select is(
  (select stock from public.productos where id = 'f0000000-0000-0000-0000-000000000001'),
  2,
  'el intento fallido no dejo el stock decrementado a medias'
);

select is(
  (select estado from public.orders where id = '00000000-a000-0000-0000-000000000002'),
  'creado',
  'el pedido fallido se queda en creado (nunca llego a pendiente_pago)'
);

-- LOOP C: pedido 3 con TTL ya vencido (ttl negativo simula el paso del tiempo).
insert into public.orders (id, tenant_id, total) values
  ('00000000-a000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 10000);
insert into public.order_items (order_id, tenant_id, producto_id, cantidad, precio_unitario) values
  ('00000000-a000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', 1, 10000);

select public.solicitar_pago('00000000-a000-0000-0000-000000000003', -10);

reset role; -- expirar_reservas_vencidas() esta revocada para authenticated (03-02 §5.7)
select public.expirar_reservas_vencidas();

select is(
  (select estado from public.orders where id = '00000000-a000-0000-0000-000000000003'),
  'expirado',
  'expirar_reservas_vencidas() mueve el pedido vencido a expirado'
);

select is(
  (select stock from public.productos where id = 'f0000000-0000-0000-0000-000000000001'),
  2,
  'la expiracion libero el stock reservado (vuelve a 2)'
);

select * from finish();
rollback;
