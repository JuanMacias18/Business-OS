-- Aislamiento y autorizacion de memberships (03-02 §8, casos 1, 2 y 4;
-- 03-03 §4: solo un admin invita, y solo dentro de su propio tenant).
begin;
select plan(5);

insert into public.tenants (id, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin-a@example.com'),
  ('a0000000-0000-0000-0000-000000000002', 'staff-a@example.com'),
  ('c0000000-0000-0000-0000-000000000001', 'nuevo@example.com');

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'admin'),
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'staff');

-- Caso 1: un usuario solo ve su propia fila de membership, no la de su companero.
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

select is(
  (select count(*)::int from public.memberships),
  1,
  'admin de tenant A solo ve su propia fila de membership'
);

-- Caso 2: el admin SI puede invitar a un miembro nuevo a su propio tenant.
insert into public.memberships (tenant_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000001', 'staff');

reset role;
select is(
  (select count(*)::int from public.memberships where user_id = 'c0000000-0000-0000-0000-000000000001'),
  1,
  'el admin invito exitosamente al nuevo miembro a su tenant'
);
delete from public.memberships where user_id = 'c0000000-0000-0000-0000-000000000001';

-- Caso 4: un staff (no admin) NO puede invitar miembros nuevos.
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000002", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

select throws_ok(
  $$insert into public.memberships (tenant_id, user_id, role)
    values ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000001', 'staff')$$,
  '42501',
  null,
  'un staff (no admin) no puede invitar miembros nuevos'
);

-- Caso: el admin de A no puede crear una membership para el tenant B.
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

select throws_ok(
  $$insert into public.memberships (tenant_id, user_id, role)
    values ('22222222-2222-2222-2222-222222222222', 'c0000000-0000-0000-0000-000000000001', 'staff')$$,
  '42501',
  null,
  'el admin de tenant A no puede invitar miembros al tenant B'
);

-- Caso 3: usuario sin membership no ve nada.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "c0000000-0000-0000-0000-000000000001", "app_metadata": {}}';

select is(
  (select count(*)::int from public.memberships),
  0,
  'usuario sin membership no ve ninguna fila de memberships'
);

select * from finish();
rollback;
