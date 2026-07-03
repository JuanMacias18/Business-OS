-- Aislamiento de Storage para imagenes de producto (03-02 §5.2):
-- subir como tenant A, intentar leer/subir como tenant B => denegado.
begin;
select plan(4);

insert into public.tenants (id, nombre) values
  ('11111111-1111-1111-1111-111111111111', 'Tenant A'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B');

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'admin-a@example.com'),
  ('b0000000-0000-0000-0000-000000000001', 'admin-b@example.com');

insert into public.memberships (tenant_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-000000000001', 'admin');

-- Admin de A sube una imagen bajo su propio prefijo.
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

insert into storage.objects (bucket_id, name, owner)
values ('product-images', '11111111-1111-1111-1111-111111111111/foto.jpg', 'a0000000-0000-0000-0000-000000000001');

select is(
  (select count(*)::int from storage.objects where bucket_id = 'product-images'),
  1,
  'admin de A sube su propia imagen sin problema'
);

-- Admin de A NO puede subir una imagen bajo el prefijo de B.
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('product-images', '22222222-2222-2222-2222-222222222222/intruso.jpg', 'a0000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'admin de A no puede subir una imagen bajo el prefijo del tenant B'
);

-- Admin de B sube su propia imagen (para probar lectura cruzada).
set local request.jwt.claims to '{"sub": "b0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "22222222-2222-2222-2222-222222222222"}}';

insert into storage.objects (bucket_id, name, owner)
values ('product-images', '22222222-2222-2222-2222-222222222222/foto-b.jpg', 'b0000000-0000-0000-0000-000000000001');

-- Admin de A no puede LEER la imagen de B.
set local request.jwt.claims to '{"sub": "a0000000-0000-0000-0000-000000000001", "app_metadata": {"tenant_id": "11111111-1111-1111-1111-111111111111"}}';

select is(
  (select count(*)::int from storage.objects where bucket_id = 'product-images'),
  1,
  'admin de A solo ve su propia imagen, no la de B'
);

reset role;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'product-images'),
  2,
  'ambas imagenes existen realmente (verificado sin RLS, service context)'
);

select * from finish();
rollback;
