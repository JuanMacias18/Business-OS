// Contract tests contra fixtures REALES de sandbox (T0.5, 03-07 §2).
// No llaman a la red -- verifican que verifyWebhook/parseEvent
// entienden exactamente el formato real de Wompi.
//
// El secreto de eventos se lee de env (WOMPI_TEST_EVENTS_SECRET), NUNCA
// hardcodeado -- este repo es publico y el secreto es real (aunque de
// sandbox). Sin la variable, estos tests se saltan solos.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { wompiGateway } from "./wompi-adapter.ts";
import type { PaymentGatewayCredentials } from "../../../packages/core/src/payment-gateway.ts";

const EVENTS_SECRET = Deno.env.get("WOMPI_TEST_EVENTS_SECRET");

const CREDENTIALS: PaymentGatewayCredentials = {
  publicKey: "no-usado-en-este-test",
  privateKey: "no-usado-en-este-test",
  eventsSecret: EVENTS_SECRET ?? "",
  integritySecret: "no-usado-en-este-test",
};

async function loadFixture(name: string): Promise<string> {
  return await Deno.readTextFile(new URL(`../../tests/fixtures/${name}`, import.meta.url));
}

Deno.test({
  name: "verifyWebhook: checksum real de un evento APPROVED pasa",
  ignore: !EVENTS_SECRET,
  fn: async () => {
    const raw = await loadFixture("wompi-event-approved.json");
    assertEquals(await wompiGateway.verifyWebhook(raw, CREDENTIALS), true);
  },
});

Deno.test({
  name: "verifyWebhook: checksum real de un evento DECLINED pasa",
  ignore: !EVENTS_SECRET,
  fn: async () => {
    const raw = await loadFixture("wompi-event-declined.json");
    assertEquals(await wompiGateway.verifyWebhook(raw, CREDENTIALS), true);
  },
});

Deno.test({
  name: "verifyWebhook: payload alterado invalida el checksum",
  ignore: !EVENTS_SECRET,
  fn: async () => {
    const raw = await loadFixture("wompi-event-approved.json");
    const tampered = raw.replace('"amount_in_cents": 5000000', '"amount_in_cents": 1');
    assertEquals(await wompiGateway.verifyWebhook(tampered, CREDENTIALS), false);
  },
});

Deno.test({
  name: "verifyWebhook: secreto de eventos incorrecto invalida el checksum",
  ignore: !EVENTS_SECRET,
  fn: async () => {
    const raw = await loadFixture("wompi-event-approved.json");
    assertEquals(
      await wompiGateway.verifyWebhook(raw, { ...CREDENTIALS, eventsSecret: "secreto-equivocado" }),
      false,
    );
  },
});

Deno.test("parseEvent: extrae correctamente un evento APPROVED", async () => {
  const raw = await loadFixture("wompi-event-approved.json");
  const event = wompiGateway.parseEvent(raw);
  assertEquals(event.status, "approved");
  assertEquals(event.providerTransactionId, "12130153-1783156616-58020");
  assertEquals(event.reference, "fixture-test-1783156614");
});

Deno.test("parseEvent: extrae correctamente un evento DECLINED", async () => {
  const raw = await loadFixture("wompi-event-declined.json");
  const event = wompiGateway.parseEvent(raw);
  assertEquals(event.status, "declined");
  assertEquals(event.providerTransactionId, "12130153-1783156682-20667");
});
