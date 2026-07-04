// Puerto PaymentGateway (T5.1, 03-07). Sin imports: es el tipo que
// comparten apps/panel (navegador) Y supabase/functions (Deno) via
// ruta relativa -- cualquier dependencia aqui rompe uno de los dos
// lados (Deno no resuelve especificadores npm "bare" sin import map).
export type PaymentStatus = "pending" | "approved" | "declined" | "error";

export interface CheckoutData {
  publicKey: string;
  reference: string;
  amountInCents: number;
  currency: string;
  signature: string;
}

export interface TransactionStatus {
  providerTransactionId: string;
  reference: string;
  status: PaymentStatus;
  amountInCents: number;
}

export interface WebhookEvent {
  providerTransactionId: string;
  reference: string;
  status: PaymentStatus;
  raw: unknown;
}

export interface PaymentGatewayCredentials {
  publicKey: string;
  privateKey: string;
  eventsSecret: string;
  integritySecret: string;
}

/**
 * createPaymentRequest no necesita credenciales explicitas: en la
 * implementacion real, el panel lo resuelve llamando al RPC
 * preparar_checkout_pago() (03-07 §4), que las descifra server-side
 * via current_tenant_id() -- el secreto nunca sale de Postgres.
 * getStatus/verifyWebhook si las reciben: corren en la Edge Function
 * con la clave de administracion del backend, sin "tenant actual" implicito.
 */
export interface PaymentGateway {
  createPaymentRequest(orderId: string): Promise<CheckoutData>;
  getStatus(providerTransactionId: string, credentials: PaymentGatewayCredentials): Promise<TransactionStatus>;
  verifyWebhook(rawBody: string, credentials: PaymentGatewayCredentials): Promise<boolean>;
  parseEvent(rawBody: string): WebhookEvent;
}
