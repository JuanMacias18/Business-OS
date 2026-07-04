-- Modulo Pedidos (T4.1, Fase 4): orders, order_items, stock_reservations
-- + FSM guardada por trigger + funciones de transicion.
-- Especificacion: docs/03-arquitectura/03-05-maquina-de-estados-del-pedido.md

create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  estado            text not null default 'creado'
                    check (estado in ('creado', 'pendiente_pago', 'confirmado', 'preparando', 'entregado', 'cancelado', 'expirado')),
  total             numeric(12,2) not null default 0,
  reserva_expira_at timestamptz,
  correlation_id    uuid not null default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on public.orders (tenant_id, estado);
create index on public.orders (tenant_id, reserva_expira_at) where estado = 'pendiente_pago';

create table public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  producto_id     uuid not null references public.productos(id),
  cantidad        integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null,
  created_at      timestamptz not null default now()
);

create index on public.order_items (tenant_id, order_id);

create table public.stock_reservations (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  cantidad    integer not null check (cantidad > 0),
  liberada    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index on public.stock_reservations (tenant_id, order_id);

-- ============================================================
-- FSM: trigger que valida toda transicion de estado (03-05 §3).
-- Corre para CUALQUIER UPDATE de orders, incluso si algun dia se
-- permitiera un UPDATE directo -- la guarda vive en la base, no
-- solo en las funciones de abajo.
-- ============================================================
create or replace function public.validar_transicion_pedido()
returns trigger
language plpgsql
as $$
begin
  if old.estado = new.estado then
    new.updated_at = now();
    return new;
  end if;

  if not (
    (old.estado = 'creado' and new.estado = 'pendiente_pago') or
    (old.estado = 'pendiente_pago' and new.estado in ('confirmado', 'expirado', 'cancelado')) or
    (old.estado = 'confirmado' and new.estado = 'preparando') or
    (old.estado = 'preparando' and new.estado = 'entregado')
  ) then
    raise exception 'transicion invalida de % a %', old.estado, new.estado;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create trigger before_order_estado_update
  before update on public.orders
  for each row execute function public.validar_transicion_pedido();

-- ============================================================
-- Liberar reservas (compartida por cancelar_pedido y expirar_reservas_vencidas)
-- ============================================================
create or replace function public.liberar_reservas_pedido(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  res record;
begin
  for res in select * from public.stock_reservations where order_id = p_order_id and liberada = false loop
    update public.productos set stock = stock + res.cantidad where id = res.producto_id;
    update public.stock_reservations set liberada = true where id = res.id;
  end loop;
end;
$$;

-- ============================================================
-- solicitar_pago: creado -> pendiente_pago. Reserva stock de forma
-- atomica (decremento con guarda WHERE stock >= cantidad, 03-05 §4).
-- WHY security definer: staff puede reservar stock aunque solo admin
-- pueda editar productos directamente (03-02 §7) -- por eso filtra
-- tenant_id explicito contra current_tenant_id() en vez de confiar
-- en RLS, que aqui esta bypassada.
-- ============================================================
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
  where id = p_order_id and estado = 'creado' and tenant_id = public.current_tenant_id();

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

-- ============================================================
-- confirmar_pago: pendiente_pago -> confirmado. NO vuelve a tocar
-- stock -- la reserva ya fue el descuento real (03-05 §4).
-- ============================================================
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
  where id = p_order_id and estado = 'pendiente_pago' and tenant_id = public.current_tenant_id();

  if v_tenant_id is null then
    raise exception 'pedido % no existe, no es de tu tenant, o no esta pendiente de pago', p_order_id;
  end if;

  update public.orders set estado = 'confirmado' where id = p_order_id;

  insert into public.event_log (tenant_id, correlation_id, event_type, payload)
  values (v_tenant_id, v_correlation_id, 'order.confirmado', jsonb_build_object('order_id', p_order_id));
end;
$$;

-- ============================================================
-- cancelar_pedido: pendiente_pago -> cancelado. Libera la reserva.
-- ============================================================
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
  where id = p_order_id and estado = 'pendiente_pago' and tenant_id = public.current_tenant_id();

  if v_tenant_id is null then
    raise exception 'pedido % no existe, no es de tu tenant, o no esta pendiente de pago', p_order_id;
  end if;

  perform public.liberar_reservas_pedido(p_order_id);
  update public.orders set estado = 'cancelado' where id = p_order_id;

  insert into public.event_log (tenant_id, correlation_id, event_type, payload)
  values (v_tenant_id, v_correlation_id, 'order.cancelado', jsonb_build_object('order_id', p_order_id));
end;
$$;

-- ============================================================
-- avanzar_pedido: confirmado -> preparando -> entregado. El trigger
-- de arriba rechaza cualquier otro salto.
-- ============================================================
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
  where id = p_order_id and tenant_id = public.current_tenant_id();

  if v_tenant_id is null then
    raise exception 'pedido % no existe o no es de tu tenant', p_order_id;
  end if;

  update public.orders set estado = p_nuevo_estado where id = p_order_id;

  insert into public.event_log (tenant_id, correlation_id, event_type, payload)
  values (v_tenant_id, v_correlation_id, 'order.' || p_nuevo_estado, jsonb_build_object('order_id', p_order_id));
end;
$$;

-- ============================================================
-- expirar_reservas_vencidas: barrido operacional cross-tenant (no
-- filtra por current_tenant_id() -- no hay "tenant actual" en un
-- contexto de scheduler/servicio; analogo a process_pending_jobs de
-- T2.2). No se expone a authenticated/anon: solo se invoca desde
-- service_role o directamente en tests (03-05 §5, nota de alcance).
-- ============================================================
create or replace function public.expirar_reservas_vencidas()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ord record;
  v_count int := 0;
begin
  for ord in
    select id, tenant_id, correlation_id from public.orders
    where estado = 'pendiente_pago' and reserva_expira_at < now()
  loop
    perform public.liberar_reservas_pedido(ord.id);
    update public.orders set estado = 'expirado' where id = ord.id;
    insert into public.event_log (tenant_id, correlation_id, event_type, payload)
    values (ord.tenant_id, ord.correlation_id, 'order.expirado', jsonb_build_object('order_id', ord.id));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.expirar_reservas_vencidas() from public, anon, authenticated;

-- ============================================================
-- RLS: cualquier miembro del tenant crea y opera pedidos (03-02 §7,
-- 03-05 §6 -- a diferencia del catalogo, aqui no hay restriccion de
-- rol). Nunca hay policy de UPDATE para authenticated: todo cambio
-- de estado pasa por las funciones de arriba, nunca por un UPDATE
-- directo del cliente.
-- ============================================================
alter table public.orders enable row level security;

create policy "miembros ven los pedidos de su tenant"
  on public.orders for select
  using (tenant_id = public.current_tenant_id());

create policy "miembros crean pedidos en su tenant"
  on public.orders for insert
  with check (tenant_id = public.current_tenant_id() and estado = 'creado');

grant select, insert, update, delete on public.orders to authenticated, service_role;

alter table public.order_items enable row level security;

create policy "miembros ven los items de pedidos de su tenant"
  on public.order_items for select
  using (tenant_id = public.current_tenant_id());

create policy "miembros agregan items a pedidos de su tenant en creacion"
  on public.order_items for insert
  with check (
    tenant_id = public.current_tenant_id()
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.tenant_id = public.current_tenant_id() and o.estado = 'creado'
    )
    and exists (
      select 1 from public.productos p
      where p.id = producto_id and p.tenant_id = public.current_tenant_id()
    )
  );

grant select, insert, update, delete on public.order_items to authenticated, service_role;

alter table public.stock_reservations enable row level security;

create policy "miembros ven las reservas de su tenant"
  on public.stock_reservations for select
  using (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.stock_reservations to authenticated, service_role;

grant execute on function public.solicitar_pago(uuid, int) to authenticated;
grant execute on function public.confirmar_pago(uuid) to authenticated;
grant execute on function public.cancelar_pedido(uuid) to authenticated;
grant execute on function public.avanzar_pedido(uuid, text) to authenticated;
