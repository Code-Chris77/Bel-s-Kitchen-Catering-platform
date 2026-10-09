import { test } from "@playwright/test";

const pages = ["/", "/track", "/kitchen", "/admin", "/privacy"];

for (const [name, viewport] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 800 }]] as const) {
  test(`screenshots ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const path of pages) {
      await page.goto(path);
      await page.waitForTimeout(800);
      await page.screenshot({
        path: `${process.env.SHOT_DIR}/${name}-${path.replace(/\W/g, "") || "home"}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  });
}
