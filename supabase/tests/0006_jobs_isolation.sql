-- Aislamiento de jobs (03-02 §8, casos 1 y 3).
begin;
select plan(2);

insert into public.tenants (id, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B');

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@example.com');

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin');

insert into public.jobs (tenant_id, idempotency_key, job_type, payload) values
  ('11111111-1111-1111-1111-111111111111', 'key-a-1', 'webhook.echo', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'key-b-1', 'webhook.echo', '{}');

set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

select is(
  (select count(*)::int from public.jobs),
  1,
  'usuario del tenant A solo ve el job de su tenant, no el del tenant B'
);

reset role;
delete from public.memberships where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "app_metadata": {}}';

select is(
  (select count(*)::int from public.jobs),
  0,
  'usuario sin membership no ve ningun job'
);

select * from finish();
rollback;
