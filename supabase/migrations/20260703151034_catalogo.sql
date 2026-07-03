-- Modulo catalogo (T3.1, Fase 3): productos por tenant + bucket de
-- Storage para sus imagenes. Sin categorias anidadas ni variantes
-- (01-01 §6.2, alcance v1). Roles (03-02 §7): admin gestiona el
-- catalogo, staff solo lo consulta (lo necesita para tomar pedidos
-- mas adelante, Fase 4).

create table public.productos (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  nombre       text not null,
  precio       numeric(12,2) not null default 0,
  stock        integer not null default 0,
  disponible   boolean not null default true,
  imagen_path  text,
  created_at   timestamptz not null default now()
);

create index on public.productos (tenant_id) where disponible;

alter table public.productos enable row level security;

create policy "miembros ven el catalogo de su tenant"
  on public.productos for select
  using (tenant_id = public.current_tenant_id());

create policy "admin agrega productos a su catalogo"
  on public.productos for insert
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin(tenant_id)
  );

create policy "admin edita productos de su catalogo"
  on public.productos for update
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin(tenant_id)
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin(tenant_id)
  );

create policy "admin elimina productos de su catalogo"
  on public.productos for delete
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin(tenant_id)
  );

grant select, insert, update, delete on public.productos to authenticated, service_role;

-- ============================================================
-- STORAGE: bucket de imagenes de producto, path convention
-- "{tenant_id}/{archivo}" (03-02 §5.2). storage.objects ya trae RLS
-- habilitado por defecto en Supabase; solo agregamos las policies.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict (id) do nothing;

create policy "miembros leen imagenes de su tenant"
  on storage.objects for select
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy "admin sube imagenes a su tenant"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.is_tenant_admin(public.current_tenant_id())
  );

create policy "admin actualiza imagenes de su tenant"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.is_tenant_admin(public.current_tenant_id())
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.is_tenant_admin(public.current_tenant_id())
  );

create policy "admin borra imagenes de su tenant"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.is_tenant_admin(public.current_tenant_id())
  );
