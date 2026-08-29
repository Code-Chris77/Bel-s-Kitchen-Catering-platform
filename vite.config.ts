import { defineConfig, loadEnv, type Plugin } from "vite";
import vinext from "vinext";
import fs from "fs";
import path from "path";

function loadDevVars(): Record<string, string> {
  const devVarsPath = path.resolve(process.cwd(), ".dev.vars");
  const envVars: Record<string, string> = {};
  if (fs.existsSync(devVarsPath)) {
    const content = fs.readFileSync(devVarsPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...values] = trimmed.split("=");
        if (key && values.length) {
          envVars[key.trim()] = values.join("=").trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  }
  return envVars;
}

function cloudflareWorkersShim(): Plugin {
  const virtualModuleId = "cloudflare:workers";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  return {
    name: "cloudflare-workers-shim",
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        return `
          const baseEnv = typeof process !== "undefined" && process.env ? process.env : {};
          export const env = new Proxy(baseEnv, {
            get(target, prop) {
              if (typeof prop === "string" && prop in target) {
                return target[prop];
              }
              if (typeof globalThis !== "undefined" && prop in globalThis) {
                return globalThis[prop];
              }
              return target[prop];
            }
          });
          export default { env };
        `;
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...loadDevVars() };
  Object.assign(process.env, env);

  return {
    define: {
      target: "globalThis",
    },
    plugins: [
      cloudflareWorkersShim(),
      vinext(),
    ],
    ssr: {
      external: ["@libsql/client", "libsql"],
    },
    resolve: {
      alias: {
        "cloudflare:workers": "cloudflare:workers",
      },
    },
  };
});