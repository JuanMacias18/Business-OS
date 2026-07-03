import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifySignature } from "./webhook-echo.ts";

async function sign(rawBody: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("verifySignature: firma valida pasa", async () => {
  const body = '{"tenant_id":"t1","idempotency_key":"k1","event_type":"webhook.echo"}';
  const secret = "dummy-secret";
  const validSignature = await sign(body, secret);
  assertEquals(await verifySignature(body, validSignature, secret), true);
});

Deno.test("verifySignature: firma invalida no pasa", async () => {
  const body = '{"tenant_id":"t1","idempotency_key":"k1","event_type":"webhook.echo"}';
  assertEquals(await verifySignature(body, "firma-inventada", "dummy-secret"), false);
});

Deno.test("verifySignature: payload alterado invalida la firma", async () => {
  const secret = "dummy-secret";
  const originalSignature = await sign('{"a":1}', secret);
  assertEquals(await verifySignature('{"a":2}', originalSignature, secret), false);
});

Deno.test("verifySignature: sin header de firma no pasa", async () => {
  assertEquals(await verifySignature('{"a":1}', null, "dummy-secret"), false);
});

Deno.test("verifySignature: sin secreto configurado no pasa", async () => {
  const body = '{"a":1}';
  const signature = await sign(body, "algun-secreto");
  assertEquals(await verifySignature(body, signature, ""), false);
});
