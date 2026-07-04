// Test de integracion real (GATE de Fase 5): panel crea pedido ->
// solicita pago -> checkout real de Wompi sandbox -> pago real
// (tarjeta de prueba) -> webhook real -> confirmacion automatica ->
// inventario correcto. Corre contra el stack local + la API real de
// sandbox de Wompi (no mocks). Requiere SUPABASE_URL/
// SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY +
// WOMPI_TEST_PUBLIC_KEY/WOMPI_TEST_PRIVATE_KEY/WOMPI_TEST_EVENTS_SECRET/
// WOMPI_TEST_INTEGRITY_SECRET (llaves de sandbox reales, nunca
// hardcodeadas -- este repo es publico).
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { processWompiWebhook } from "../_shared/wompi-webhook-handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const WOMPI_SANDBOX_URL = "https://sandbox.wompi.co/v1";
const PUBLIC_KEY = Deno.env.get("WOMPI_TEST_PUBLIC_KEY") ?? "";
const PRIVATE_KEY = Deno.env.get("WOMPI_TEST_PRIVATE_KEY") ?? "";
const EVENTS_SECRET = Deno.env.get("WOMPI_TEST_EVENTS_SECRET") ?? "";
const INTEGRITY_SECRET = Deno.env.get("WOMPI_TEST_INTEGRITY_SECRET") ?? "";
const TIENE_CREDENCIALES_WOMPI = Boolean(PUBLIC_KEY && PRIVATE_KEY && EVENTS_SECRET && INTEGRITY_SECRET);

async function tokenizarTarjeta(numero: string): Promise<string> {
  const resp = await fetch(`${WOMPI_SANDBOX_URL}/tokens/cards`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PUBLIC_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ number: numero, cvc: "123", exp_month: "12", exp_year: "29", card_holder: "Integration Test" }),
  });
  const body = await resp.json();
  return body.data.id;
}

async function crearTransaccionWompi(reference: string, amountInCents: number, cardToken: string) {
  const merchant = await (await fetch(`${WOMPI_SANDBOX_URL}/merchants/${PUBLIC_KEY}`)).json();
  const acceptanceToken = merchant.data.presigned_acceptance.acceptance_token;

  const signatureBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${reference}${amountInCents}COP${INTEGRITY_SECRET}`),
  );
  const signature = Array.from(new Uint8Array(signatureBytes)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const resp = await fetch(`${WOMPI_SANDBOX_URL}/transactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PRIVATE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount_in_cents: amountInCents,
      currency: "COP",
      signature,
      customer_email: "integration-test@example.com",
      reference,
      acceptance_token: acceptanceToken,
      payment_method: { type: "CARD", installments: 1, token: cardToken },
    }),
  });
  return (await resp.json()).data;
}

async function esperarResultadoFinal(transactionId: string) {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const resp = await fetch(`${WOMPI_SANDBOX_URL}/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${PRIVATE_KEY}` },
    });
    const tx = (await resp.json()).data;
    if (tx.status !== "PENDING") return tx;
  }
  throw new Error("la transaccion de sandbox no resolvio a tiempo");
}

function construirEventoWebhook(tx: { id: string; status: string; amount_in_cents: number; reference: string }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  const concat = tx.id + tx.status + tx.amount_in_cents + timestamp + EVENTS_SECRET;
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(concat)).then((digest) => {
    const checksum = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    return JSON.stringify({
      event: "transaction.updated",
      data: { transaction: tx },
      signature: { properties, checksum },
      timestamp,
      sent_at: new Date().toISOString(),
    });
  });
}

Deno.test({
  name: "GATE Fase 5: pedido -> checkout real -> pago real -> webhook real -> confirmado + inventario correcto",
  ignore: !SERVICE_ROLE_KEY || !ANON_KEY || !TIENE_CREDENCIALES_WOMPI,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!);
    const tenantId = crypto.randomUUID();
    const email = `integration-${crypto.randomUUID()}@e2e.test`;
    const password = "Test1234!";

    await admin.from("tenants").insert({ id: tenantId, nombre: "Integration Test Tenant" });

    const { error: credsError } = await admin.rpc("set_payment_credentials", {
      p_tenant_id: tenantId,
      p_public_key: PUBLIC_KEY,
      p_private_key: PRIVATE_KEY,
      p_events_secret: EVENTS_SECRET,
      p_integrity_secret: INTEGRITY_SECRET,
    });
    if (credsError) throw credsError;

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (userError) throw userError;
    await admin.from("memberships").insert({ tenant_id: tenantId, user_id: userData.user.id, role: "staff" });

    // solicitar_pago/preparar_checkout_pago corren con current_tenant_id()
    // (03-02 §3): necesitan una sesion real de usuario, no service_role
    // (que no tiene tenant_id en su JWT -- ese fue el bug del primer
    // intento de este test).
    const anon = createClient(SUPABASE_URL, ANON_KEY!);
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    const staff = createClient(SUPABASE_URL, ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${signIn.session!.access_token}` } },
    });

    const { data: producto } = await admin
      .from("productos")
      .insert({ tenant_id: tenantId, nombre: "Producto integracion", precio: 50000, stock: 3 })
      .select()
      .single();

    const { data: order } = await staff.from("orders").insert({ tenant_id: tenantId, total: 50000 }).select().single();
    await staff.from("order_items").insert({
      order_id: order.id,
      tenant_id: tenantId,
      producto_id: producto.id,
      cantidad: 1,
      precio_unitario: 50000,
    });

    const { error: solicitarError } = await staff.rpc("solicitar_pago", { p_order_id: order.id });
    if (solicitarError) throw solicitarError;

    const { data: stockTrasReserva } = await admin.from("productos").select("stock").eq("id", producto.id).single();
    assertEquals(stockTrasReserva!.stock, 2, "la reserva decremento el stock de 3 a 2");

    const cardToken = await tokenizarTarjeta("4242424242424242");
    const txCreada = await crearTransaccionWompi(order.id, 5000000, cardToken);
    const txFinal = await esperarResultadoFinal(txCreada.id);
    assertEquals(txFinal.status, "APPROVED", "la transaccion real de sandbox se aprobo");

    const rawEvent = await construirEventoWebhook(txFinal);

    const resultado1 = await processWompiWebhook(rawEvent, admin);
    assertEquals(resultado1.status, 200, "el webhook real se procesa con 200");

    const { data: orderTrasWebhook } = await admin.from("orders").select("estado").eq("id", order.id).single();
    assertEquals(orderTrasWebhook!.estado, "confirmado", "el pedido quedo confirmado automaticamente");

    const { data: stockFinal } = await admin.from("productos").select("stock").eq("id", producto.id).single();
    assertEquals(stockFinal!.stock, 2, "el inventario sigue correcto (la reserva ya fue el descuento real, 03-05 §4)");

    // Replay del mismo evento: FF-4, un solo efecto.
    const resultado2 = await processWompiWebhook(rawEvent, admin);
    assertEquals(resultado2.status, 200, "el replay tambien responde 200 (idempotente, no se trata como error)");
    const { data: orderTrasReplay } = await admin.from("orders").select("estado").eq("id", order.id).single();
    assertEquals(orderTrasReplay!.estado, "confirmado", "el replay no cambia el estado, sigue confirmado");

    await admin.from("tenants").delete().eq("id", tenantId);
  },
});

Deno.test({
  name: "GATE Fase 5 (rechazo): pago declinado -> pedido cancelado + stock liberado",
  ignore: !SERVICE_ROLE_KEY || !ANON_KEY || !TIENE_CREDENCIALES_WOMPI,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!);
    const tenantId = crypto.randomUUID();
    const email = `integration-declined-${crypto.randomUUID()}@e2e.test`;
    const password = "Test1234!";

    await admin.from("tenants").insert({ id: tenantId, nombre: "Integration Test Tenant (declined)" });
    await admin.rpc("set_payment_credentials", {
      p_tenant_id: tenantId,
      p_public_key: PUBLIC_KEY,
      p_private_key: PRIVATE_KEY,
      p_events_secret: EVENTS_SECRET,
      p_integrity_secret: INTEGRITY_SECRET,
    });

    const { data: userData } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    await admin.from("memberships").insert({ tenant_id: tenantId, user_id: userData!.user!.id, role: "staff" });

    const anon = createClient(SUPABASE_URL, ANON_KEY!);
    const { data: signIn } = await anon.auth.signInWithPassword({ email, password });
    const staff = createClient(SUPABASE_URL, ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${signIn!.session!.access_token}` } },
    });

    const { data: producto } = await admin
      .from("productos")
      .insert({ tenant_id: tenantId, nombre: "Producto integracion (declined)", precio: 30000, stock: 5 })
      .select()
      .single();

    const { data: order } = await staff.from("orders").insert({ tenant_id: tenantId, total: 30000 }).select().single();
    await staff.from("order_items").insert({
      order_id: order.id,
      tenant_id: tenantId,
      producto_id: producto.id,
      cantidad: 1,
      precio_unitario: 30000,
    });
    await staff.rpc("solicitar_pago", { p_order_id: order.id });

    const cardToken = await tokenizarTarjeta("4111111111111111"); // tarjeta de prueba rechazada
    const txCreada = await crearTransaccionWompi(order.id, 3000000, cardToken);
    const txFinal = await esperarResultadoFinal(txCreada.id);
    assertEquals(txFinal.status, "DECLINED", "la transaccion real de sandbox se rechazo");

    const rawEvent = await construirEventoWebhook(txFinal);
    const resultado = await processWompiWebhook(rawEvent, admin);
    assertEquals(resultado.status, 200);

    const { data: orderTrasWebhook } = await admin.from("orders").select("estado").eq("id", order.id).single();
    assertEquals(orderTrasWebhook!.estado, "cancelado", "el pedido se cancelo tras el rechazo real de Wompi");

    const { data: stockFinal } = await admin.from("productos").select("stock").eq("id", producto.id).single();
    assertEquals(stockFinal!.stock, 5, "el stock se libero por completo (vuelve a 5)");

    await admin.from("tenants").delete().eq("id", tenantId);
  },
});
