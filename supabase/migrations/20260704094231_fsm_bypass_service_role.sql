-- Corrige un hueco arquitectonico real de T4.1, encontrado al conectar
-- el primer webhook real (T5.1): solicitar_pago/confirmar_pago/
-- cancelar_pedido/avanzar_pedido exigen tenant_id = current_tenant_id(),
-- que solo existe cuando hay un JWT de usuario autenticado (03-02 §3).
-- Un webhook de pagos corre como service_role -- sin sesion de
-- usuario, exactamente el caso que CLAUDE.md regla #4 anticipa -- y
-- current_tenant_id() da NULL, asi que esas funciones rechazaban
-- CUALQUIER pedido al llamarlas desde el webhook.
--
-- Redefine las 4 funciones (CREATE OR REPLACE: 20260704021628_pedidos_fsm.sql
-- ya esta en main, es inmutable; esto evoluciona el comportamiento
-- via una migracion nueva, CLAUDE.md regla #6) para aceptar tambien
-- llamadas de service_role, detectado de forma confiable via el claim
-- de rol del JWT -- NO via session_user, que siempre da "authenticator"
-- sin importar el rol efectivo (verificado empiricamente), ni via
-- current_user dentro de una funcion security definer (que muestra el
-- dueno de la funcion, no quien la invoco).
create or replace function public.es_llamada_de_servicio()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;

create or replace function public.solicitar_pago(p_order_id uuid, p_ttl_seconds int default 900)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  v_tenant_id uuid;
  v_updated int;
begin
  select tenant_id into v_tenant_id
  from public.orders
  where id = p_order_id and estado = 'creado'
    and (tenant_id = public.current_tenant_id() or public.es_llamada_de_servicio());

  if v_tenant_id is null then
    raise exception 'pedido % no existe, no es de tu tenant, o no esta en estado creado', p_order_id;
  end if;

  for item in select * from public.order_items where order_id = p_order_id loop
    update public.productos
    set stock = stock - item.cantidad
    where id = item.producto_id and tenant_id = v_tenant_id and stock >= item.cantidad;

    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception 'stock insuficiente para producto %', item.producto_id;
    end if;

    insert into public.stock_reservations (order_id, producto_id, tenant_id, cantidad)
    values (p_order_id, item.producto_id, v_tenant_id, item.cantidad);
  end loop;

  update public.orders
  set estado = 'pendiente_pago', reserva_expira_at = now() + make_interval(secs => p_ttl_seconds)
  where id = p_order_id;

  insert into public.event_log (tenant_id, correlation_id, event_type, payload)
  select v_tenant_id, correlation_id, 'order.pendiente_pago', jsonb_build_object('order_id', p_order_id)
  from public.orders where id = p_order_id;
end;
$$;

create or replace function public.confirmar_pago(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_correlation_id uuid;
begin
  select tenant_id, correlation_id into v_tenant_id, v_correlation_id
  from public.orders
  where id = p_order_id and estado = 'pendiente_pago'
    and (tenant_id = public.current_tenant_id() or public.es_llamada_de_servicio());

  if v_tenant_id is null then
    raise exception 'pedido % no existe, no es de tu tenant, o no esta pendiente de pago', p_order_id;
  end if;

  update public.orders set estado = 'confirmado' where id = p_order_id;

  insert into public.event_log (tenant_id, correlation_id, event_type, payload)
  values (v_tenant_id, v_correlation_id, 'order.confirmado', jsonb_build_object('order_id', p_order_id));
end;
$$;

create or replace function public.cancelar_pedido(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_correlation_id uuid;
begin
  select tenant_id, correlation_id into v_tenant_id, v_correlation_id
  from public.orders
  where id = p_order_id and estado = 'pendiente_pago'
    and (tenant_id = public.current_tenant_id() or public.es_llamada_de_servicio());

  if v_tenant_id is null then
    raise exception 'pedido % no existe, no es de tu tenant, o no esta pendiente de pago', p_order_id;
  end if;

  perform public.liberar_reservas_pedido(p_order_id);
  update public.orders set estado = 'cancelado' where id = p_order_id;

  insert into public.event_log (tenant_id, correlation_id, event_type, payload)
  values (v_tenant_id, v_correlation_id, 'order.cancelado', jsonb_build_object('order_id', p_order_id));
end;
$$;

create or replace function public.avanzar_pedido(p_order_id uuid, p_nuevo_estado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_correlation_id uuid;
begin
  select tenant_id, correlation_id into v_tenant_id, v_correlation_id
  from public.orders
  where id = p_order_id
    and (tenant_id = public.current_tenant_id() or public.es_llamada_de_servicio());

  if v_tenant_id is null then
    raise exception 'pedido % no existe o no es de tu tenant', p_order_id;
  end if;

  update public.orders set estado = p_nuevo_estado where id = p_order_id;

  insert into public.event_log (tenant_id, correlation_id, event_type, payload)
  values (v_tenant_id, v_correlation_id, 'order.' || p_nuevo_estado, jsonb_build_object('order_id', p_order_id));
end;
$$;

-- Las 4 ya tenian grant a authenticated (T4.1); ahora tambien a
-- service_role, para el webhook de pagos y futuros procesos de
-- backend (conciliacion, T5.1 §6).
grant execute on function public.solicitar_pago(uuid, int) to service_role;
grant execute on function public.confirmar_pago(uuid) to service_role;
grant execute on function public.cancelar_pedido(uuid) to service_role;
grant execute on function public.avanzar_pedido(uuid, text) to service_role;
