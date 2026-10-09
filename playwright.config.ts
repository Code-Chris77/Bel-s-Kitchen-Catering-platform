import { defineConfig, devices } from "@playwright/test";

const port = 5199;

export default defineConfig({
  testDir: "./e2e",
  // Visual snapshots (used when refactoring CSS) only run with VISUAL=1 SHOT_DIR=<folder>.
  testIgnore: process.env.VISUAL ? [] : ["**/visual/**"],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Fresh local D1 every run so rate limits and order numbers start clean.
    command: `rm -rf .wrangler/state && npm run db:migrate:local && npx vite --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
