-- Aislamiento de tenants (03-02 §8, casos 1 y 3).
begin;
select plan(3);

insert into public.tenants (id, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B');

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com');

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin');

set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

select is(
  (select count(*)::int from public.tenants),
  1,
  'usuario del tenant A ve exactamente una fila (la suya), no la del tenant B'
);

select is(
  (select id from public.tenants limit 1),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'la fila visible es la del tenant A'
);

reset role;
delete from public.memberships where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "app_metadata": {}}';

select is(
  (select count(*)::int from public.tenants),
  0,
  'usuario sin membership no lee ningun tenant'
);

select * from finish();
rollback;
