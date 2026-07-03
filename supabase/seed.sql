-- Seed de desarrollo local y fixtures deterministicas para el e2e de
-- aislamiento (T2.3): dos tenants, un usuario admin por cada uno.
-- El seed de catalogo demo llega en Fase 3.
create extension if not exists pgcrypto;

insert into public.tenants (id, nombre) values
  ('e2e00000-0000-0000-0000-00000000000a', 'Restaurante A (e2e)'),
  ('e2e00000-0000-0000-0000-00000000000b', 'Restaurante B (e2e)');

-- confirmation_token y los demas campos de token deben ser '' (no
-- NULL): el scanner de GoTrue espera string vacio, no NULL, y falla
-- el login con "converting NULL to string is unsupported" si se
-- omiten (hallazgo real de T2.3).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token,
  email_change_token_new, email_change_token_current, email_change,
  phone_change, phone_change_token
) values
  ('00000000-0000-0000-0000-000000000000', 'e2e00001-0000-0000-0000-00000000000a', 'authenticated', 'authenticated',
   'usuario-a@e2e.test', crypt('Test1234!', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}',
   '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e2e00001-0000-0000-0000-00000000000b', 'authenticated', 'authenticated',
   'usuario-b@e2e.test', crypt('Test1234!', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}',
   '', '', '', '', '', '', '');

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  (gen_random_uuid(), 'e2e00001-0000-0000-0000-00000000000a', 'e2e00001-0000-0000-0000-00000000000a',
   '{"sub":"e2e00001-0000-0000-0000-00000000000a","email":"usuario-a@e2e.test","email_verified":true}', 'email', now(), now(), now()),
  (gen_random_uuid(), 'e2e00001-0000-0000-0000-00000000000b', 'e2e00001-0000-0000-0000-00000000000b',
   '{"sub":"e2e00001-0000-0000-0000-00000000000b","email":"usuario-b@e2e.test","email_verified":true}', 'email', now(), now(), now());

insert into public.memberships (tenant_id, user_id, role) values
  ('e2e00000-0000-0000-0000-00000000000a', 'e2e00001-0000-0000-0000-00000000000a', 'admin'),
  ('e2e00000-0000-0000-0000-00000000000b', 'e2e00001-0000-0000-0000-00000000000b', 'admin');
