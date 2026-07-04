// Test de integracion (T6.1, sin WABA real -- 03-08 §0/§7.4): corre
// contra el stack local real de Supabase, con un adaptador simulado
// en vez de la Graph API de Meta (no hay credenciales reales
// todavia). Prueba el flujo conversacional completo (saludo -> pedido
// creado + stock reservado) y la idempotencia por message_id (FF-4).
// Requiere SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY del stack local
// (`supabase status`); sin ellas, se salta solo (mismo patron que
// wompi-webhook/integration.test.ts).
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { processWhatsAppWebhook } from "../_shared/whatsapp-webhook-handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const APP_SECRET = "app-secret-de-test-no-real";

async function firmar(rawBody: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}

function construirPayload(phoneNumberId: string, from: string, messageId: string, texto: string) {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID_TEST",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "573001234567", phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: "Cliente Test" }, wa_id: from }],
              messages: [{ from, id: messageId, timestamp: `${Math.floor(Date.now() / 1000)}`, text: { body: texto }, type: "text" }],
            },
            field: "messages",
          },
        ],
      },
    ],
  });
}

Deno.test({
  name: "T6.1: flujo conversacional saludo->catalogo->carrito->confirmar->pedido creado (simulado, sin WABA real)",
  ignore: !SERVICE_ROLE_KEY,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!);
    const tenantId = crypto.randomUUID();
    const phoneNumberId = `phone-${crypto.randomUUID()}`;
    const customerPhone = "573009876543";

    await admin.from("tenants").insert({ id: tenantId, nombre: "Tenant WhatsApp Test" });
    await admin.rpc("set_whatsapp_credentials", {
      p_tenant_id: tenantId,
      p_phone_number_id: phoneNumberId,
      p_access_token: "token-dummy-no-real",
    });

    const { data: producto } = await admin
      .from("productos")
      .insert({ tenant_id: tenantId, nombre: "Producto WhatsApp", precio: 15000, stock: 5 })
      .select()
      .single();

    try {
      // 1) saludo -> catalogo
      const raw1 = construirPayload(phoneNumberId, customerPhone, `wamid.${crypto.randomUUID()}`, "hola");
      const r1 = await processWhatsAppWebhook(raw1, await firmar(raw1), APP_SECRET, admin);
      assertEquals(r1.status, 200);

      const { data: conv1 } = await admin
        .from("whatsapp_conversations")
        .select("state, cart")
        .eq("tenant_id", tenantId)
        .eq("customer_phone", customerPhone)
        .single();
      assertEquals(conv1!.state, "catalogo", "el primer mensaje mueve la conversacion a catalogo");

      // 2) catalogo -> carrito (selecciona el producto)
      const raw2 = construirPayload(phoneNumberId, customerPhone, `wamid.${crypto.randomUUID()}`, `agregar ${producto.id} 2`);
      const r2 = await processWhatsAppWebhook(raw2, await firmar(raw2), APP_SECRET, admin);
      assertEquals(r2.status, 200);

      const { data: conv2 } = await admin
        .from("whatsapp_conversations")
        .select("state, cart")
        .eq("tenant_id", tenantId)
        .eq("customer_phone", customerPhone)
        .single();
      assertEquals(conv2!.state, "carrito");
      assertEquals(conv2!.cart, [{ producto_id: producto.id, cantidad: 2 }]);

      // 3) carrito -> confirmar
      const raw3 = construirPayload(phoneNumberId, customerPhone, `wamid.${crypto.randomUUID()}`, "confirmar");
      const r3 = await processWhatsAppWebhook(raw3, await firmar(raw3), APP_SECRET, admin);
      assertEquals(r3.status, 200);

      const { data: conv3 } = await admin
        .from("whatsapp_conversations")
        .select("state")
        .eq("tenant_id", tenantId)
        .eq("customer_phone", customerPhone)
        .single();
      assertEquals(conv3!.state, "confirmar");

      // 4) confirmar -> esperando_pago: crea el pedido real y reserva stock (03-05).
      const raw4 = construirPayload(phoneNumberId, customerPhone, `wamid.${crypto.randomUUID()}`, "si");
      const r4 = await processWhatsAppWebhook(raw4, await firmar(raw4), APP_SECRET, admin);
      assertEquals(r4.status, 200);

      const { data: conv4 } = await admin
        .from("whatsapp_conversations")
        .select("state, order_id")
        .eq("tenant_id", tenantId)
        .eq("customer_phone", customerPhone)
        .single();
      assertEquals(conv4!.state, "esperando_pago");
      assertEquals(typeof conv4!.order_id, "string");

      const { data: order } = await admin.from("orders").select("estado, total").eq("id", conv4!.order_id).single();
      assertEquals(order!.estado, "pendiente_pago", "solicitar_pago se disparo desde la conversacion");
      assertEquals(Number(order!.total), 30000, "total = precio x cantidad (15000 x 2)");

      const { data: stockTrasReserva } = await admin.from("productos").select("stock").eq("id", producto.id).single();
      assertEquals(stockTrasReserva!.stock, 3, "el stock se reservo (5 - 2 = 3), mismo mecanismo que 03-05");

      // 5) notificacion de estado: el pago se confirma (simulado, sin
      // pasarela real en este test) y la conversacion se cierra.
      await admin.rpc("confirmar_pago", { p_order_id: conv4!.order_id });
      const { data: cierre } = await admin.rpc("cerrar_conversacion_por_pedido", {
        p_order_id: conv4!.order_id,
        p_evento: "order.confirmado",
      });
      assertEquals(cierre![0].customer_phone, customerPhone);
      assertEquals(cierre![0].respuesta.includes("confirmado"), true);

      const { data: convFinal } = await admin
        .from("whatsapp_conversations")
        .select("state")
        .eq("tenant_id", tenantId)
        .eq("customer_phone", customerPhone)
        .single();
      assertEquals(convFinal!.state, "cerrada");
    } finally {
      await admin.from("tenants").delete().eq("id", tenantId);
    }
  },
});

Deno.test({
  name: "T6.1 (FF-4): mensaje duplicado de Meta (mismo message_id) => cero efecto doble",
  ignore: !SERVICE_ROLE_KEY,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!);
    const tenantId = crypto.randomUUID();
    const phoneNumberId = `phone-${crypto.randomUUID()}`;
    const customerPhone = "573001112233";
    const messageId = `wamid.${crypto.randomUUID()}`;

    await admin.from("tenants").insert({ id: tenantId, nombre: "Tenant WhatsApp Replay Test" });
    await admin.rpc("set_whatsapp_credentials", {
      p_tenant_id: tenantId,
      p_phone_number_id: phoneNumberId,
      p_access_token: "token-dummy-no-real",
    });

    try {
      const raw = construirPayload(phoneNumberId, customerPhone, messageId, "hola");
      const signature = await firmar(raw);

      const r1 = await processWhatsAppWebhook(raw, signature, APP_SECRET, admin);
      assertEquals(r1.status, 200);
      const r2 = await processWhatsAppWebhook(raw, signature, APP_SECRET, admin); // replay: mismo message_id
      assertEquals(r2.status, 200, "el replay tambien responde 200, no se trata como error");

      const { data: conv } = await admin
        .from("whatsapp_conversations")
        .select("state")
        .eq("tenant_id", tenantId)
        .eq("customer_phone", customerPhone)
        .single();
      assertEquals(conv!.state, "catalogo", "un solo avance de estado pese al replay -- si hubiera doble efecto, la segunda llamada fallaria al intentar catalogo->catalogo o similar");

      const { count: jobCount } = await admin
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("idempotency_key", messageId);
      assertEquals(jobCount, 1, "un solo job persistido pese al replay (unique tenant_id+idempotency_key)");
    } finally {
      await admin.from("tenants").delete().eq("id", tenantId);
    }
  },
});

Deno.test({
  name: "T6.1: firma invalida => 401, nada se persiste",
  ignore: !SERVICE_ROLE_KEY,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!);
    const raw = construirPayload("phone-inexistente", "573000000000", `wamid.${crypto.randomUUID()}`, "hola");
    const resultado = await processWhatsAppWebhook(raw, "sha256=firmaincorrecta", APP_SECRET, admin);
    assertEquals(resultado.status, 401);
  },
});
