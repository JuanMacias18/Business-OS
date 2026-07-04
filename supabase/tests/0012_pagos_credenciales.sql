-- payment_credentials: deny-by-default total para authenticated
-- (03-07 §4), y preparar_checkout_pago() calcula la firma de
-- integridad correctamente (03-07 §2).
begin;
select plan(5);

insert into public.tenants (id, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'staff-a@example.com');

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'staff');

-- Credenciales DUMMY, cifradas via Vault: esta prueba solo verifica
-- que preparar_checkout_pago() implementa correctamente la formula
-- documentada (03-07 §2) -- no necesita el secreto real de Wompi para
-- eso. Las llaves reales de sandbox (T0.5) solo se usan en los tests
-- de Deno que llaman a la API real, leidas de variables de entorno,
-- nunca hardcodeadas (este repo es publico).
select vault.create_secret('dummy-private-key-para-test', 'test-private-key', 'dummy') as private_id \gset
select vault.create_secret('dummy-events-secret-para-test', 'test-events-secret', 'dummy') as events_id \gset
select vault.create_secret('dummy-integrity-secret-para-test', 'test-integrity-secret', 'dummy') as integrity_id \gset

insert into public.payment_credentials (tenant_id, public_key, private_key_secret_id, events_secret_id, integrity_secret_id)
values (
  '11111111-1111-1111-1111-111111111111',
  'pub_test_dummy00000000000000000',
  :'private_id', :'events_id', :'integrity_id'
);

insert into public.orders (id, tenant_id, total, estado) values
  ('00000000-a000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 50000, 'pendiente_pago');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

-- Deny-by-default (mas estricto que RLS sola): authenticated no tiene
-- ni siquiera el GRANT de tabla base sobre payment_credentials, asi
-- que cualquier intento de leerla falla con permission denied, no con
-- una lista vacia via policy.
select throws_ok(
  $$select count(*) from public.payment_credentials$$,
  '42501',
  null,
  'authenticated no puede ni siquiera intentar leer payment_credentials (sin GRANT de tabla base)'
);

-- La firma calculada por la funcion coincide con el algoritmo documentado
-- (03-07 §2): sha256(reference + amount_in_cents + currency + integrity_secret).
select is(
  (select signature from public.preparar_checkout_pago('00000000-a000-0000-0000-000000000001')),
  encode(extensions.digest('00000000-a000-0000-0000-0000000000015000000COPdummy-integrity-secret-para-test', 'sha256'), 'hex'),
  'la firma de integridad calculada coincide con sha256(reference+amount+currency+secreto)'
);

select is(
  (select public_key from public.preparar_checkout_pago('00000000-a000-0000-0000-000000000001')),
  'pub_test_dummy00000000000000000',
  'preparar_checkout_pago devuelve la public_key del tenant'
);

select is(
  (select amount_in_cents from public.preparar_checkout_pago('00000000-a000-0000-0000-000000000001')),
  5000000::bigint,
  'total en pesos (50000) se convierte a centavos (5000000) correctamente'
);

-- Un pedido en 'creado' (sin solicitar_pago aun) no puede prepararse para checkout.
insert into public.orders (id, tenant_id, total, estado) values
  ('00000000-a000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 10000, 'creado');

select throws_ok(
  $$select public.preparar_checkout_pago('00000000-a000-0000-0000-000000000002')$$,
  null,
  'pedido 00000000-a000-0000-0000-000000000002 no existe, no es de tu tenant, o no esta pendiente de pago',
  'no se puede preparar checkout para un pedido que no esta pendiente de pago'
);

select * from finish();
rollback;
