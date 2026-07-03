-- Aislamiento de profiles: propio perfil, companeros de tenant, y
-- aislamiento cross-tenant (03-02 §8, casos 1 y 3; 03-03 §4).
begin;
select plan(4);

insert into public.tenants (id, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'a1@example.com'),
  ('a0000000-0000-0000-0000-000000000002', 'a2@example.com'),
  ('b0000000-0000-0000-0000-000000000001', 'b1@example.com');

update public.profiles set full_name = 'Usuario A1' where id = 'a0000000-0000-0000-0000-000000000001';
update public.profiles set full_name = 'Usuario A2' where id = 'a0000000-0000-0000-0000-000000000002';
update public.profiles set full_name = 'Usuario B1' where id = 'b0000000-0000-0000-0000-000000000001';

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'admin'),
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 'staff'),
  ('22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-000000000001', 'admin');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

select is(
  (select full_name from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'),
  'Usuario A1',
  'A1 lee su propio perfil'
);

select is(
  (select full_name from public.profiles where id = 'a0000000-0000-0000-0000-000000000002'),
  'Usuario A2',
  'A1 lee el perfil de A2, companero de su mismo tenant'
);

select is(
  (select count(*)::int from public.profiles where id = 'b0000000-0000-0000-0000-000000000001'),
  0,
  'A1 no lee el perfil de B1 (tenant distinto, sin membership compartida)'
);

update public.profiles set full_name = 'hackeado' where id = 'a0000000-0000-0000-0000-000000000002';

select is(
  (select full_name from public.profiles where id = 'a0000000-0000-0000-0000-000000000002'),
  'Usuario A2',
  'A1 no puede editar el perfil de A2 (solo lectura de companeros, no escritura)'
);

select * from finish();
rollback;
