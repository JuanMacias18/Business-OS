// Test de replay (FF-4): corre contra el stack local real de Supabase.
// Requiere `supabase start` corriendo y las env vars SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY (ver README de la funcion o CLAUDE.md).
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { recordWebhookReceipt, type WebhookEchoPayload } from "../_shared/webhook-echo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.test({
  name: "replay: mismo idempotency_key x2 => 1 fila de efecto, 2 recepciones",
  ignore: !SERVICE_ROLE_KEY,
  fn: async () => {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!);
    const tenantId = crypto.randomUUID();

    const { error: tenantError } = await supabase
      .from("tenants")
      .insert({ id: tenantId, nombre: "Tenant replay test" });
    if (tenantError) throw tenantError;

    try {
      const payload: WebhookEchoPayload = {
        tenant_id: tenantId,
        idempotency_key: "replay-key-1",
        event_type: "webhook.echo",
        data: { ok: true },
      };

      await recordWebhookReceipt(supabase, payload);
      await recordWebhookReceipt(supabase, payload); // replay: mismo payload

      const { count: eventCount, error: eventError } = await supabase
        .from("event_log")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      if (eventError) throw eventError;

      const { count: jobCount, error: jobError } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      if (jobError) throw jobError;

      assertEquals(eventCount, 2, "2 recepciones registradas en event_log");
      assertEquals(jobCount, 1, "1 sola fila de efecto en jobs, pese al replay");

      // Un idempotency_key distinto SI produce un job nuevo (no todo se dedupe).
      await recordWebhookReceipt(supabase, { ...payload, idempotency_key: "replay-key-2" });
      const { count: jobCountAfterNew } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      assertEquals(jobCountAfterNew, 2, "un idempotency_key distinto si crea un job nuevo");
    } finally {
      await supabase.from("tenants").delete().eq("id", tenantId); // cascade limpia jobs/event_log
    }
  },
});
