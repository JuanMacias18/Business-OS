-- ============================================================
-- Seed de desarrollo: un tenant demo con catálogo básico.
-- Reemplaza el phone_number_id por el de tu número de prueba de Meta.
-- ============================================================

insert into public.tenants (id, nombre, whatsapp_phone_number_id)
values ('00000000-0000-0000-0000-000000000001', 'Burger Demo', 'REEMPLAZA_PHONE_NUMBER_ID')
on conflict (id) do nothing;

insert into public.productos (tenant_id, nombre, precio, aliases) values
  ('00000000-0000-0000-0000-000000000001', 'hamburguesa', 18000, array['hamburguesas','burger','burguer']),
  ('00000000-0000-0000-0000-000000000001', 'pizza',       25000, array['pizzas']),
  ('00000000-0000-0000-0000-000000000001', 'gaseosa',      5000, array['coca cola','coca-cola','coca','gaseosas','soda'])
on conflict do nothing;
