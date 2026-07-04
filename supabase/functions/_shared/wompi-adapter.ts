// Adaptador Wompi del puerto PaymentGateway (T5.1, 03-07 §3).
// Los tipos vienen de packages/core por ruta relativa -- ese archivo
// no tiene imports, asi que Deno lo resuelve sin import map.
import type {
  PaymentGatewayCredentials,
  PaymentStatus,
  TransactionStatus,
  WebhookEvent,
} from "../../../packages/core/src/payment-gateway.ts";

const WOMPI_SANDBOX_URL = "https://sandbox.wompi.co/v1";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mapWompiStatus(status: string): PaymentStatus {
  switch (status) {
    case "APPROVED":
      return "approved";
    case "PENDING":
      return "pending";
    case "DECLINED":
    case "VOIDED":
      return "declined";
    default:
      return "error";
  }
}

async function getStatus(providerTransactionId: string, credentials: PaymentGatewayCredentials): Promise<TransactionStatus> {
  const response = await fetch(`${WOMPI_SANDBOX_URL}/transactions/${providerTransactionId}`, {
    headers: { Authorization: `Bearer ${credentials.privateKey}` },
  });
  if (!response.ok) {
    throw new Error(`Wompi getStatus fallo: HTTP ${response.status}`);
  }
  const body = await response.json();
  const tx = body.data;
  return {
    providerTransactionId: tx.id,
    reference: tx.reference,
    status: mapWompiStatus(tx.status),
    amountInCents: tx.amount_in_cents,
  };
}

/**
 * Checksum real de Wompi (03-07 §7, verificado contra fixtures reales):
 * sha256(concat(valores de data.transaction en el orden de
 * signature.properties) + timestamp + events_secret).
 */
async function verifyWebhook(rawBody: string, credentials: PaymentGatewayCredentials): Promise<boolean> {
  try {
    const event = JSON.parse(rawBody);
    const properties: string[] = event.signature?.properties ?? [];
    const timestamp: number = event.timestamp;
    const receivedChecksum: string = event.signature?.checksum ?? "";
    if (properties.length === 0 || !timestamp || !receivedChecksum) return false;

    const values = properties.map((path) => {
      const parts = path.split(".").slice(1); // "transaction.id" -> ["id"]
      let value: unknown = event.data.transaction;
      for (const part of parts) value = (value as Record<string, unknown> | undefined)?.[part];
      return String(value);
    });

    const concat = values.join("") + timestamp + credentials.eventsSecret;
    const computed = (await sha256Hex(concat)).toUpperCase();
    return timingSafeEqual(computed, receivedChecksum.toUpperCase());
  } catch {
    return false;
  }
}

function parseEvent(rawBody: string): WebhookEvent {
  const event = JSON.parse(rawBody);
  const tx = event.data.transaction;
  return {
    providerTransactionId: tx.id,
    reference: tx.reference,
    status: mapWompiStatus(tx.status),
    raw: event,
  };
}

export const wompiGateway = { getStatus, verifyWebhook, parseEvent };
export { mapWompiStatus };
