-- Aislamiento de orders/order_items/stock_reservations (03-02 §8).
begin;
select plan(4);

insert into public.tenants (id, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'staff-a@example.com');

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'staff');

insert into public.productos (id, tenant_id, nombre, precio, stock) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Producto A', 10000, 5),
  ('f0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Producto B', 20000, 5);

insert into public.orders (id, tenant_id, total) values
  ('00000000-a000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 10000),
  ('00000000-b000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 20000);

insert into public.order_items (order_id, tenant_id, producto_id, cantidad, precio_unitario) values
  ('00000000-a000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', 1, 10000),
  ('00000000-b000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'f0000000-0000-0000-0000-000000000002', 1, 20000);

insert into public.stock_reservations (order_id, producto_id, tenant_id, cantidad) values
  ('00000000-a000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1),
  ('00000000-b000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 1);

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

select is(
  (select count(*)::int from public.orders),
  1,
  'staff del tenant A solo ve el pedido de su tenant'
);

select is(
  (select count(*)::int from public.order_items),
  1,
  'staff del tenant A solo ve los items de pedidos de su tenant'
);

select is(
  (select count(*)::int from public.stock_reservations),
  1,
  'staff del tenant A solo ve las reservas de su tenant'
);

reset role;
delete from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {}}';

select is(
  (select count(*)::int from public.orders),
  0,
  'sin membership no se ve ningun pedido'
);

select * from finish();
rollback;
