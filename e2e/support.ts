import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** Credentials from `.dev.vars` (CI writes the same values; see .github/workflows/ci.yml). */
export const KITCHEN_PASSWORD = process.env.E2E_KITCHEN_PASSWORD ?? "kitchen-test-pass";
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin-test-pass";

let ipCounter = 10;
/** A distinct client IP per call so rate-limit buckets never leak between tests. */
export function freshIp() {
  ipCounter += 1;
  return `198.51.100.${ipCounter}`;
}

export const orderBody = (overrides: Record<string, unknown> = {}) => ({
  orderType: "dine_in",
  customerName: "Test Customer",
  customerPhone: "024 123 4567",
  paymentMethod: "mtn",
  items: [{ mealId: "jollof", price: 40, quantity: 2 }],
  ...overrides,
});

export async function createOrder(request: APIRequestContext, overrides: Record<string, unknown> = {}) {
  const response = await request.post("/api/orders", {
    data: orderBody(overrides),
    headers: { "cf-connecting-ip": freshIp() },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).order as { id: number; trackingCode: string; total: number };
}

export async function kitchenLogin(request: APIRequestContext, password = KITCHEN_PASSWORD, name?: string) {
  return request.post("/api/kitchen-auth", {
    data: { password, name },
    headers: { "cf-connecting-ip": freshIp() },
  });
}

export async function adminLogin(request: APIRequestContext) {
  const response = await request.post("/api/admin-auth", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { "cf-connecting-ip": freshIp() },
  });
  expect(response.ok()).toBeTruthy();
}

/** Server-rendered buttons do nothing until React has hydrated. */
export async function gotoHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
}
