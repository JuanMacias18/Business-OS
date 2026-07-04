// Job de conciliacion (T5.1, 03-07 §6): pedidos pendiente_pago
// atascados hace mas de X minutos. Con provider_transaction_id, se
// vuelve a consultar getStatus y se resuelve. Sin el (el webhook nunca
// llego), se alerta -- no hay nada que re-consultar todavia.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { wompiGateway } from "./wompi-adapter.ts";
import type { PaymentGatewayCredentials } from "../../../packages/core/src/payment-gateway.ts";

export interface ResultadoConciliacion {
  ordersRevisados: number;
  confirmados: number;
  cancelados: number;
  alertados: number;
}

export async function conciliarPagosPendientes(
  supabase: SupabaseClient,
  umbralMinutos: number,
): Promise<ResultadoConciliacion> {
  const limite = new Date(Date.now() - umbralMinutos * 60_000).toISOString();

  const { data: pendientes, error } = await supabase
    .from("orders")
    .select("id, tenant_id, provider_transaction_id")
    .eq("estado", "pendiente_pago")
    .lt("updated_at", limite);
  if (error) throw error;

  const resultado: ResultadoConciliacion = { ordersRevisados: pendientes?.length ?? 0, confirmados: 0, cancelados: 0, alertados: 0 };

  for (const order of pendientes ?? []) {
    if (!order.provider_transaction_id) {
      await supabase.from("event_log").insert({
        tenant_id: order.tenant_id,
        correlation_id: crypto.randomUUID(),
        event_type: "order.conciliacion.alerta",
        payload: { order_id: order.id, motivo: "pendiente_pago sin provider_transaction_id: el webhook nunca llego" },
      });
      resultado.alertados++;
      continue;
    }

    const { data: credsRows } = await supabase.rpc("get_payment_credentials", { p_tenant_id: order.tenant_id });
    const creds = credsRows?.[0] as
      | { public_key: string; private_key: string; events_secret: string; integrity_secret: string }
      | undefined;
    if (!creds) {
      resultado.alertados++;
      continue;
    }
    const credentials: PaymentGatewayCredentials = {
      publicKey: creds.public_key,
      privateKey: creds.private_key,
      eventsSecret: creds.events_secret,
      integritySecret: creds.integrity_secret,
    };

    const estado = await wompiGateway.getStatus(order.provider_transaction_id, credentials);

    if (estado.status === "approved") {
      await supabase.rpc("confirmar_pago", { p_order_id: order.id });
      resultado.confirmados++;
    } else if (estado.status === "declined" || estado.status === "error") {
      await supabase.rpc("cancelar_pedido", { p_order_id: order.id });
      resultado.cancelados++;
    }
    // "pending" real: se deja para la proxima corrida o para el TTL de 03-05 §5.
  }

  return resultado;
}
