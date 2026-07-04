// Edge Function wompi-webhook (T5.1): la logica real vive en
// _shared/wompi-webhook-handler.ts (testeable sin runtime HTTP).
import { createClient } from "npm:@supabase/supabase-js@2";
import { processWompiWebhook } from "../_shared/wompi-webhook-handler.ts";

Deno.serve(async (req) => {
  const rawBody = await req.text();

  // WHY service_role: webhook sin sesion de usuario. El handler
  // filtra explicitamente por el order_id/tenant_id resuelto adentro
  // (regla #4, CLAUDE.md).
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const result = await processWompiWebhook(rawBody, supabase);
  return new Response(result.body, { status: result.status });
});
