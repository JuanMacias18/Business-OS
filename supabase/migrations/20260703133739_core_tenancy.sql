-- Nucleo de tenancy: tenants, memberships, profiles, event_log.
-- Especificacion: docs/03-arquitectura/03-02-tenancy-y-aislamiento.md
--                 docs/03-arquitectura/03-03-modelo-de-datos-y-erd.md

-- ============================================================
-- current_tenant_id(): lee el claim tenant_id inyectado en el JWT
-- por el Custom Access Token Hook (03-02 §3.3). stable: Postgres la
-- evalua una sola vez por consulta, no por fila (rendimiento, §4).
-- ============================================================
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
$$;

-- ============================================================
-- TENANTS
-- ============================================================
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.tenants enable row level security;

create policy "miembros leen su tenant"
  on public.tenants for select
  using (id = public.current_tenant_id());

-- ============================================================
-- MEMBERSHIPS (creada antes que profiles: la policy de profiles
-- de "companeros de tenant" depende de esta tabla)
-- ============================================================
create table public.memberships (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'staff' check (role in ('admin', 'staff')),
  created_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index on public.memberships (tenant_id);

alter table public.memberships enable row level security;

create policy "usuario ve sus membresias"
  on public.memberships for select
  using (user_id = (select auth.uid()));

-- security definer: una policy de memberships no puede consultar
-- memberships directamente (Postgres lo rechaza con "infinite
-- recursion detected in policy"). El helper rompe esa cadena.
create or replace function public.is_tenant_admin(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = target_tenant_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  )
$$;

create policy "admin invita miembros de su tenant"
  on public.memberships for insert
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_admin(tenant_id)
  );

-- ============================================================
-- PROFILES (espejo minimo de auth.users en el schema public)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "cada quien lee y edita su perfil"
  on public.profiles for all
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- security definer: si esta subconsulta corriera con los privilegios
-- del usuario que llama, la RLS de memberships le ocultaria la fila
-- del companero (solo "ve sus propias membresias") y el EXISTS
-- siempre daria falso. El helper consulta memberships sin esa
-- restriccion, precisamente para resolver "compartimos tenant".
create or replace function public.shares_tenant_with(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships mine
    join public.memberships theirs on theirs.tenant_id = mine.tenant_id
    where mine.user_id = auth.uid()
      and theirs.user_id = other_user_id
  )
$$;

create policy "leer perfiles de companeros de tenant"
  on public.profiles for select
  using (public.shares_tenant_with(id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- EVENT_LOG
-- ============================================================
create table public.event_log (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  correlation_id  uuid not null,
  event_type      text not null,
  payload         jsonb not null default '{}'::jsonb,
  actor_user_id   uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index on public.event_log (tenant_id, created_at desc);
create index on public.event_log (tenant_id, correlation_id);

alter table public.event_log enable row level security;

create policy "miembros leen el event_log de su tenant"
  on public.event_log for select
  using (tenant_id = public.current_tenant_id());

-- ============================================================
-- GRANTS: RLS restringe filas, pero Postgres exige ademas el
-- privilegio de tabla de base para el rol authenticated (defensa
-- en profundidad); las policies de arriba son el filtro real.
-- ============================================================
grant select, insert, update, delete on public.tenants     to authenticated;
grant select, insert, update, delete on public.memberships  to authenticated;
grant select, insert, update, delete on public.profiles     to authenticated;
grant select, insert, update, delete on public.event_log    to authenticated;
