import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false },
});

after(async () => {
  await vite.close();
});

const domain = await vite.ssrLoadModule("/lib/domain.ts");
const crypto = await vite.ssrLoadModule("/lib/crypto.ts");

test("orders advance through the kitchen stages in order", () => {
  assert.equal(domain.nextStatus("received", "delivery"), "preparing");
  assert.equal(domain.nextStatus("preparing", "dine_in"), "ready");
  assert.equal(domain.nextStatus("ready", "dine_in"), "collected");
  assert.equal(domain.nextStatus("ready", "delivery"), "out_for_delivery");
  assert.equal(domain.nextStatus("out_for_delivery", "delivery"), "delivered");
});

test("finished and cancelled orders cannot advance", () => {
  for (const status of ["collected", "delivered", "cancelled", "nonsense"]) {
    assert.equal(domain.nextStatus(status, "delivery"), null);
  }
});

test("menu validators accept only known values", () => {
  assert.ok(domain.isMealId("jollof"));
  assert.ok(!domain.isMealId("toString"));
  assert.ok(domain.isDeliveryZone("tema"));
  assert.ok(!domain.isDeliveryZone("__proto__"));
  assert.ok(domain.isPaymentMethod("mtn"));
  assert.ok(!domain.isPaymentMethod("cash"));
  assert.ok(domain.isValidPrice(40));
  assert.ok(!domain.isValidPrice(1));
});

test("base64url round-trips arbitrary bytes", () => {
  const bytes = Uint8Array.from([0, 250, 251, 252, 253, 254, 255, 62, 63]);
  const encoded = crypto.bytesToBase64Url(bytes);

  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual([...crypto.base64UrlToBytes(encoded)], [...bytes]);
});

test("HMAC signatures verify only for the same value and secret", async () => {
  const signature = await crypto.hmacSign("v1.123", "secret-a");

  assert.ok(await crypto.hmacVerify("v1.123", signature, "secret-a"));
  assert.ok(!(await crypto.hmacVerify("v1.124", signature, "secret-a")));
  assert.ok(!(await crypto.hmacVerify("v1.123", signature, "secret-b")));
});

test("sameText compares strings without short-circuiting on length", async () => {
  assert.ok(await crypto.sameText("abc", "abc"));
  assert.ok(!(await crypto.sameText("abc", "abd")));
  assert.ok(!(await crypto.sameText("abc", "abcd")));
});

test("PBKDF2 hashes are salted and deterministic per salt", async () => {
  const saltA = Uint8Array.from({ length: 16 }, (_, index) => index);
  const saltB = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
  const first = await crypto.pbkdf2Hash("correct horse", saltA, 1000);

  assert.equal(first, await crypto.pbkdf2Hash("correct horse", saltA, 1000));
  assert.notEqual(first, await crypto.pbkdf2Hash("correct horse", saltB, 1000));
  assert.notEqual(first, await crypto.pbkdf2Hash("wrong horse", saltA, 1000));
});

test("cookieValue reads one cookie from the header", () => {
  const request = new Request("http://localhost", {
    headers: { cookie: "a=1; bels_kitchen_session=v2.9.x.y; b=2" },
  });

  assert.equal(crypto.cookieValue(request, "bels_kitchen_session"), "v2.9.x.y");
  assert.equal(crypto.cookieValue(request, "missing"), "");
});
