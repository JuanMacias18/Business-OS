// Logica testeable del webhook-echo (T2.2). Separada de index.ts para
// poder correr `deno test` sin levantar el runtime HTTP de la funcion
// (patron recomendado por el plan de entrega).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface WebhookEchoPayload {
  tenant_id: string;
  idempotency_key: string;
  event_type: string;
  data?: unknown;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacHex(rawBody: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Firma HMAC-SHA256 dummy (T2.2 walking skeleton; T5.1 la reemplaza por la de la pasarela real). */
export async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const expected = await hmacHex(rawBody, secret);
  return timingSafeEqual(expected, signatureHeader);
}

/**
 * Persiste la recepcion del webhook. Dos llamadas con el mismo
 * `idempotency_key` para el mismo tenant producen 2 filas en
 * event_log (recepcion, sin dedup: observabilidad de reintentos) pero
 * 1 sola fila de efecto en jobs (dedup real via UNIQUE + on-conflict,
 * FF-4).
 */
export async function recordWebhookReceipt(
  supabase: SupabaseClient,
  payload: WebhookEchoPayload,
): Promise<void> {
  const { error: logError } = await supabase.from("event_log").insert({
    tenant_id: payload.tenant_id,
    correlation_id: crypto.randomUUID(),
    event_type: "webhook.echo.received",
    payload,
  });
  if (logError) throw logError;

  const { error: jobError } = await supabase.from("jobs").upsert(
    {
      tenant_id: payload.tenant_id,
      idempotency_key: payload.idempotency_key,
      job_type: payload.event_type,
      payload,
    },
    { onConflict: "tenant_id,idempotency_key", ignoreDuplicates: true },
  );
  if (jobError) throw jobError;
}
