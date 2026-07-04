// Adaptador del puerto WhatsAppSender (T6.1, 03-08 §4).
// verifyWebhookSignature/parseIncoming implementan el algoritmo REAL
// de Meta Cloud API (HMAC-SHA256 generico, documentado publicamente,
// no requiere WABA para probarse). sendMessage SI esta simulado -- no
// hay credenciales reales de Meta todavia (T0.5 en curso, 03-08 §0);
// se reemplaza por un adaptador real sin tocar la FSM cuando existan.
import type {
  IncomingMessage,
  OutgoingMessage,
  SendResult,
  WhatsAppCredentials,
} from "../../../packages/core/src/whatsapp-sender.ts";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(rawBody: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** X-Hub-Signature-256 real de Meta: "sha256=" + HMAC-SHA256(rawBody, app_secret) en hex (03-08 §2.2). */
async function verifyWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const received = signatureHeader.slice("sha256=".length);
  const expected = await hmacSha256Hex(rawBody, appSecret);
  return timingSafeEqual(expected, received);
}

/**
 * Forma real del payload de Meta Cloud API (entry[].changes[].value.messages[]).
 * Solo mensajes de texto entrantes se traducen a IncomingMessage; otros
 * campos (p. ej. "statuses", acuses de entrega) se ignoran aqui -- 03-08 §2.2.
 */
function parseIncoming(rawBody: string): IncomingMessage[] {
  const payload = JSON.parse(rawBody);
  const out: IncomingMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const phoneNumberId: string | undefined = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      for (const message of value.messages ?? []) {
        if (message.type !== "text") continue;
        out.push({
          providerMessageId: message.id,
          phoneNumberId,
          from: message.from,
          text: message.text?.body ?? "",
        });
      }
    }
  }

  return out;
}

/** Adaptador simulado: registra el envio en vez de llamar a la Graph API real (03-08 §0/§4). */
async function sendMessage(msg: OutgoingMessage, _credentials: WhatsAppCredentials): Promise<SendResult> {
  return { providerMessageId: `simulado-${crypto.randomUUID()}` };
}

export const simulatedWhatsAppSender = { sendMessage, verifyWebhookSignature, parseIncoming };
