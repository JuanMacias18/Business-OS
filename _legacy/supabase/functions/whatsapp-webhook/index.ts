// ============================================================
// Supabase Edge Function: whatsapp-webhook
// Recibe el webhook de la WhatsApp Cloud API de Meta.
//   GET  -> verificación del webhook (handshake).
//   POST -> procesa mensajes entrantes, parsea el pedido y lo guarda.
//
// Despliegue (público, Meta no envía JWT):
//   supabase functions deploy whatsapp-webhook --no-verify-jwt
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calcularDetallesYTotal, parsePedido } from "./parser.ts";
import {
  getCatalogo,
  getTenantByPhoneNumberId,
  insertPedido,
  upsertCliente,
} from "./db.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ------------------------------------------------------------
// Verificación de la firma X-Hub-Signature-256 (HMAC-SHA256).
// ------------------------------------------------------------
async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  if (!APP_SECRET) return true; // no configurada -> no se exige (dev)
  if (!header) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected =
    "sha256=" + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

  // comparación de longitud constante
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

// ------------------------------------------------------------
// Procesa un único mensaje de texto: parsea y persiste el pedido.
// ------------------------------------------------------------
async function procesarMensaje(
  phoneNumberId: string,
  senderId: string,
  nombre: string | null,
  messageBody: string,
): Promise<void> {
  console.log(`[whatsapp] mensaje de ${senderId}: "${messageBody}"`);

  const tenant = await getTenantByPhoneNumberId(supabase, phoneNumberId);
  if (!tenant) {
    console.error(`[whatsapp] sin tenant para phone_number_id=${phoneNumberId}`);
    return;
  }

  const catalogo = await getCatalogo(supabase, tenant.id);
  const items = parsePedido(messageBody, catalogo);

  if (items.length === 0) {
    console.log(`[whatsapp] no se reconocieron ítems en el mensaje (tenant=${tenant.nombre})`);
    return;
  }

  const { detalles, total } = calcularDetallesYTotal(items, catalogo);

  const clienteId = await upsertCliente(supabase, tenant.id, senderId, nombre);
  if (!clienteId) return;

  const pedidoId = await insertPedido(supabase, {
    tenantId: tenant.id,
    clienteId,
    total,
    detalles,
    mensajeOrigen: messageBody,
  });

  console.log(`[whatsapp] pedido ${pedidoId} creado (total=${total}, items=${items.length})`);
}

// ------------------------------------------------------------
// Handler principal.
// ------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // --- Verificación del webhook (GET) ---
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // --- Mensajes entrantes (POST) ---
  if (req.method === "POST") {
    const rawBody = await req.text();

    if (!(await verifySignature(rawBody, req.headers.get("x-hub-signature-256")))) {
      console.error("[whatsapp] firma inválida");
      return new Response("Invalid signature", { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    // Recorre la estructura de Meta y procesa cada mensaje de texto.
    try {
      for (const entry of payload.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value ?? {};
          const phoneNumberId = value.metadata?.phone_number_id;
          const contactName = value.contacts?.[0]?.profile?.name ?? null;

          for (const msg of value.messages ?? []) {
            if (msg.type !== "text") continue;
            await procesarMensaje(
              phoneNumberId,
              msg.from,
              contactName,
              msg.text?.body ?? "",
            );
          }
        }
      }
    } catch (err) {
      // Logueamos pero igual devolvemos 200 para que Meta no reintente en bucle.
      console.error("[whatsapp] error procesando payload:", err);
    }

    return new Response("OK", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
});
