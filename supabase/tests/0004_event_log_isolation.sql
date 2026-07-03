-- Aislamiento de event_log: solo lectura, por tenant (03-02 §8, casos 1 y 3).
begin;
select plan(2);

insert into public.tenants (id, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B');

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com');

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin');

insert into public.event_log (tenant_id, correlation_id, event_type, payload) values
  ('11111111-1111-1111-1111-111111111111', gen_random_uuid(), 'tenant.created', '{}'),
  ('22222222-2222-2222-2222-222222222222', gen_random_uuid(), 'tenant.created', '{}');

set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

select is(
  (select count(*)::int from public.event_log),
  1,
  'usuario del tenant A solo ve el evento de su tenant, no el del tenant B'
);

reset role;
delete from public.memberships where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "app_metadata": {}}';

select is(
  (select count(*)::int from public.event_log),
  0,
  'usuario sin membership no lee ningun evento'
);

select * from finish();
rollback;
