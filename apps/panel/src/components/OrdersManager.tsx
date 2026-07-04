import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";

interface Producto {
  id: string;
  nombre: string;
  precio: number;
}

interface Order {
  id: string;
  estado: string;
  total: number;
  created_at: string;
}

const ESTADO_LABEL: Record<string, string> = {
  creado: "creado",
  pendiente_pago: "pendiente de pago",
  confirmado: "confirmado",
  preparando: "preparando",
  entregado: "entregado",
  cancelado: "cancelado",
  expirado: "expirado",
};

export function OrdersManager({ tenantId }: { tenantId: string }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [error, setError] = useState<string | null>(null);

  async function loadOrders() {
    const { data } = await supabase
      .from("orders")
      .select("id, estado, total, created_at")
      .order("created_at", { ascending: false });
    setOrders((data as Order[] | null) ?? []);
  }

  useEffect(() => {
    supabase
      .from("productos")
      .select("id, nombre, precio")
      .eq("disponible", true)
      .then(({ data }) => setProductos((data as Producto[] | null) ?? []));
    loadOrders();
  }, []);

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const producto = productos.find((p) => p.id === productoId);
    if (!producto) return;
    const qty = Number(cantidad) || 1;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({ tenant_id: tenantId, total: producto.precio * qty })
      .select()
      .single();
    if (orderError || !order) {
      setError(orderError?.message ?? "no se pudo crear el pedido");
      return;
    }

    const { error: itemError } = await supabase.from("order_items").insert({
      order_id: order.id,
      tenant_id: tenantId,
      producto_id: producto.id,
      cantidad: qty,
      precio_unitario: producto.precio,
    });
    if (itemError) {
      setError(itemError.message);
      return;
    }

    setProductoId("");
    setCantidad("1");
    await loadOrders();
  }

  async function runAction(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setError(null);
    const { error: rpcError } = await fn();
    if (rpcError) {
      setError(rpcError.message);
    }
    await loadOrders();
  }

  async function abrirCheckoutWompi(orderId: string) {
    setError(null);
    const { data, error: checkoutError } = await supabase
      .rpc("preparar_checkout_pago", { p_order_id: orderId })
      .single<{
        public_key: string;
        reference: string;
        amount_in_cents: number;
        currency: string;
        signature: string;
      }>();
    if (checkoutError || !data) {
      setError(checkoutError?.message ?? "no se pudo preparar el checkout");
      return;
    }

    const params = new URLSearchParams({
      "public-key": data.public_key,
      currency: data.currency,
      "amount-in-cents": String(data.amount_in_cents),
      reference: data.reference,
      "signature:integrity": data.signature,
      "redirect-url": window.location.href,
    });
    window.open(`https://checkout.wompi.co/p/?${params.toString()}`, "_blank");
  }

  return (
    <div data-testid="orders-manager" className="flex w-full max-w-xl flex-col gap-4">
      <form onSubmit={handleCreateOrder} data-testid="create-order-form" className="flex gap-2">
        <select
          value={productoId}
          onChange={(e) => setProductoId(e.target.value)}
          data-testid="order-producto-select"
          className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1"
          required
        >
          <option value="">producto...</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} (${p.precio})
            </option>
          ))}
        </select>
        <input
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          type="number"
          min="1"
          data-testid="order-cantidad-input"
          className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1"
        />
        <button type="submit" data-testid="create-order-button" className="rounded bg-slate-100 px-3 py-1 text-slate-950">
          Crear pedido
        </button>
      </form>

      {error && <p data-testid="orders-error" className="text-sm text-red-400">{error}</p>}

      <ul className="flex flex-col gap-2" data-testid="orders-list">
        {orders.map((order) => (
          <li key={order.id} data-testid={`order-row-${order.id}`} className="flex items-center gap-3 border border-slate-700 p-2">
            <span data-testid="order-total" className="flex-1">
              ${order.total}
            </span>
            <span data-testid="order-estado" className="rounded bg-slate-800 px-2 py-0.5 text-xs">
              {ESTADO_LABEL[order.estado] ?? order.estado}
            </span>

            {order.estado === "creado" && (
              <button
                type="button"
                data-testid={`solicitar-pago-${order.id}`}
                onClick={() => runAction(() => supabase.rpc("solicitar_pago", { p_order_id: order.id }))}
                className="rounded border border-slate-600 px-2 py-1 text-xs"
              >
                Solicitar pago
              </button>
            )}

            {order.estado === "pendiente_pago" && (
              <>
                <button
                  type="button"
                  data-testid={`pagar-wompi-${order.id}`}
                  onClick={() => abrirCheckoutWompi(order.id)}
                  className="rounded border border-indigo-700 px-2 py-1 text-xs text-indigo-400"
                >
                  Pagar con Wompi
                </button>
                <button
                  type="button"
                  data-testid={`confirmar-pago-${order.id}`}
                  onClick={() => runAction(() => supabase.rpc("confirmar_pago", { p_order_id: order.id }))}
                  className="rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-400"
                  title="Simulacion manual -- el flujo real confirma solo via el webhook de Wompi"
                >
                  Confirmar pago (manual)
                </button>
                <button
                  type="button"
                  data-testid={`cancelar-pedido-${order.id}`}
                  onClick={() => runAction(() => supabase.rpc("cancelar_pedido", { p_order_id: order.id }))}
                  className="rounded border border-red-800 px-2 py-1 text-xs text-red-400"
                >
                  Cancelar
                </button>
              </>
            )}

            {order.estado === "confirmado" && (
              <button
                type="button"
                data-testid={`avanzar-preparando-${order.id}`}
                onClick={() => runAction(() => supabase.rpc("avanzar_pedido", { p_order_id: order.id, p_nuevo_estado: "preparando" }))}
                className="rounded border border-slate-600 px-2 py-1 text-xs"
              >
                Marcar preparando
              </button>
            )}

            {order.estado === "preparando" && (
              <button
                type="button"
                data-testid={`avanzar-entregado-${order.id}`}
                onClick={() => runAction(() => supabase.rpc("avanzar_pedido", { p_order_id: order.id, p_nuevo_estado: "entregado" }))}
                className="rounded border border-slate-600 px-2 py-1 text-xs"
              >
                Marcar entregado
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
