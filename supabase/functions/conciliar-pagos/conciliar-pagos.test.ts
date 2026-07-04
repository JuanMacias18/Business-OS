// Test de integracion real del job de conciliacion (03-07 §6).
// Llaves de sandbox reales via env, nunca hardcodeadas (repo publico).
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { conciliarPagosPendientes } from "../_shared/conciliar-pagos-handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const PUBLIC_KEY = Deno.env.get("WOMPI_TEST_PUBLIC_KEY") ?? "";
const PRIVATE_KEY = Deno.env.get("WOMPI_TEST_PRIVATE_KEY") ?? "";
const EVENTS_SECRET = Deno.env.get("WOMPI_TEST_EVENTS_SECRET") ?? "";
const INTEGRITY_SECRET = Deno.env.get("WOMPI_TEST_INTEGRITY_SECRET") ?? "";
const TIENE_CREDENCIALES_WOMPI = Boolean(PUBLIC_KEY && PRIVATE_KEY && EVENTS_SECRET && INTEGRITY_SECRET);

async function tokenizarTarjeta(numero: string): Promise<string> {
  const resp = await fetch("https://sandbox.wompi.co/v1/tokens/cards", {
    method: "POST",
    headers: { Authorization: `Bearer ${PUBLIC_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ number: numero, cvc: "123", exp_month: "12", exp_year: "29", card_holder: "Conciliacion Test" }),
  });
  return (await resp.json()).data.id;
}

async function crearYResolverTransaccion(reference: string, amountInCents: number, cardToken: string) {
  const merchant = await (await fetch(`https://sandbox.wompi.co/v1/merchants/${PUBLIC_KEY}`)).json();
  const acceptanceToken = merchant.data.presigned_acceptance.acceptance_token;
  const sigBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${reference}${amountInCents}COP${INTEGRITY_SECRET}`),
  );
  const signature = Array.from(new Uint8Array(sigBytes)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const created = await (
    await fetch("https://sandbox.wompi.co/v1/transactions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PRIVATE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_in_cents: amountInCents,
        currency: "COP",
        signature,
        customer_email: "conciliacion-test@example.com",
        reference,
        acceptance_token: acceptanceToken,
        payment_method: { type: "CARD", installments: 1, token: cardToken },
      }),
    })
  ).json();

  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const tx = (await (await fetch(`https://sandbox.wompi.co/v1/transactions/${created.data.id}`, {
      headers: { Authorization: `Bearer ${PRIVATE_KEY}` },
    })).json()).data;
    if (tx.status !== "PENDING") return tx;
  }
  throw new Error("no resolvio a tiempo");
}

Deno.test({
  name: "conciliacion: pedido con provider_transaction_id se resuelve solo (aprobado)",
  ignore: !SERVICE_ROLE_KEY || !ANON_KEY || !TIENE_CREDENCIALES_WOMPI,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!);
    const tenantId = crypto.randomUUID();
    const email = `conciliacion-${crypto.randomUUID()}@e2e.test`;

    await admin.from("tenants").insert({ id: tenantId, nombre: "Conciliacion Test" });
    await admin.rpc("set_payment_credentials", {
      p_tenant_id: tenantId,
      p_public_key: PUBLIC_KEY,
      p_private_key: PRIVATE_KEY,
      p_events_secret: EVENTS_SECRET,
      p_integrity_secret: INTEGRITY_SECRET,
    });
    const { data: userData } = await admin.auth.admin.createUser({ email, password: "Test1234!", email_confirm: true });
    await admin.from("memberships").insert({ tenant_id: tenantId, user_id: userData!.user!.id, role: "staff" });

    const anon = createClient(SUPABASE_URL, ANON_KEY!);
    const { data: signIn } = await anon.auth.signInWithPassword({ email, password: "Test1234!" });
    const staff = createClient(SUPABASE_URL, ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${signIn!.session!.access_token}` } },
    });

    const { data: producto } = await admin
      .from("productos")
      .insert({ tenant_id: tenantId, nombre: "Producto conciliacion", precio: 40000, stock: 2 })
      .select()
      .single();
    const { data: order } = await staff.from("orders").insert({ tenant_id: tenantId, total: 40000 }).select().single();
    await staff.from("order_items").insert({
      order_id: order.id, tenant_id: tenantId, producto_id: producto.id, cantidad: 1, precio_unitario: 40000,
    });
    await staff.rpc("solicitar_pago", { p_order_id: order.id });

    const cardToken = await tokenizarTarjeta("4242424242424242");
    const tx = await crearYResolverTransaccion(order.id, 4000000, cardToken);
    assertEquals(tx.status, "APPROVED");

    // Simula "el webhook llego y registro la referencia, pero el
    // proceso se cayo antes de confirmar" -- exactamente el escenario
    // que la conciliacion existe para resolver.
    await admin.rpc("registrar_referencia_pago", { p_reference: order.id, p_provider_transaction_id: tx.id });

    // umbral negativo (no 0): registrar_referencia_pago tambien
    // dispara el trigger de orders y resetea updated_at (misma fila),
    // asi que un umbral de 0 minutos es una carrera de milisegundos
    // contra el propio "now()" de la conciliacion. -1 minuto empuja el
    // limite al futuro y elimina la carrera sin cambiar lo que se prueba.
    const resultado = await conciliarPagosPendientes(admin, -1);
    assertEquals(resultado.confirmados >= 1, true, "la conciliacion confirmo al menos 1 pedido (el nuestro)");

    const { data: orderFinal } = await admin.from("orders").select("estado").eq("id", order.id).single();
    assertEquals(orderFinal!.estado, "confirmado", "la conciliacion confirmo el pedido sin webhook de por medio");

    await admin.from("tenants").delete().eq("id", tenantId);
  },
});

Deno.test({
  name: "conciliacion: pedido sin provider_transaction_id genera una alerta, no lo resuelve",
  ignore: !SERVICE_ROLE_KEY,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!);
    const tenantId = crypto.randomUUID();
    await admin.from("tenants").insert({ id: tenantId, nombre: "Conciliacion Alerta Test" });

    const { data: userData } = await admin.auth.admin.createUser({
      email: `conciliacion-alerta-${crypto.randomUUID()}@e2e.test`,
      password: "Test1234!",
      email_confirm: true,
    });
    await admin.from("memberships").insert({ tenant_id: tenantId, user_id: userData!.user!.id, role: "staff" });
    const { data: producto } = await admin
      .from("productos")
      .insert({ tenant_id: tenantId, nombre: "Producto sin webhook", precio: 20000, stock: 1 })
      .select()
      .single();
    const { data: order } = await admin.from("orders").insert({ tenant_id: tenantId, total: 20000 }).select().single();
    await admin.from("order_items").insert({
      order_id: order.id, tenant_id: tenantId, producto_id: producto.id, cantidad: 1, precio_unitario: 20000,
    });
    // Se fuerza pendiente_pago directo (como service_role, que ya
    // tiene grant de update en orders) sin pasar por solicitar_pago --
    // no hace falta reservar stock real para probar la rama de
    // alerta; el trigger de transicion igual valida creado->pendiente_pago.
    await admin.from("orders").update({ estado: "pendiente_pago" }).eq("id", order.id);

    // umbral negativo (no 0): registrar_referencia_pago tambien
    // dispara el trigger de orders y resetea updated_at (misma fila),
    // asi que un umbral de 0 minutos es una carrera de milisegundos
    // contra el propio "now()" de la conciliacion. -1 minuto empuja el
    // limite al futuro y elimina la carrera sin cambiar lo que se prueba.
    const resultado = await conciliarPagosPendientes(admin, -1);
    assertEquals(resultado.alertados >= 1, true, "se genero al menos 1 alerta");

    const { data: alertas } = await admin
      .from("event_log")
      .select("event_type")
      .eq("tenant_id", tenantId)
      .eq("event_type", "order.conciliacion.alerta");
    assertEquals(alertas!.length, 1, "la alerta quedo registrada en event_log");

    const { data: orderFinal } = await admin.from("orders").select("estado").eq("id", order.id).single();
    assertEquals(orderFinal!.estado, "pendiente_pago", "sin provider_transaction_id, el pedido no se resuelve solo");

    await admin.from("tenants").delete().eq("id", tenantId);
  },
});
