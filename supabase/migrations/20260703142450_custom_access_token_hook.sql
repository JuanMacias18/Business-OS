-- Custom Access Token Hook (03-02 §3.2/§3.3, T2.3): inyecta el
-- tenant_id de la (primera) membership del usuario en app_metadata
-- del JWT, para que current_tenant_id() pueda leerlo sin JOIN.
-- v1: un usuario opera un tenant (01-01 no-objetivo de simplicidad);
-- si tuviera varias memberships, se toma la mas antigua de forma
-- deterministica -- "cambiar de tenant" (multi-membership real) es
-- un caso futuro (03-02 §3.2, punto 4), no v1.
--
-- security definer (03-02 §5.6): a este hook lo invoca
-- supabase_auth_admin, que ni tiene GRANT sobre memberships ni un
-- JWT de usuario en contexto (auth.uid() seria null y la RLS de
-- memberships denegaria todo). Hallazgo real de T2.3, mismo patron
-- que is_tenant_admin/shares_tenant_with.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  selected_tenant_id uuid;
begin
  select m.tenant_id into selected_tenant_id
  from public.memberships m
  where m.user_id = (event ->> 'user_id')::uuid
  order by m.created_at asc
  limit 1;

  claims := coalesce(event -> 'claims', '{}'::jsonb);

  if selected_tenant_id is not null then
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      coalesce(claims -> 'app_metadata', '{}'::jsonb) || jsonb_build_object('tenant_id', selected_tenant_id::text)
    );
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Solo el rol que ejecuta GoTrue puede invocar el hook -- nunca desde
-- el cliente (mismo espiritu que FF-3: nada de bypass expuesto).
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
