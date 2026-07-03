-- ============================================================
-- MiSaaSTech — Esquema inicial (Fase 1)
-- Tenants, clientes, productos (catálogo) y pedidos.
-- Diseñado multi-tenant: cada negocio de comida es un tenant.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- TENANTS: cada negocio de comida que usa el SaaS.
-- whatsapp_phone_number_id mapea el número de Meta -> tenant.
-- ------------------------------------------------------------
create table if not exists public.tenants (
  id                          uuid primary key default gen_random_uuid(),
  nombre                      text not null,
  whatsapp_phone_number_id    text unique,
  activo                      boolean not null default true,
  created_at                  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TENANT_USERS: qué usuarios de auth pueden administrar qué tenant.
-- Base para el RLS del dashboard (Fase 5).
-- ------------------------------------------------------------
create table if not exists public.tenant_users (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rol         text not null default 'admin' check (rol in ('admin', 'staff')),
  created_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- ------------------------------------------------------------
-- CLIENTES: consumidores finales que escriben por WhatsApp.
-- Únicos por (tenant, whatsapp_id).
-- ------------------------------------------------------------
create table if not exists public.clientes (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  whatsapp_id  text not null,
  nombre       text,
  telefono     text,
  created_at   timestamptz not null default now(),
  unique (tenant_id, whatsapp_id)
);

-- ------------------------------------------------------------
-- PRODUCTOS: catálogo por tenant. Lo usa el parser para
-- reconocer ítems y calcular el total. `aliases` permite que
-- "coca cola", "coca-cola" -> producto "gaseosa".
-- ------------------------------------------------------------
create table if not exists public.productos (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  nombre      text not null,
  precio      numeric(12,2) not null default 0,
  aliases     text[] not null default '{}',
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- PEDIDOS: una orden recibida. detalles_json guarda los ítems
-- con sus cantidades y extras (modificadores).
-- ------------------------------------------------------------
create table if not exists public.pedidos (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  cliente_id     uuid not null references public.clientes(id) on delete cascade,
  fecha          timestamptz not null default now(),
  total          numeric(12,2) not null default 0,
  estado         text not null default 'recibido'
                 check (estado in ('recibido','confirmado','en_preparacion',
                                   'enviado','entregado','cancelado')),
  detalles_json  jsonb not null default '[]'::jsonb,
  mensaje_origen text,
  created_at     timestamptz not null default now()
);

-- Índices para consultas frecuentes del dashboard.
create index if not exists idx_pedidos_tenant_fecha  on public.pedidos (tenant_id, fecha desc);
create index if not exists idx_pedidos_estado        on public.pedidos (tenant_id, estado);
create index if not exists idx_clientes_tenant       on public.clientes (tenant_id);
create index if not exists idx_productos_tenant      on public.productos (tenant_id) where activo;

-- ============================================================
-- ROW LEVEL SECURITY
-- El webhook usa la service_role key, que IGNORA el RLS.
-- Estas políticas protegen el acceso desde el dashboard
-- (usuarios autenticados), limitándolos a SUS tenants.
-- ============================================================

create or replace function public.is_tenant_member(tid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_users tu
    where tu.tenant_id = tid and tu.user_id = auth.uid()
  );
$$;

alter table public.tenants      enable row level security;
alter table public.tenant_users enable row level security;
alter table public.clientes     enable row level security;
alter table public.productos    enable row level security;
alter table public.pedidos      enable row level security;

create policy "miembros leen su tenant"
  on public.tenants for select
  using (public.is_tenant_member(id));

create policy "usuario ve sus membresías"
  on public.tenant_users for select
  using (user_id = auth.uid());

create policy "miembros gestionan clientes de su tenant"
  on public.clientes for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "miembros gestionan productos de su tenant"
  on public.productos for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy "miembros gestionan pedidos de su tenant"
  on public.pedidos for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));
