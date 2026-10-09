import { test } from "@playwright/test";

// Visual snapshots of the logged-in / interactive states (used to check CSS refactors).
test("state screenshots", async ({ page, request }) => {
  const dir = process.env.SHOT_DIR;
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Add Fried Rice, GH₵35/ }).click();
  await page.getByRole("button", { name: /Add The Mix, GH₵50/ }).click();
  await page.getByRole("button", { name: /Open cart/ }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/home-cart.png`, animations: "disabled" });
  await page.getByRole("button", { name: "Checkout" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/home-checkout.png`, animations: "disabled" });

  for (const [type, name] of [["delivery", "Ama"], ["dine_in", "Kofi"]] as const) {
    await request.post("/api/orders", {
      data: {
        orderType: type,
        customerName: name,
        customerPhone: "0241234567",
        deliveryZone: type === "delivery" ? "tema" : null,
        deliveryLocation: type === "delivery" ? "Community 1" : null,
        paymentMethod: "mtn",
        items: [{ mealId: "jollof", price: 40, quantity: 2 }],
      },
    });
  }

  await page.goto("/kitchen");
  await page.getByLabel("Kitchen password").fill("kitchen-test-pass");
  await page.getByRole("button", { name: "Open kitchen queue" }).click();
  await page.waitForSelector(".order-ticket");
  await page.waitForTimeout(500);
  await page.addStyleTag({ content: ".kitchen-summary span:nth-child(2){visibility:hidden}" });
  await page.screenshot({ path: `${dir}/kitchen-board.png`, fullPage: true, animations: "disabled" });

  await page.goto("/admin");
  await page.getByLabel(/email/i).fill("admin@example.com");
  await page.getByLabel(/password/i).fill("admin-test-pass");
  await page.getByRole("button", { name: /sign in|open|log in/i }).first().click();
  await page.waitForSelector(".admin-records-card");
  await page.waitForTimeout(500);
  await page.addStyleTag({ content: ".admin-header time, [class*='updated']{visibility:hidden}" });
  await page.screenshot({ path: `${dir}/admin-dashboard.png`, fullPage: true, animations: "disabled" });
});
