-- Cola de procesamiento asincrono para el patron webhook-rapido
-- (CLAUDE.md regla #5; T2.2). El handler del webhook encola aqui y
-- responde 200 de inmediato; el trabajo pesado lo hace un paso
-- separado (process_pending_jobs), nunca el handler mismo.

create table public.jobs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  idempotency_key text not null,
  job_type        text not null,
  payload         jsonb not null default '{}'::jsonb,
  status          text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  created_at      timestamptz not null default now(),
  processed_at    timestamptz,
  unique (tenant_id, idempotency_key)
);

create index on public.jobs (tenant_id, status);

alter table public.jobs enable row level security;

-- Solo lectura para miembros del tenant (p. ej. ver "pago procesando"
-- en el panel). El insert real lo hace el handler del webhook con
-- service_role -- no hay policy de insert/update/delete para
-- authenticated, deny-by-default cubre esos casos.
create policy "miembros leen los jobs de su tenant"
  on public.jobs for select
  using (tenant_id = public.current_tenant_id());

-- service_role bypassa RLS pero no el GRANT de tabla base -- lo
-- necesita el handler del webhook (03-02 patron de §4, ampliado).
grant select, insert, update, delete on public.jobs to authenticated, service_role;

-- "funcion de proceso" del GOAL de T2.2: procesa lo pendiente.
-- Nota de alcance: en el walking skeleton se invoca manualmente
-- (tests / llamadas directas). Un disparador automatico (pg_cron u
-- otro) es una decision operativa que se toma cuando exista un
-- job_type real que procesar (Fase 4 en adelante), no aqui.
create or replace function public.process_pending_jobs()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  processed_count int;
begin
  update public.jobs
  set status = 'done', processed_at = now()
  where status = 'pending';
  get diagnostics processed_count = row_count;
  return processed_count;
end;
$$;

-- Postgres concede EXECUTE a PUBLIC por defecto en toda funcion
-- nueva -- sin revocar esto, cualquier authenticated/anon podria
-- disparar el procesamiento de TODOS los jobs de TODOS los tenants.
-- Hallazgo de T4.1 (mismo patron aplicado a expirar_reservas_vencidas).
revoke execute on function public.process_pending_jobs() from public, anon, authenticated;
