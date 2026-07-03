-- Aislamiento y autorizacion de productos (03-02 §8, casos 1, 3, 4).
begin;
select plan(6);

insert into public.tenants (id, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin-a@example.com'),
  ('a0000000-0000-0000-0000-000000000002', 'staff-a@example.com');

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'admin'),
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'staff');

insert into public.productos (id, tenant_id, nombre, precio) values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Producto A', 10000),
  ('f0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Producto B', 20000);

-- Caso 1: aislamiento de lectura por tenant.
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

select is(
  (select count(*)::int from public.productos),
  1,
  'admin del tenant A solo ve el producto de su tenant'
);

-- Staff SI puede leer el catalogo (lo necesita para tomar pedidos).
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

select is(
  (select count(*)::int from public.productos),
  1,
  'staff del tenant A tambien puede leer el catalogo'
);

-- Caso 4: staff no puede insertar productos.
select throws_ok(
  $$insert into public.productos (tenant_id, nombre, precio)
    values ('11111111-1111-1111-1111-111111111111', 'Producto de staff', 5000)$$,
  '42501',
  null,
  'staff no puede agregar productos al catalogo'
);

-- Admin SI puede insertar productos en su propio tenant.
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

insert into public.productos (tenant_id, nombre, precio)
values ('11111111-1111-1111-1111-111111111111', 'Producto de admin', 7000);

reset role;
select is(
  (select count(*)::int from public.productos where nombre = 'Producto de admin'),
  1,
  'admin agrego el producto exitosamente'
);

-- Admin de A no puede editar el producto del tenant B.
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

update public.productos set precio = 1 where id = 'f0000000-0000-0000-0000-000000000002';

reset role;
select is(
  (select precio from public.productos where id = 'f0000000-0000-0000-0000-000000000002'),
  20000::numeric,
  'admin de A no pudo alterar el precio del producto de B'
);

-- Caso 3: sin membership no se ve nada.
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {}}';

select is(
  (select count(*)::int from public.productos),
  0,
  'sin membership (tenant_id ausente del JWT) no se ve ningun producto'
);

select * from finish();
rollback;
