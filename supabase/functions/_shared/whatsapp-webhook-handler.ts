// Logica testeable del webhook de WhatsApp (T6.1), separada de
// index.ts para poder invocarla directo en tests sin levantar el
// runtime HTTP (mismo patron que _shared/webhook-echo.ts y
// _shared/wompi-webhook-handler.ts).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { simulatedWhatsAppSender } from "./whatsapp-adapter.ts";

export interface WebhookResult {
  status: number;
  body: string;
}

/**
 * Gramatica minima de comandos (v1, lab): "agregar <producto_id> <cantidad>"
 * selecciona un item; cualquier otro texto pasa tal cual a
 * avanzar_conversacion_por_mensaje (que decide segun el estado actual,
 * 03-08 §5/§6) -- el saludo, "confirmar" y "si" no necesitan producto_id.
 */
function parseComandoProducto(text: string): { productoId?: string; cantidad?: number } {
  const match = text.trim().match(/^agregar\s+([0-9a-fA-F-]{36})\s+(\d+)$/i);
  if (!match) return {};
  return { productoId: match[1], cantidad: parseInt(match[2], 10) };
}

export async function processWhatsAppWebhook(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
  supabase: SupabaseClient,
): Promise<WebhookResult> {
  const firmaValida = await simulatedWhatsAppSender.verifyWebhookSignature(rawBody, signatureHeader, appSecret);
  if (!firmaValida) {
    return { status: 401, body: "firma invalida" };
  }

  let messages;
  try {
    messages = simulatedWhatsAppSender.parseIncoming(rawBody);
  } catch {
    return { status: 400, body: "payload invalido" };
  }

  for (const msg of messages) {
    const { data: credRows, error: credError } = await supabase.rpc("get_whatsapp_credentials", {
      p_phone_number_id: msg.phoneNumberId,
    });
    const cred = credRows?.[0] as { tenant_id: string; phone_number_id: string; access_token: string } | undefined;
    if (credError || !cred) continue; // numero no pertenece a ningun tenant conocido -- se ignora, no se falla el webhook completo

    // Idempotencia por message_id de Meta (FF-4): un insert real en
    // `jobs` solo ocurre la primera vez (unique tenant_id+idempotency_key,
    // ignoreDuplicates). Si ya existia, no se vuelve a avanzar la FSM.
    const { data: jobRows, error: jobError } = await supabase
      .from("jobs")
      .upsert(
        {
          tenant_id: cred.tenant_id,
          idempotency_key: msg.providerMessageId,
          job_type: "whatsapp.mensaje_entrante",
          payload: msg,
        },
        { onConflict: "tenant_id,idempotency_key", ignoreDuplicates: true },
      )
      .select();
    if (jobError) throw jobError;

    const esReplay = !jobRows || jobRows.length === 0;
    if (esReplay) continue;

    const { productoId, cantidad } = parseComandoProducto(msg.text);
    const { error: avanzarError } = await supabase.rpc("avanzar_conversacion_por_mensaje", {
      p_tenant_id: cred.tenant_id,
      p_customer_phone: msg.from,
      p_mensaje: msg.text,
      p_producto_id: productoId ?? null,
      p_cantidad: cantidad ?? null,
    });
    if (avanzarError) throw avanzarError;
  }

  return { status: 200, body: "ok" };
}
