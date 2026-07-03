// Edge Function webhook-echo (T2.2): valida firma -> registra
// recepcion + encola efecto (idempotente) -> responde 200 rapido.
// El procesamiento pesado NO ocurre aqui (queda en process_pending_jobs).
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  recordWebhookReceipt,
  verifySignature,
  type WebhookEchoPayload,
} from "../_shared/webhook-echo.ts";

Deno.serve(async (req) => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-webhook-signature");
  const secret = Deno.env.get("WEBHOOK_ECHO_SECRET") ?? "";

  if (!(await verifySignature(rawBody, signature, secret))) {
    return new Response("invalid signature", { status: 401 });
  }

  let payload: WebhookEchoPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  // WHY service_role: este handler no tiene sesion de usuario (lo
  // llama la pasarela/emisor del webhook, no un JWT de panel). Se
  // filtra tenant_id explicito en cada insert de _shared (regla #4,
  // CLAUDE.md) -- nunca un query sin ese filtro.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  await recordWebhookReceipt(supabase, payload);

  return new Response("ok", { status: 200 });
});
