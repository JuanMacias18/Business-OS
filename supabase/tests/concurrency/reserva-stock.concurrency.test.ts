// LOOP B (03-05 §8.2): N solicitudes concurrentes de solicitar_pago()
// sobre un producto con stock=1 => exactamente 1 exitosa, 0 sobreventa.
// Necesita conexiones concurrentes reales (PostgREST por request), por
// eso no cabe en pgTAP (una sola conexion secuencial por archivo).
// Requiere `supabase start` corriendo + SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const N = 10;
const REPETICIONES = 20;

async function unaCorrida(runIndex: number) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!);
  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const email = `concurrency-${runIndex}-${crypto.randomUUID()}@e2e.test`;
  const password = "Test1234!";

  const { error: tenantError } = await admin.from("tenants").insert({ id: tenantId, nombre: `Concurrency ${runIndex}` });
  if (tenantError) throw tenantError;

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    id: userId,
    email,
    password,
    email_confirm: true,
  });
  if (userError) throw userError;

  await admin.from("memberships").insert({ tenant_id: tenantId, user_id: userData.user.id, role: "staff" });

  const { data: producto, error: productoError } = await admin
    .from("productos")
    .insert({ tenant_id: tenantId, nombre: "Producto concurrencia", precio: 1000, stock: 1 })
    .select()
    .single();
  if (productoError) throw productoError;

  const anon = createClient(SUPABASE_URL, ANON_KEY!);
  const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  const authed = createClient(SUPABASE_URL, ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${signIn.session!.access_token}` } },
  });

  const orderIds: string[] = [];
  for (let i = 0; i < N; i++) {
    const { data: order, error: orderError } = await authed
      .from("orders")
      .insert({ tenant_id: tenantId })
      .select()
      .single();
    if (orderError) throw orderError;
    await authed.from("order_items").insert({
      order_id: order.id,
      tenant_id: tenantId,
      producto_id: producto.id,
      cantidad: 1,
      precio_unitario: 1000,
    });
    orderIds.push(order.id);
  }

  const resultados = await Promise.allSettled(
    orderIds.map((orderId) => authed.rpc("solicitar_pago", { p_order_id: orderId })),
  );

  const exitosos = resultados.filter((r) => r.status === "fulfilled" && !r.value.error);
  const fallidos = resultados.filter((r) => r.status === "fulfilled" && r.value.error);

  const { data: productoFinal } = await admin.from("productos").select("stock").eq("id", producto.id).single();

  await admin.from("tenants").delete().eq("id", tenantId); // cascade limpia todo lo demas
  await admin.auth.admin.deleteUser(userData.user.id);

  return {
    exitosos: exitosos.length,
    fallidos: fallidos.length,
    stockFinal: productoFinal?.stock,
  };
}

Deno.test({
  name: `LOOP B: ${N} solicitudes concurrentes sobre stock=1, corrido ${REPETICIONES} veces`,
  ignore: !SERVICE_ROLE_KEY || !ANON_KEY,
  fn: async () => {
    for (let run = 0; run < REPETICIONES; run++) {
      const resultado = await unaCorrida(run);
      assertEquals(resultado.exitosos, 1, `corrida ${run}: debe haber exactamente 1 exitoso`);
      assertEquals(resultado.fallidos, N - 1, `corrida ${run}: los otros ${N - 1} deben fallar limpio`);
      assertEquals(resultado.stockFinal, 0, `corrida ${run}: el stock final debe ser exactamente 0, nunca negativo`);
    }
  },
});
