// Logica testeable del webhook de Wompi (T5.1), separada de index.ts
// para poder invocarla directo en tests sin levantar el runtime HTTP
// (mismo patron que _shared/webhook-echo.ts de T2.2).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { wompiGateway } from "./wompi-adapter.ts";
import type { PaymentGatewayCredentials } from "../../../packages/core/src/payment-gateway.ts";

export interface WebhookResult {
  status: number;
  body: string;
}

export async function processWompiWebhook(rawBody: string, supabase: SupabaseClient): Promise<WebhookResult> {
  let reference: string | undefined;
  try {
    reference = JSON.parse(rawBody)?.data?.transaction?.reference;
  } catch {
    return { status: 400, body: "payload invalido" };
  }
  if (!reference) {
    return { status: 400, body: "falta data.transaction.reference" };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, tenant_id, estado")
    .eq("id", reference)
    .single();
  if (orderError || !order) {
    return { status: 404, body: "pedido no encontrado" };
  }

  const { data: credsRows, error: credsError } = await supabase.rpc("get_payment_credentials", {
    p_tenant_id: order.tenant_id,
  });
  const credentials = credsRows?.[0] as
    | { public_key: string; private_key: string; events_secret: string; integrity_secret: string }
    | undefined;
  if (credsError || !credentials) {
    return { status: 404, body: "tenant sin credenciales de pago" };
  }
  const paymentCredentials: PaymentGatewayCredentials = {
    publicKey: credentials.public_key,
    privateKey: credentials.private_key,
    eventsSecret: credentials.events_secret,
    integritySecret: credentials.integrity_secret,
  };

  const firmaValida = await wompiGateway.verifyWebhook(rawBody, paymentCredentials);
  if (!firmaValida) {
    return { status: 401, body: "firma invalida" };
  }

  const event = wompiGateway.parseEvent(rawBody);

  await supabase.rpc("registrar_referencia_pago", {
    p_reference: reference,
    p_provider_transaction_id: event.providerTransactionId,
  });

  // getstatus-como-verdad: nunca se confia en el status del webhook solo.
  const estadoReal = await wompiGateway.getStatus(event.providerTransactionId, paymentCredentials);

  if (estadoReal.status === "approved") {
    const { error } = await supabase.rpc("confirmar_pago", { p_order_id: reference });
    if (error && !error.message.includes("no esta pendiente de pago")) {
      return { status: 500, body: `error confirmando: ${error.message}` };
    }
  } else if (estadoReal.status === "declined" || estadoReal.status === "error") {
    const { error } = await supabase.rpc("cancelar_pedido", { p_order_id: reference });
    if (error && !error.message.includes("no esta pendiente de pago")) {
      return { status: 500, body: `error cancelando: ${error.message}` };
    }
  }

  return { status: 200, body: "ok" };
}
