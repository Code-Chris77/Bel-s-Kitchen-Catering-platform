import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

// Secrets come from `.dev.vars` locally (read by the Cloudflare plugin) and
// from `wrangler secret put` in production. `cloudflare:workers` is provided by
// the plugin, so no shim is needed.
export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
});
