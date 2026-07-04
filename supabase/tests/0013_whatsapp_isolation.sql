-- Aislamiento de whatsapp_numbers (deny-by-default total, igual
-- criterio que payment_credentials, 03-07/0012) y whatsapp_conversations
-- (03-08 §7.3).
begin;
select plan(5);

insert into public.tenants (id, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'staff-a@example.com');

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'staff');

select vault.create_secret('dummy-access-token-para-test', 'test-whatsapp-token', 'dummy') as token_id \gset

insert into public.whatsapp_numbers (tenant_id, phone_number_id, access_token_secret_id) values
  ('11111111-1111-1111-1111-111111111111', 'phone-number-id-tenant-a', :'token_id');

insert into public.whatsapp_conversations (tenant_id, customer_phone, state) values
  ('11111111-1111-1111-1111-111111111111', '573000000001', 'saludo'),
  ('22222222-2222-2222-2222-222222222222', '573000000002', 'saludo');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

-- Deny-by-default: authenticated no tiene GRANT de tabla base sobre
-- whatsapp_numbers (el alta del numero es parte del onboarding, 05-02).
select throws_ok(
  $$select count(*) from public.whatsapp_numbers$$,
  '42501',
  null,
  'authenticated no puede ni siquiera intentar leer whatsapp_numbers (sin GRANT de tabla base)'
);

select is(
  (select count(*)::int from public.whatsapp_conversations),
  1,
  'staff del tenant A solo ve la conversacion de su tenant'
);

select is(
  (select customer_phone from public.whatsapp_conversations limit 1),
  '573000000001',
  'la conversacion visible es la del tenant A, no la de B'
);

-- Staff no puede insertar/editar conversaciones directo: sin policy
-- de insert para authenticated (03-08 §3, deny-by-default).
select throws_ok(
  $$insert into public.whatsapp_conversations (tenant_id, customer_phone)
    values ('11111111-1111-1111-1111-111111111111', '573000000099')$$,
  '42501',
  null,
  'staff no puede insertar conversaciones directo -- solo via avanzar_conversacion_por_mensaje()'
);

reset role;
delete from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {}}';

select is(
  (select count(*)::int from public.whatsapp_conversations),
  0,
  'sin membership no se ve ninguna conversacion'
);

select * from finish();
rollback;
