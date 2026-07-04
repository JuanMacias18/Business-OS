-- Capa de pagos (T5.1, Fase 5): credenciales por tenant cifradas via
-- Vault, columna de referencia del proveedor en orders, y las dos
-- funciones que la Edge Function de pagos necesita.
-- Especificacion: docs/03-arquitectura/03-07-capa-de-pagos-multipasarela.md

create table public.payment_credentials (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  provider              text not null default 'wompi' check (provider in ('wompi')),
  public_key            text not null,
  private_key_secret_id uuid not null references vault.secrets(id),
  events_secret_id      uuid not null references vault.secrets(id),
  integrity_secret_id   uuid not null references vault.secrets(id),
  created_at            timestamptz not null default now(),
  unique (tenant_id, provider)
);

-- Sin policy de select/insert/update/delete para authenticated: el
-- alta de credenciales es un flujo de onboarding (05-02, futuro), no
-- algo que el cliente toque. Deny-by-default cubre el resto.
alter table public.payment_credentials enable row level security;
grant select, insert, update, delete on public.payment_credentials to service_role;

-- ============================================================
-- set_payment_credentials: primitiva de alta de credenciales (la
-- usara el onboarding real de 05-02; hoy la usa el walking skeleton
-- para dar de alta las credenciales de Wompi del tenant de demo).
-- Cifra las 3 secretas via Vault antes de guardar solo sus uuid.
-- ============================================================
create or replace function public.set_payment_credentials(
  p_tenant_id uuid,
  p_public_key text,
  p_private_key text,
  p_events_secret text,
  p_integrity_secret text,
  p_provider text default 'wompi'
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_priv_id uuid;
  v_events_id uuid;
  v_integrity_id uuid;
  v_cred_id uuid;
begin
  v_priv_id := vault.create_secret(p_private_key);
  v_events_id := vault.create_secret(p_events_secret);
  v_integrity_id := vault.create_secret(p_integrity_secret);

  insert into public.payment_credentials (tenant_id, provider, public_key, private_key_secret_id, events_secret_id, integrity_secret_id)
  values (p_tenant_id, p_provider, p_public_key, v_priv_id, v_events_id, v_integrity_id)
  on conflict (tenant_id, provider) do update set
    public_key = excluded.public_key,
    private_key_secret_id = excluded.private_key_secret_id,
    events_secret_id = excluded.events_secret_id,
    integrity_secret_id = excluded.integrity_secret_id
  returning id into v_cred_id;

  return v_cred_id;
end;
$$;

revoke execute on function public.set_payment_credentials(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.set_payment_credentials(uuid, text, text, text, text, text) to service_role;

-- ============================================================
-- orders: columna para la referencia real de Wompi, poblada por el
-- webhook (registrar_referencia_pago) -- la usa la conciliacion (§6).
-- ============================================================
alter table public.orders add column provider_transaction_id text;

-- ============================================================
-- get_payment_credentials: descifra las 3 secretas via Vault.
-- Nunca se expone a authenticated/anon -- solo la Edge Function de
-- pagos (service_role) la invoca (03-02 §5.7).
-- ============================================================
create or replace function public.get_payment_credentials(p_tenant_id uuid, p_provider text default 'wompi')
returns table(public_key text, private_key text, events_secret text, integrity_secret text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    pc.public_key,
    (select decrypted_secret from vault.decrypted_secrets where id = pc.private_key_secret_id),
    (select decrypted_secret from vault.decrypted_secrets where id = pc.events_secret_id),
    (select decrypted_secret from vault.decrypted_secrets where id = pc.integrity_secret_id)
  from public.payment_credentials pc
  where pc.tenant_id = p_tenant_id and pc.provider = p_provider;
end;
$$;

revoke execute on function public.get_payment_credentials(uuid, text) from public, anon, authenticated;
-- service_role NO es superusuario (verificado: rolsuper=false) y
-- revocar de PUBLIC tambien le quita el EXECUTE implicito -- sin este
-- grant explicito, la Edge Function del webhook (que corre como
-- service_role) no podria llamar esta funcion.
grant execute on function public.get_payment_credentials(uuid, text) to service_role;

-- ============================================================
-- preparar_checkout_pago: calcula la firma de integridad DENTRO de
-- Postgres -- el secreto de integridad nunca sale de la base, ni
-- siquiera hacia el proceso de la Edge Function (03-07 §4).
-- WHY security definer + filtro explicito: igual que
-- solicitar_pago() (03-02 §5.6), staff necesita esto aunque no
-- administre credenciales de pago directamente.
-- ============================================================
create or replace function public.preparar_checkout_pago(p_order_id uuid)
returns table(
  public_key text,
  reference text,
  amount_in_cents bigint,
  currency text,
  signature text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_total numeric;
  v_public_key text;
  v_integrity_secret text;
  v_amount_in_cents bigint;
begin
  select tenant_id, total into v_tenant_id, v_total
  from public.orders
  where id = p_order_id and estado = 'pendiente_pago' and tenant_id = public.current_tenant_id();

  if v_tenant_id is null then
    raise exception 'pedido % no existe, no es de tu tenant, o no esta pendiente de pago', p_order_id;
  end if;

  select cred.public_key, cred.integrity_secret
  into v_public_key, v_integrity_secret
  from public.get_payment_credentials(v_tenant_id) cred;

  if v_public_key is null then
    raise exception 'tenant % no tiene credenciales de pago configuradas', v_tenant_id;
  end if;

  v_amount_in_cents := round(v_total * 100);

  return query select
    v_public_key,
    p_order_id::text,
    v_amount_in_cents,
    'COP'::text,
    encode(extensions.digest(p_order_id::text || v_amount_in_cents::text || 'COP' || v_integrity_secret, 'sha256'), 'hex');
end;
$$;

grant execute on function public.preparar_checkout_pago(uuid) to authenticated;

-- ============================================================
-- registrar_referencia_pago: la Edge Function del webhook la llama
-- (service_role) para guardar el transaction_id real de Wompi en
-- cuanto llega el primer evento -- la conciliacion (§6) lo usa para
-- volver a preguntar. Sin filtro de tenant: no hay "tenant actual" en
-- contexto de webhook, igual que expirar_reservas_vencidas (03-02 §5.7).
-- ============================================================
create or replace function public.registrar_referencia_pago(p_reference text, p_provider_transaction_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
  set provider_transaction_id = p_provider_transaction_id
  where id = p_reference::uuid;
end;
$$;

revoke execute on function public.registrar_referencia_pago(text, text) from public, anon, authenticated;
grant execute on function public.registrar_referencia_pago(text, text) to service_role;
