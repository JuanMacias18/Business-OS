// Edge Function whatsapp-webhook (T6.1, 03-08 §2): GET verifica el
// endpoint con Meta (hub.challenge); POST valida firma y procesa
// mensajes entrantes de forma idempotente. El procesamiento pesado
// (avanzar la FSM) ocurre dentro de la RPC de Postgres, nunca contra
// la Graph API saliente -- responde rapido igual que webhook-echo/
// wompi-webhook.
import { createClient } from "npm:@supabase/supabase-js@2";
import { processWhatsAppWebhook } from "../_shared/whatsapp-webhook-handler.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";

    if (mode === "subscribe" && challenge && token === verifyToken) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";

  // WHY service_role: este handler no tiene sesion de usuario (lo
  // llama Meta, no un JWT de panel). tenant_id se resuelve explicito
  // via get_whatsapp_credentials/avanzar_conversacion_por_mensaje
  // (regla #4, CLAUDE.md) -- nunca un query sin ese filtro.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const result = await processWhatsAppWebhook(rawBody, signature, appSecret, supabase);
  return new Response(result.body, { status: result.status });
});
