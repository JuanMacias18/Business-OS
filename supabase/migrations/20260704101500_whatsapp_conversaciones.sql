-- Modulo WhatsApp/Notificaciones (T6.1, Fase 6): numero por tenant
-- (credenciales cifradas via Vault, mismo patron que payment_credentials
-- de T5.1) + estado de conversacion en Postgres + FSM conversacional
-- minima. Sin WABA real todavia (T0.5 en curso) -- este modulo se
-- prueba con adaptador simulado hasta que existan credenciales reales.
-- Especificacion: docs/03-arquitectura/03-08-integracion-whatsapp.md

-- ============================================================
-- whatsapp_numbers: identidad del canal por tenant. phone_number_id
-- es publico (Meta lo manda en cada webhook, es como se resuelve
-- tenant_id -- 03-08 §2.2); el access_token si es secreto, cifrado
-- via Vault igual que 03-07 §4.
-- ============================================================
create table public.whatsapp_numbers (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  phone_number_id         text not null unique,
  access_token_secret_id  uuid not null references vault.secrets(id),
  created_at              timestamptz not null default now(),
  unique (tenant_id)
);

-- Sin policy de select/insert/update/delete para authenticated: el
-- alta del numero es parte del onboarding (05-02, futuro), igual
-- criterio que payment_credentials (03-07 §4).
alter table public.whatsapp_numbers enable row level security;
grant select, insert, update, delete on public.whatsapp_numbers to service_role;

create or replace function public.set_whatsapp_credentials(
  p_tenant_id uuid,
  p_phone_number_id text,
  p_access_token text
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_token_id uuid;
  v_number_id uuid;
begin
  v_token_id := vault.create_secret(p_access_token);

  insert into public.whatsapp_numbers (tenant_id, phone_number_id, access_token_secret_id)
  values (p_tenant_id, p_phone_number_id, v_token_id)
  on conflict (tenant_id) do update set
    phone_number_id = excluded.phone_number_id,
    access_token_secret_id = excluded.access_token_secret_id
  returning id into v_number_id;

  return v_number_id;
end;
$$;

revoke execute on function public.set_whatsapp_credentials(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_whatsapp_credentials(uuid, text, text) to service_role;

-- get_whatsapp_credentials: descifra el token via Vault. Nunca se
-- expone a authenticated/anon -- solo la Edge Function de WhatsApp
-- (service_role) la invoca (03-02 §5.7, mismo patron que
-- get_payment_credentials).
create or replace function public.get_whatsapp_credentials(p_phone_number_id text)
returns table(tenant_id uuid, phone_number_id text, access_token text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    wn.tenant_id,
    wn.phone_number_id,
    (select decrypted_secret from vault.decrypted_secrets where id = wn.access_token_secret_id)
  from public.whatsapp_numbers wn
  where wn.phone_number_id = p_phone_number_id;
end;
$$;

revoke execute on function public.get_whatsapp_credentials(text) from public, anon, authenticated;
grant execute on function public.get_whatsapp_credentials(text) to service_role;

-- ============================================================
-- whatsapp_conversations: estado de conversacion por tenant+telefono
-- del cliente (03-08 §3). cart es el carrito en construccion antes
-- de convertirse en order_items reales -- estado transitorio, no
-- entidad de negocio.
-- ============================================================
create table public.whatsapp_conversations (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  customer_phone  text not null,
  state           text not null default 'saludo'
                  check (state in ('saludo', 'catalogo', 'carrito', 'confirmar', 'esperando_pago', 'cerrada')),
  cart            jsonb not null default '[]'::jsonb,
  order_id        uuid references public.orders(id),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, customer_phone)
);

create index on public.whatsapp_conversations (tenant_id);
create index on public.whatsapp_conversations (order_id) where order_id is not null;

-- Trigger que valida toda transicion (03-08 §3, mismo principio que
-- validar_transicion_pedido de 03-05): la guarda vive en la base, no
-- solo en la funcion de mas abajo.
create or replace function public.validar_transicion_conversacion()
returns trigger
language plpgsql
as $$
begin
  if old.state = new.state then
    new.updated_at = now();
    return new;
  end if;

  if not (
    (old.state = 'saludo' and new.state = 'catalogo') or
    (old.state = 'catalogo' and new.state = 'carrito') or
    (old.state = 'carrito' and new.state = 'confirmar') or
    (old.state = 'confirmar' and new.state = 'esperando_pago') or
    (old.state = 'esperando_pago' and new.state = 'cerrada')
  ) then
    raise exception 'transicion de conversacion invalida de % a %', old.state, new.state;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create trigger before_conversation_state_update
  before update on public.whatsapp_conversations
  for each row execute function public.validar_transicion_conversacion();

-- RLS: solo lectura para miembros del tenant (visibilidad operativa
-- en el panel); el insert/update real lo hace el handler del webhook
-- con service_role, nunca el cliente -- mismo criterio que orders
-- (03-03 §5.3): sin policy de insert/update/delete para authenticated.
alter table public.whatsapp_conversations enable row level security;

create policy "miembros leen conversaciones de su tenant"
  on public.whatsapp_conversations for select
  using (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.whatsapp_conversations to authenticated, service_role;

-- ============================================================
-- avanzar_conversacion_por_mensaje: el dispatcher de la FSM
-- conversacional (03-08 §5/§6). Recibe un mensaje entrante ya
-- interpretado (texto + opcionalmente producto_id/cantidad si el
-- cliente selecciono un item) y decide la transicion. Solo avanza
-- por las rutas validas de la FSM -- cualquier entrada que no
-- corresponda a la transicion esperada del estado actual es un
-- no-op con un mensaje de ayuda, nunca una excepcion (a diferencia
-- de la FSM de pedidos: aqui el "emisor" es un cliente humano
-- escribiendo texto libre, no puede fallar duro por un mensaje raro).
-- WHY security definer + es_llamada_de_servicio(): corre desde el
-- procesamiento del webhook (service_role, sin sesion de usuario),
-- mismo patron que solicitar_pago (03-02 §5.8).
-- ============================================================
create or replace function public.avanzar_conversacion_por_mensaje(
  p_tenant_id uuid,
  p_customer_phone text,
  p_mensaje text,
  p_producto_id uuid default null,
  p_cantidad int default null
)
returns table(state text, respuesta text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv record;
  v_texto text := lower(trim(coalesce(p_mensaje, '')));
  v_nuevo_carrito jsonb;
  v_order_id uuid;
  v_correlation_id uuid;
  v_total numeric;
  item jsonb;
  v_producto record;
begin
  if not (p_tenant_id = public.current_tenant_id() or public.es_llamada_de_servicio()) then
    raise exception 'sin autorizacion para operar esta conversacion';
  end if;

  insert into public.whatsapp_conversations (tenant_id, customer_phone)
  values (p_tenant_id, p_customer_phone)
  on conflict (tenant_id, customer_phone) do nothing;

  select * into v_conv
  from public.whatsapp_conversations
  where tenant_id = p_tenant_id and customer_phone = p_customer_phone;

  if v_conv.state = 'saludo' then
    update public.whatsapp_conversations set state = 'catalogo'
    where id = v_conv.id;
    return query select 'catalogo'::text, 'hola! este es nuestro catalogo, responde con el producto y la cantidad que quieras'::text;

  elsif v_conv.state = 'catalogo' and p_producto_id is not null and p_cantidad is not null then
    select id, nombre, precio into v_producto
    from public.productos
    where id = p_producto_id and tenant_id = p_tenant_id and disponible;

    if v_producto.id is null then
      return query select 'catalogo'::text, 'ese producto no esta disponible, elige otro del catalogo'::text;
      return;
    end if;

    v_nuevo_carrito := jsonb_build_array(jsonb_build_object('producto_id', p_producto_id, 'cantidad', p_cantidad));
    update public.whatsapp_conversations set state = 'carrito', cart = v_nuevo_carrito
    where id = v_conv.id;
    return query select 'carrito'::text, format('agregado %s x%s. escribe otro producto o "confirmar"', v_producto.nombre, p_cantidad)::text;

  elsif v_conv.state = 'carrito' and p_producto_id is not null and p_cantidad is not null then
    select id, nombre, precio into v_producto
    from public.productos
    where id = p_producto_id and tenant_id = p_tenant_id and disponible;

    if v_producto.id is null then
      return query select 'carrito'::text, 'ese producto no esta disponible, elige otro del catalogo'::text;
      return;
    end if;

    v_nuevo_carrito := v_conv.cart || jsonb_build_array(jsonb_build_object('producto_id', p_producto_id, 'cantidad', p_cantidad));
    update public.whatsapp_conversations set cart = v_nuevo_carrito
    where id = v_conv.id;
    return query select 'carrito'::text, format('agregado %s x%s. escribe otro producto o "confirmar"', v_producto.nombre, p_cantidad)::text;

  elsif v_conv.state = 'carrito' and v_texto = 'confirmar' and jsonb_array_length(v_conv.cart) > 0 then
    update public.whatsapp_conversations set state = 'confirmar'
    where id = v_conv.id;
    return query select 'confirmar'::text, 'confirma tu pedido escribiendo "si"'::text;

  elsif v_conv.state = 'confirmar' and v_texto = 'si' then
    v_correlation_id := gen_random_uuid();
    insert into public.orders (tenant_id, estado, correlation_id)
    values (p_tenant_id, 'creado', v_correlation_id)
    returning id into v_order_id;

    v_total := 0;
    for item in select * from jsonb_array_elements(v_conv.cart) loop
      select id, precio into v_producto
      from public.productos
      where id = (item ->> 'producto_id')::uuid and tenant_id = p_tenant_id;

      insert into public.order_items (order_id, tenant_id, producto_id, cantidad, precio_unitario)
      values (v_order_id, p_tenant_id, (item ->> 'producto_id')::uuid, (item ->> 'cantidad')::int, v_producto.precio);

      v_total := v_total + v_producto.precio * (item ->> 'cantidad')::int;
    end loop;

    update public.orders set total = v_total where id = v_order_id;

    perform public.solicitar_pago(v_order_id);

    update public.whatsapp_conversations
    set state = 'esperando_pago', order_id = v_order_id
    where id = v_conv.id;

    return query select 'esperando_pago'::text, 'pedido creado, te comparto el link de pago'::text;

  else
    return query select v_conv.state, 'no entendi ese mensaje, sigamos con el paso actual'::text;
  end if;
end;
$$;

revoke execute on function public.avanzar_conversacion_por_mensaje(uuid, text, text, uuid, int) from public, anon, authenticated;
grant execute on function public.avanzar_conversacion_por_mensaje(uuid, text, text, uuid, int) to authenticated, service_role;

-- ============================================================
-- cerrar_conversacion_por_pedido: reaccion a event_log (03-08 §5,
-- "notificaciones de estado"). La llama el job de notificacion
-- cuando el pedido enlazado a una conversacion confirma/cancela/
-- expira -- no es un import de pedidos, es una lectura de su
-- event_log ya existente (03-03 §2.4). Cross-tenant por diseno
-- (igual que expirar_reservas_vencidas, 03-02 §5.7): no hay "tenant
-- actual" en contexto de job de servicio.
-- ============================================================
create or replace function public.cerrar_conversacion_por_pedido(p_order_id uuid, p_evento text)
returns table(customer_phone text, respuesta text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv record;
  v_msg text;
begin
  select * into v_conv
  from public.whatsapp_conversations
  where order_id = p_order_id and state = 'esperando_pago';

  if v_conv.id is null then
    return;
  end if;

  v_msg := case p_evento
    when 'order.confirmado' then 'tu pago fue confirmado, ya estamos preparando tu pedido!'
    when 'order.cancelado' then 'tu pedido fue cancelado.'
    when 'order.expirado' then 'el tiempo para pagar tu pedido vencio, el pedido fue cancelado.'
    else 'tu pedido cambio de estado.'
  end;

  update public.whatsapp_conversations set state = 'cerrada' where id = v_conv.id;

  return query select v_conv.customer_phone, v_msg;
end;
$$;

revoke execute on function public.cerrar_conversacion_por_pedido(uuid, text) from public, anon, authenticated;
grant execute on function public.cerrar_conversacion_por_pedido(uuid, text) to service_role;
