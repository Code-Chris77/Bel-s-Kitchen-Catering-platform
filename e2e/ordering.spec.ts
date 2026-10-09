import { expect, test } from "@playwright/test";

import { createOrder, gotoHydrated, kitchenLogin, KITCHEN_PASSWORD } from "./support";

test("a customer orders, the kitchen advances it, and tracking follows along", async ({ page, context }) => {
  // 1. Customer places a restaurant order through the real UI.
  await gotoHydrated(page, "/");
  await page.getByRole("button", { name: /Add Jollof Rice, GH₵40/ }).click();
  await page.getByRole("button", { name: /Open cart/ }).click();
  await page.getByRole("button", { name: "Checkout" }).click();
  await page.getByText("At restaurant").click();
  await page.getByLabel("Your name").fill("Ama Mensah");
  await page.getByLabel("Phone number").fill("0241234567");
  await page.getByRole("button", { name: /Confirm demo payment/ }).click();

  const orderNumber = Number((await page.locator(".order-number strong").innerText()).replace("#", ""));
  const trackingCode = await page.locator(".tracking-password strong").innerText();
  expect(orderNumber).toBeGreaterThan(0);
  expect(trackingCode).toMatch(/^\d{6}$/);

  // 2. The kitchen signs in and starts the order.
  const kitchen = await context.newPage();
  await gotoHydrated(kitchen, "/kitchen");
  await kitchen.getByLabel("Kitchen password").fill(KITCHEN_PASSWORD);
  await kitchen.getByRole("button", { name: "Open kitchen queue" }).click();
  const ticket = kitchen.locator(".order-ticket", { hasText: `#${orderNumber}` });
  await expect(ticket).toBeVisible();
  await ticket.getByRole("button", { name: "Start preparing" }).click();
  await expect(kitchen.locator(".kitchen-column", { hasText: "Preparing" }).locator(".order-ticket", { hasText: `#${orderNumber}` })).toBeVisible();

  // 3. The customer's tracking page shows the new stage.
  const tracking = await context.newPage();
  await gotoHydrated(tracking, `/track?order=${orderNumber}`);
  await tracking.getByLabel("Six digit tracking password").fill(trackingCode);
  await tracking.getByRole("button", { name: "View my progress" }).click();
  await expect(tracking.locator(".current-status h2")).toHaveText("Preparing");
});

test("a wrong tracking password reveals nothing", async ({ page, request }) => {
  const order = await createOrder(request);
  await gotoHydrated(page, `/track?order=${order.id}`);
  await page.getByLabel("Six digit tracking password").fill(order.trackingCode === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "View my progress" }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
});

test("the kitchen can cancel an order and the customer sees it", async ({ page, request }) => {
  const order = await createOrder(request);
  expect((await kitchenLogin(request)).ok()).toBeTruthy();

  const cancel = await request.patch(`/api/orders/${order.id}`, { data: { status: "cancelled" } });
  expect(cancel.ok()).toBeTruthy();
  const again = await request.patch(`/api/orders/${order.id}`, { data: { status: "preparing" } });
  expect(again.status()).toBe(409);

  await gotoHydrated(page, `/track?order=${order.id}`);
  await page.getByLabel("Six digit tracking password").fill(order.trackingCode);
  await page.getByRole("button", { name: "View my progress" }).click();
  await expect(page.getByRole("heading", { name: "Order cancelled." })).toBeVisible();
});

test("orders cannot skip stages", async ({ request }) => {
  const order = await createOrder(request);
  await kitchenLogin(request);
  const skip = await request.patch(`/api/orders/${order.id}`, { data: { status: "ready" } });
  expect(skip.status()).toBe(409);
});

test("prices and fees are decided by the server", async ({ request }) => {
  const forged = await request.post("/api/orders", {
    data: {
      orderType: "dine_in",
      customerName: "Mallory",
      customerPhone: "0241234567",
      paymentMethod: "mtn",
      items: [{ mealId: "jollof", price: 1, quantity: 1 }],
    },
  });
  expect(forged.status()).toBe(400);

  const delivery = await request.post("/api/orders", {
    data: {
      orderType: "delivery",
      customerName: "Kofi",
      customerPhone: "0241234567",
      paymentMethod: "card",
      deliveryZone: "tema",
      deliveryLocation: "Community 1",
      items: [{ mealId: "fried", price: 35, quantity: 2 }],
    },
    headers: { "cf-connecting-ip": "203.0.113.50" },
  });
  expect(delivery.status()).toBe(201);
  expect((await delivery.json()).order.total).toBe(35 * 2 + 50);
});
