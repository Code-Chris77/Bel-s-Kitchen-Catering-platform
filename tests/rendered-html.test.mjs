import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register(new URL("./support/cloudflare-workers-hooks.mjs", import.meta.url));

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const env = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const ctx = { waitUntil() {}, passThroughOnException() {} };

function call(path, init) {
  return worker.fetch(new Request(`http://localhost${path}`, init), env, ctx);
}

test("renders the customer home page with security headers", async () => {
  const response = await call("/", { headers: { accept: "text/html" } });
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /Bel(&#x27;|')s Kitchen/i);
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("keeps private pages out of search engines and caches", async () => {
  const response = await call("/kitchen", { headers: { accept: "text/html" } });

  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("rejects cross-site writes to the API", async () => {
  const response = await call("/api/orders", {
    method: "POST",
    headers: { origin: "https://evil.example", "content-type": "application/json" },
    body: "{}",
  });

  assert.equal(response.status, 403);
});

test("the kitchen queue requires a session", async () => {
  const response = await call("/api/orders");

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("the admin dashboard requires a session", async () => {
  const response = await call("/api/admin-dashboard");

  assert.equal(response.status, 401);
});
