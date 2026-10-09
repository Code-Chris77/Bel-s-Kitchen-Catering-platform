import { expect, test } from "@playwright/test";

import { adminLogin, createOrder, freshIp, kitchenLogin, KITCHEN_PASSWORD, ADMIN_PASSWORD } from "./support";

test("admin endpoints require a session", async ({ request }) => {
  for (const path of ["/api/admin-dashboard", "/api/admin-export", "/api/admin-menu", "/api/admin-staff"]) {
    expect((await request.get(path)).status()).toBe(401);
  }
});

test("repeated wrong passwords are rate limited", async ({ request }) => {
  const headers = { "cf-connecting-ip": "203.0.113.77" };
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request.post("/api/admin-auth", {
      data: { email: "nobody@example.com", password: ADMIN_PASSWORD + "-wrong" },
      headers,
    });
    statuses.push(response.status());
  }
  expect(statuses.slice(0, 8)).toEqual(Array(8).fill(401));
  expect(statuses.slice(8)).toEqual([429, 429]);
});

test("the dashboard counts paid orders and exports them as CSV", async ({ request }) => {
  const order = await createOrder(request);
  await adminLogin(request);

  const dashboard = await (await request.get("/api/admin-dashboard")).json();
  expect(dashboard.summary.todayOrders).toBeGreaterThan(0);
  expect(dashboard.recentOrders.some((row: { id: number }) => row.id === order.id)).toBeTruthy();

  const csv = await request.get("/api/admin-export?from=2020-01-01&to=2099-12-31");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain(`\n${order.id},`);
  expect((await request.get("/api/admin-export?from=yesterday")).status()).toBe(400);
});

test("menu edits show on the customer page and are enforced when ordering", async ({ request, page }) => {
  await adminLogin(request);
  const menu = await (await request.get("/api/admin-menu")).json();

  const saved = await request.put("/api/admin-menu", {
    data: {
      items: menu.items.map((item: { id: string }) => (item.id === "mixed" ? { ...item, active: false } : item)),
      tiers: [...menu.tiers, { amount: 45, active: true }],
      zones: [...menu.zones, { label: "Kasoa", fee: 65, active: true, sortOrder: 9 }],
    },
  });
  expect(saved.ok()).toBeTruthy();

  await page.goto("/");
  await expect(page.locator(".meal-card h3", { hasText: "The Mix" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Add Fried Rice, GH₵45/ })).toBeVisible();

  const hidden = await request.post("/api/orders", {
    data: { orderType: "dine_in", customerName: "A", customerPhone: "0241234567", paymentMethod: "mtn", items: [{ mealId: "mixed", price: 40, quantity: 1 }] },
    headers: { "cf-connecting-ip": freshIp() },
  });
  expect(hidden.status()).toBe(400);

  const kasoa = await request.post("/api/orders", {
    data: { orderType: "delivery", customerName: "A", customerPhone: "0241234567", paymentMethod: "mtn", deliveryZone: "kasoa", deliveryLocation: "Market", items: [{ mealId: "fried", price: 45, quantity: 1 }] },
    headers: { "cf-connecting-ip": freshIp() },
  });
  expect(kasoa.status()).toBe(201);
  expect((await kasoa.json()).order.total).toBe(45 + 65);
});

test("staff accounts replace the shared kitchen password and can be revoked", async ({ request, playwright, baseURL }) => {
  await adminLogin(request);
  const created = await request.post("/api/admin-staff", { data: { name: "Efua", password: "efua-secret-1" } });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()).staff as { id: number };

  const kitchen = await playwright.request.newContext({ baseURL });
  // Shared password no longer works once staff exist.
  expect((await kitchenLogin(kitchen, KITCHEN_PASSWORD)).status()).toBe(401);
  expect((await kitchenLogin(kitchen, "wrong-password", "Efua")).status()).toBe(401);
  const login = await kitchenLogin(kitchen, "efua-secret-1", "efua");
  expect(login.ok()).toBeTruthy();
  expect((await kitchen.get("/api/orders")).ok()).toBeTruthy();

  // Her actions are attributed to her.
  const order = await createOrder(request);
  expect((await kitchen.patch(`/api/orders/${order.id}`, { data: { status: "preparing" } })).ok()).toBeTruthy();

  // Disabling the account ends her open session immediately.
  expect((await request.patch("/api/admin-staff", { data: { id, active: false } })).ok()).toBeTruthy();
  expect((await kitchen.get("/api/orders")).status()).toBe(401);
  expect((await kitchenLogin(kitchen, "efua-secret-1", "Efua")).status()).toBe(401);
  await kitchen.dispose();

  // Disabled accounts leave the shared password working again.
  expect((await kitchenLogin(request, KITCHEN_PASSWORD)).ok()).toBeTruthy();
});

test("admin can sign out every device", async ({ request, playwright, baseURL }) => {
  const other = await playwright.request.newContext({ baseURL });
  await adminLogin(other);
  await adminLogin(request);
  expect((await other.get("/api/admin-dashboard")).ok()).toBeTruthy();

  expect((await request.post("/api/admin-settings/sign-out-everywhere")).ok()).toBeTruthy();
  expect((await other.get("/api/admin-dashboard")).status()).toBe(401);
  expect((await request.get("/api/admin-dashboard")).status()).toBe(401);
  await other.dispose();
});
