// getStatus contra la API real de sandbox de Wompi (no un mock) --
// usa las mismas transacciones reales de las fixtures, que persisten
// en el sandbox de Wompi.
//
// La llave privada se lee de env (WOMPI_TEST_PRIVATE_KEY), NUNCA
// hardcodeada -- este repo es publico y la llave es real (aunque de
// sandbox). Sin la variable, estos tests se saltan solos.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { wompiGateway } from "./wompi-adapter.ts";
import type { PaymentGatewayCredentials } from "../../../packages/core/src/payment-gateway.ts";

const PRIVATE_KEY = Deno.env.get("WOMPI_TEST_PRIVATE_KEY");

const CREDENTIALS: PaymentGatewayCredentials = {
  publicKey: "no-usado-en-este-test",
  privateKey: PRIVATE_KEY ?? "",
  eventsSecret: "no-usado-en-este-test",
  integritySecret: "no-usado-en-este-test",
};

Deno.test({
  name: "getStatus: transaccion real APPROVED del sandbox",
  ignore: !PRIVATE_KEY,
  fn: async () => {
    const status = await wompiGateway.getStatus("12130153-1783156616-58020", CREDENTIALS);
    assertEquals(status.status, "approved");
    assertEquals(status.reference, "fixture-test-1783156614");
    assertEquals(status.amountInCents, 5000000);
  },
});

Deno.test({
  name: "getStatus: transaccion real DECLINED del sandbox",
  ignore: !PRIVATE_KEY,
  fn: async () => {
    const status = await wompiGateway.getStatus("12130153-1783156682-20667", CREDENTIALS);
    assertEquals(status.status, "declined");
    assertEquals(status.reference, "fixture-declined-1783156681");
  },
});
